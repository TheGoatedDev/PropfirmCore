import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { FirmConfig } from "@propfirmcore/config";
import {
    accountSchema,
    applyFills,
    applySnapshot,
    fillSchema,
    openAccount,
    snapshotSchema,
} from "@propfirmcore/domain";
import { eq, inArray } from "drizzle-orm";
import { mountAccounts } from "./accounts/http.ts";
import type { Auth } from "./auth.ts";
import { mountCheckout } from "./checkout/http.ts";
import {
    accountFromRow,
    accounts,
    accountToRow,
    type Db,
    fills,
    fillToRow,
    snapshots,
} from "./db.ts";
import { requireApiKey } from "./ingest-key.ts";
import { openApiInfo, withAuthOpenAPI } from "./openapi.ts";

const errorSchema = z.object({ error: z.string() });

const fillsBody = z.object({ fills: z.array(fillSchema).min(1) });

const idParam = z.object({ id: z.string().min(1) });

const createBody = z.object({
    id: z.string().min(1),
    productId: z.string().min(1),
    userId: z.string().min(1).nullable().optional(),
});

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
            tags: ["trader"],
            responses: {
                200: {
                    description: "ok",
                    content: { "application/json": { schema: meSchema } },
                },
                401: {
                    description: "unauthorized",
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
    mountAccounts(app, deps);

    app.use("/ingest/*", requireApiKey(deps.apiKey));

    app.openapi(
        createRoute({
            method: "post",
            path: "/ingest/accounts",
            tags: ["ingest"],
            security: [{ apiKey: [] }],
            request: {
                body: {
                    content: { "application/json": { schema: createBody } },
                    required: true,
                },
            },
            responses: {
                201: {
                    description: "created",
                    content: { "application/json": { schema: accountSchema } },
                },
                400: {
                    description: "bad request",
                    content: { "application/json": { schema: errorSchema } },
                },
                401: {
                    description: "unauthorized",
                    content: { "application/json": { schema: errorSchema } },
                },
                409: {
                    description: "exists",
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const body = c.req.valid("json");
            const product = productOrNull(deps.firm, body.productId);
            if (!product) return c.json({ error: "unknown product" }, 400);
            const existing = await deps.db
                .select()
                .from(accounts)
                .where(eq(accounts.id, body.id))
                .limit(1);
            if (existing[0]) return c.json({ error: "exists" }, 409);
            const account = openAccount(
                body.id,
                product,
                deps.firm.dailyClose,
                new Date().toISOString(),
                body.userId ?? null,
            );
            await deps.db.insert(accounts).values(accountToRow(account));
            return c.json(account, 201);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/ingest/accounts/{id}",
            tags: ["ingest"],
            security: [{ apiKey: [] }],
            request: { params: idParam },
            responses: {
                200: {
                    description: "ok",
                    content: { "application/json": { schema: accountSchema } },
                },
                401: {
                    description: "unauthorized",
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: "not found",
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const rows = await deps.db
                .select()
                .from(accounts)
                .where(eq(accounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            return c.json(accountFromRow(rows[0]), 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/ingest/accounts/{id}/snapshot",
            tags: ["ingest"],
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
                    description: "ok",
                    content: { "application/json": { schema: accountSchema } },
                },
                400: {
                    description: "bad request",
                    content: { "application/json": { schema: errorSchema } },
                },
                401: {
                    description: "unauthorized",
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: "not found",
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const body = c.req.valid("json");
            const rows = await deps.db
                .select()
                .from(accounts)
                .where(eq(accounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            const seen = await deps.db
                .select({ id: snapshots.externalId })
                .from(snapshots)
                .where(eq(snapshots.externalId, body.externalId))
                .limit(1);
            let account = accountFromRow(rows[0]);
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
                        accountId: id,
                        equity: body.equity,
                        balance: body.balance,
                        ts: body.ts,
                        positions: body.positions,
                    });
                    await tx
                        .update(accounts)
                        .set(accountToRow(account))
                        .where(eq(accounts.id, id));
                });
            }
            return c.json(account, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/ingest/accounts/{id}/fills",
            tags: ["ingest"],
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
                    description: "ok",
                    content: { "application/json": { schema: accountSchema } },
                },
                400: {
                    description: "bad request",
                    content: { "application/json": { schema: errorSchema } },
                },
                401: {
                    description: "unauthorized",
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: "not found",
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const body = c.req.valid("json");
            const rows = await deps.db
                .select()
                .from(accounts)
                .where(eq(accounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            const ids = body.fills.map((f) => f.externalId);
            const existing = await deps.db
                .select({ id: fills.externalId })
                .from(fills)
                .where(inArray(fills.externalId, ids));
            const seen = new Set(existing.map((r) => r.id));
            const newFills = body.fills.filter((f) => !seen.has(f.externalId));
            let account = accountFromRow(rows[0]);
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
                        .update(accounts)
                        .set(accountToRow(account))
                        .where(eq(accounts.id, id));
                });
            }
            return c.json(account, 200);
        },
    );

    app.get("/openapi.json", async (c) => {
        const spec = app.getOpenAPIDocument(openApiInfo);
        return c.json(await withAuthOpenAPI(spec, deps.auth));
    });

    return app;
}
