import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { FirmConfig } from "@propfirmcore/config";
import { tradingAccountSchema } from "@propfirmcore/domain";
import { eq } from "drizzle-orm";
import type { Auth } from "../auth/auth.ts";
import { roleHasPermission } from "../auth/permissions.ts";
import {
    type Db,
    fills,
    snapshots,
    tradingAccountFromRow,
    tradingAccounts,
} from "../db/db.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { actorOf } from "../http/session.ts";
import { forceFailAccount, forcePassAccount, getById } from "./service.ts";

const idParam = z.object({ id: z.string().min(1) });

type Deps = { db: Db; firm: FirmConfig; auth: Auth };

function canRead(
    who: { id: string; role: string },
    account: { userId: string },
) {
    if (account.userId === who.id) return true;
    return roleHasPermission(who.role, "tradingAccount", "read");
}

export function mountTradingAccounts(app: OpenAPIHono, deps: Deps) {
    app.openapi(
        createRoute({
            method: "get",
            path: "/products",
            tags: [tags.products],
            responses: {
                200: {
                    description: "Challenge products this firm sells.",
                    content: {
                        "application/json": { schema: z.array(z.unknown()) },
                    },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            return c.json(deps.firm.products, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/trading-accounts",
            tags: [tags.tradingAccounts],
            responses: {
                200: {
                    description: "Trading accounts you can see.",
                    content: {
                        "application/json": {
                            schema: z.array(tradingAccountSchema),
                        },
                    },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            const who = actorOf(session.user);
            const rows = roleHasPermission(who.role, "tradingAccount", "list")
                ? await deps.db.select().from(tradingAccounts)
                : await deps.db
                      .select()
                      .from(tradingAccounts)
                      .where(eq(tradingAccounts.userId, who.id));
            return c.json(rows.map(tradingAccountFromRow), 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/trading-accounts/{id}",
            tags: [tags.tradingAccounts],
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
                403: {
                    description: httpDesc.forbidden,
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            const account = await getById(deps.db, c.req.valid("param").id);
            if (!account) return c.json({ error: "not found" }, 404);
            if (!canRead(actorOf(session.user), account)) {
                return c.json({ error: "forbidden" }, 403);
            }
            return c.json(account, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/trading-accounts/{id}/fills",
            tags: [tags.tradingAccounts],
            request: { params: idParam },
            responses: {
                200: {
                    description: "Fills on this trading account.",
                    content: {
                        "application/json": { schema: z.array(z.unknown()) },
                    },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                403: {
                    description: httpDesc.forbidden,
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            const { id } = c.req.valid("param");
            const account = await getById(deps.db, id);
            if (!account) return c.json({ error: "not found" }, 404);
            if (!canRead(actorOf(session.user), account)) {
                return c.json({ error: "forbidden" }, 403);
            }
            const data = await deps.db
                .select()
                .from(fills)
                .where(eq(fills.tradingAccountId, id));
            return c.json(data, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/trading-accounts/{id}/snapshots",
            tags: [tags.tradingAccounts],
            request: { params: idParam },
            responses: {
                200: {
                    description: "Equity snapshots on this trading account.",
                    content: {
                        "application/json": { schema: z.array(z.unknown()) },
                    },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                403: {
                    description: httpDesc.forbidden,
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            const { id } = c.req.valid("param");
            const account = await getById(deps.db, id);
            if (!account) return c.json({ error: "not found" }, 404);
            if (!canRead(actorOf(session.user), account)) {
                return c.json({ error: "forbidden" }, 403);
            }
            const data = await deps.db
                .select()
                .from(snapshots)
                .where(eq(snapshots.tradingAccountId, id));
            return c.json(data, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/trading-accounts/{id}/fail",
            tags: [tags.tradingAccounts],
            request: { params: idParam },
            responses: {
                200: {
                    description: "The trading account is now failed.",
                    content: {
                        "application/json": { schema: tradingAccountSchema },
                    },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                403: {
                    description: httpDesc.forbidden,
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            if (
                !roleHasPermission(
                    actorOf(session.user).role,
                    "tradingAccount",
                    "fail",
                )
            ) {
                return c.json({ error: "forbidden" }, 403);
            }
            const account = await forceFailAccount(
                deps.db,
                c.req.valid("param").id,
            );
            if (!account) return c.json({ error: "not found" }, 404);
            return c.json(account, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/trading-accounts/{id}/pass",
            tags: [tags.tradingAccounts],
            request: { params: idParam },
            responses: {
                200: {
                    description: "The trading account is now passed.",
                    content: {
                        "application/json": { schema: tradingAccountSchema },
                    },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                403: {
                    description: httpDesc.forbidden,
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            if (
                !roleHasPermission(
                    actorOf(session.user).role,
                    "tradingAccount",
                    "pass",
                )
            ) {
                return c.json({ error: "forbidden" }, 403);
            }
            const account = await forcePassAccount(
                deps.db,
                c.req.valid("param").id,
            );
            if (!account) return c.json({ error: "not found" }, 404);
            return c.json(account, 200);
        },
    );
}
