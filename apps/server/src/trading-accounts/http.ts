import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { FirmConfig } from "@propfirmcore/config";
import { tradingAccountSchema } from "@propfirmcore/domain";
import { eq } from "drizzle-orm";
import type { Auth } from "../auth/auth.ts";
import { roleHasPermission } from "../auth/permissions.ts";
import { type Db, fills, snapshots } from "../db/db.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { actorOf } from "../http/session.ts";
import {
    forceFailAccount,
    forcePassAccount,
    getById,
    listAccounts,
    listBreaches,
    resyncAccountRuleset,
} from "./service.ts";

const idParam = z.object({ id: z.string().min(1) });
const listQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    q: z.string().optional(),
    sort: z.enum(["id", "status", "equity", "productId", "userId"]).optional(),
    order: z.enum(["asc", "desc"]).default("asc"),
});
const listSchema = z.object({
    items: z.array(tradingAccountSchema),
    total: z.number().int(),
});

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
            return c.json(
                deps.firm.products.map((p) => ({
                    ...p,
                    brokers: p.brokers.map((id) => ({
                        id,
                        name:
                            deps.firm.brokers.find((b) => b.id === id)?.name ??
                            id,
                    })),
                })),
                200,
            );
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/trading-accounts",
            tags: [tags.tradingAccounts],
            request: { query: listQuery },
            responses: {
                200: {
                    description: "Trading accounts you can see.",
                    content: {
                        "application/json": {
                            schema: listSchema,
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
            const query = c.req.valid("query");
            const listed = await listAccounts(deps.db, {
                who: actorOf(session.user),
                ...query,
            });
            return c.json(listed, 200);
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

    const breachSchema = z.object({
        phaseIndex: z.number().int(),
        ruleId: z.string(),
        severity: z.enum(["warn", "flag"]),
        subjectId: z.string(),
        positionId: z.string().nullable(),
        ts: z.string(),
    });

    app.openapi(
        createRoute({
            method: "get",
            path: "/trading-accounts/{id}/breaches",
            tags: [tags.tradingAccounts],
            request: { params: idParam },
            responses: {
                200: {
                    description: "Rule breaches on this trading account.",
                    content: {
                        "application/json": {
                            schema: z.array(breachSchema),
                        },
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
            const who = actorOf(session.user);
            if (!canRead(who, account)) {
                return c.json({ error: "forbidden" }, 403);
            }
            const staff = roleHasPermission(who.role, "tradingAccount", "read");
            const rows = await listBreaches(deps.db, account.id, staff);
            return c.json(
                rows.map((r) => ({
                    phaseIndex: r.phaseIndex,
                    ruleId: r.ruleId,
                    severity: r.severity,
                    subjectId: r.subjectId,
                    positionId: r.positionId,
                    ts: r.ts,
                })),
                200,
            );
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/trading-accounts/{id}/resync-ruleset",
            tags: [tags.tradingAccounts],
            request: { params: idParam },
            responses: {
                200: {
                    description:
                        "Pinned ruleset replaced from the current product phase.",
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
                    "resync",
                )
            ) {
                return c.json({ error: "forbidden" }, 403);
            }
            const account = await getById(deps.db, c.req.valid("param").id);
            if (!account) return c.json({ error: "not found" }, 404);
            const product = deps.firm.products.find(
                (p) => p.id === account.productId,
            );
            if (!product) return c.json({ error: "not found" }, 404);
            const next = await resyncAccountRuleset(
                deps.db,
                account.id,
                product,
            );
            if (!next) return c.json({ error: "not found" }, 404);
            return c.json(next, 200);
        },
    );
}
