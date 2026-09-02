import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { FirmConfig } from "@propfirmcore/config";
import {
    applyFills,
    applySnapshot,
    fillSchema,
    snapshotSchema,
    tradingAccountSchema,
} from "@propfirmcore/domain";
import { eq, inArray } from "drizzle-orm";
import { cors } from "hono/cors";
import type { Auth } from "../auth/auth.ts";
import { mountCheckout } from "../checkout/http.ts";
import {
    type Db,
    fills,
    fillToRow,
    snapshots,
    tradingAccountFromRow,
    tradingAccounts,
    tradingAccountToRow,
} from "../db/db.ts";
import { mountPayouts } from "../payouts/http.ts";
import { mountTradingAccounts } from "../trading-accounts/http.ts";
import { errorSchema, httpDesc } from "./http-desc.ts";
import { requireApiKey } from "./ingest-key.ts";
import { openApiInfo, tags, withAuthOpenAPI } from "./openapi.ts";

const fillsBody = z.object({ fills: z.array(fillSchema).min(1) });

const idParam = z.object({ id: z.string().min(1) });

export type AppDeps = {
    apiKey: string;
    firm: FirmConfig;
    db: Db;
    auth: Auth;
};

const meSchema = z.object({
    id: z.string(),
    email: z.string(),
    role: z.string(),
});

function productOrNull(firm: FirmConfig, productId: string) {
    return firm.products.find((p) => p.id === productId);
}

export function createApp(deps: AppDeps) {
    const app = new OpenAPIHono();

    app.use(
        "*",
        cors({
            origin: "http://localhost:8081",
            credentials: true,
        }),
    );

    app.openAPIRegistry.registerComponent("securitySchemes", "apiKey", {
        type: "apiKey",
        in: "header",
        name: "X-Api-Key",
    });

    app.get("/health", (c) => c.json({ ok: true }));

    app.on(["POST", "GET"], "/auth/*", (c) => deps.auth.handler(c.req.raw));
    app.openapi(
        createRoute({
            method: "get",
            path: "/me",
            tags: [tags.me],
            responses: {
                200: {
                    description: "The signed-in user.",
                    content: { "application/json": { schema: meSchema } },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: {
                        "application/json": { schema: errorSchema },
                    },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            const role =
                (session.user as { role?: string | null }).role ?? "trader";
            return c.json(
                {
                    id: session.user.id,
                    email: session.user.email,
                    role,
                },
                200,
            );
        },
    );

    mountCheckout(app, deps);
    mountTradingAccounts(app, deps);
    mountPayouts(app, deps);

    app.use("/ingest/*", requireApiKey(deps.apiKey));

    app.openapi(
        createRoute({
            method: "get",
            path: "/ingest/trading-accounts/{id}",
            tags: [tags.ingest],
            security: [{ apiKey: [] }],
            request: { params: idParam },
            responses: {
                200: {
                    description: "The trading account.",
                    content: {
                        "application/json": { schema: tradingAccountSchema },
                    },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const rows = await deps.db
                .select()
                .from(tradingAccounts)
                .where(eq(tradingAccounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            return c.json(tradingAccountFromRow(rows[0]), 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/ingest/trading-accounts/{id}/snapshot",
            tags: [tags.ingest],
            security: [{ apiKey: [] }],
            request: {
                params: idParam,
                body: {
                    content: { "application/json": { schema: snapshotSchema } },
                    required: true,
                },
            },
            responses: {
                200: {
                    description:
                        "The trading account after applying the equity snapshot.",
                    content: {
                        "application/json": { schema: tradingAccountSchema },
                    },
                },
                400: {
                    description: httpDesc.badRequest,
                    content: { "application/json": { schema: errorSchema } },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const body = c.req.valid("json");
            const rows = await deps.db
                .select()
                .from(tradingAccounts)
                .where(eq(tradingAccounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            const seen = await deps.db
                .select({ id: snapshots.externalId })
                .from(snapshots)
                .where(eq(snapshots.externalId, body.externalId))
                .limit(1);
            let account = tradingAccountFromRow(rows[0]);
            if (!seen[0]) {
                const product = productOrNull(deps.firm, account.productId);
                if (!product) return c.json({ error: "unknown product" }, 400);
                account = applySnapshot(
                    account,
                    body,
                    product,
                    deps.firm.dailyClose,
                );
                await deps.db.transaction(async (tx) => {
                    await tx.insert(snapshots).values({
                        externalId: body.externalId,
                        tradingAccountId: id,
                        equity: body.equity,
                        balance: body.balance,
                        ts: body.ts,
                        positions: body.positions,
                    });
                    await tx
                        .update(tradingAccounts)
                        .set(tradingAccountToRow(account))
                        .where(eq(tradingAccounts.id, id));
                });
            }
            return c.json(account, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/ingest/trading-accounts/{id}/fills",
            tags: [tags.ingest],
            security: [{ apiKey: [] }],
            request: {
                params: idParam,
                body: {
                    content: { "application/json": { schema: fillsBody } },
                    required: true,
                },
            },
            responses: {
                200: {
                    description:
                        "The trading account after applying the fills.",
                    content: {
                        "application/json": { schema: tradingAccountSchema },
                    },
                },
                400: {
                    description: httpDesc.badRequest,
                    content: { "application/json": { schema: errorSchema } },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const body = c.req.valid("json");
            const rows = await deps.db
                .select()
                .from(tradingAccounts)
                .where(eq(tradingAccounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            const ids = body.fills.map((f) => f.externalId);
            const existing = await deps.db
                .select({ id: fills.externalId })
                .from(fills)
                .where(inArray(fills.externalId, ids));
            const seen = new Set(existing.map((r) => r.id));
            const newFills = body.fills.filter((f) => !seen.has(f.externalId));
            let account = tradingAccountFromRow(rows[0]);
            if (newFills.length > 0) {
                const product = productOrNull(deps.firm, account.productId);
                if (!product) return c.json({ error: "unknown product" }, 400);
                account = applyFills(
                    account,
                    newFills,
                    product,
                    deps.firm.dailyClose,
                    newFills[newFills.length - 1].ts,
                );
                await deps.db.transaction(async (tx) => {
                    await tx
                        .insert(fills)
                        .values(newFills.map((f) => fillToRow(id, f)));
                    await tx
                        .update(tradingAccounts)
                        .set(tradingAccountToRow(account))
                        .where(eq(tradingAccounts.id, id));
                });
            }
            return c.json(account, 200);
        },
    );

    app.get("/openapi.json", async (c) => {
        const spec = app.getOpenAPIDocument(openApiInfo);
        return c.json(await withAuthOpenAPI(spec as never, deps.auth as never));
    });

    return app;
}
