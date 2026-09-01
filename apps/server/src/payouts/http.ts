import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { FirmConfig } from "@propfirmcore/config";
import { payoutSchema } from "@propfirmcore/domain";
import { eq } from "drizzle-orm";
import type { Auth } from "../auth/auth.ts";
import { roleHasPermission } from "../auth/permissions.ts";
import type { Db } from "../db/db.ts";
import { payouts, tradingAccounts } from "../db/db.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import {
    approvePayout,
    markPayoutPaid,
    rejectPayout,
    requestPayout,
} from "./service.ts";

const idParam = z.object({ id: z.string().min(1) });
const amountBody = z.object({ amount: z.number().positive() });

type Deps = { db: Db; firm: FirmConfig; auth: Auth };

function sessionRole(user: { role?: string | null }): string {
    return user.role ?? "trader";
}

export function mountPayouts(app: OpenAPIHono, deps: Deps) {
    app.openapi(
        createRoute({
            method: "post",
            path: "/trading-accounts/{id}/payouts",
            tags: [tags.payouts],
            request: {
                params: idParam,
                body: {
                    content: { "application/json": { schema: amountBody } },
                    required: true,
                },
            },
            responses: {
                200: {
                    description: "Payout requested. Status is pending.",
                    content: {
                        "application/json": { schema: payoutSchema },
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
            const { amount } = c.req.valid("json");
            const result = await requestPayout(deps.db, deps.firm, {
                userId: session.user.id,
                tradingAccountId: id,
                amount,
            });
            if (!result.ok) {
                if (result.error === "not found") {
                    return c.json({ error: result.error }, 404);
                }
                if (result.error === "forbidden") {
                    return c.json({ error: result.error }, 403);
                }
                return c.json({ error: result.error }, 400);
            }
            return c.json(result.payout, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/trading-accounts/{id}/payouts",
            tags: [tags.payouts],
            request: { params: idParam },
            responses: {
                200: {
                    description: "Payouts on this trading account.",
                    content: {
                        "application/json": { schema: z.array(payoutSchema) },
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
            const accounts = await deps.db
                .select()
                .from(tradingAccounts)
                .where(eq(tradingAccounts.id, id))
                .limit(1);
            if (!accounts[0]) return c.json({ error: "not found" }, 404);
            const role = sessionRole(session.user);
            const own = accounts[0].userId === session.user.id;
            if (
                !own &&
                !roleHasPermission(role, "tradingAccount", "read") &&
                !roleHasPermission(role, "payout", "read")
            ) {
                return c.json({ error: "forbidden" }, 403);
            }
            const rows = await deps.db
                .select()
                .from(payouts)
                .where(eq(payouts.tradingAccountId, id));
            return c.json(rows, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/payouts",
            tags: [tags.payouts],
            responses: {
                200: {
                    description: "Payouts you can see.",
                    content: {
                        "application/json": { schema: z.array(payoutSchema) },
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
            const role = sessionRole(session.user);
            const rows = roleHasPermission(role, "payout", "list")
                ? await deps.db.select().from(payouts)
                : await deps.db
                      .select()
                      .from(payouts)
                      .where(eq(payouts.userId, session.user.id));
            return c.json(rows, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/payouts/{id}",
            tags: [tags.payouts],
            request: { params: idParam },
            responses: {
                200: {
                    description: "The payout.",
                    content: { "application/json": { schema: payoutSchema } },
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
            const rows = await deps.db
                .select()
                .from(payouts)
                .where(eq(payouts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            const role = sessionRole(session.user);
            const own = rows[0].userId === session.user.id;
            if (!own && !roleHasPermission(role, "payout", "read")) {
                return c.json({ error: "forbidden" }, 403);
            }
            return c.json(rows[0], 200);
        },
    );

    function adminAction(
        action: "approve" | "reject" | "pay",
        permission: "approve" | "reject" | "pay",
        description: string,
        run: typeof approvePayout,
    ) {
        app.openapi(
            createRoute({
                method: "post",
                path: `/payouts/{id}/${action}`,
                tags: [tags.payouts],
                request: { params: idParam },
                responses: {
                    200: {
                        description,
                        content: {
                            "application/json": { schema: payoutSchema },
                        },
                    },
                    400: {
                        description: httpDesc.badRequest,
                        content: {
                            "application/json": { schema: errorSchema },
                        },
                    },
                    401: {
                        description: httpDesc.unauthorized,
                        content: {
                            "application/json": { schema: errorSchema },
                        },
                    },
                    403: {
                        description: httpDesc.forbidden,
                        content: {
                            "application/json": { schema: errorSchema },
                        },
                    },
                    404: {
                        description: httpDesc.notFound,
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
                if (
                    !roleHasPermission(
                        sessionRole(session.user),
                        "payout",
                        permission,
                    )
                ) {
                    return c.json({ error: "forbidden" }, 403);
                }
                const { id } = c.req.valid("param");
                const result = await run(deps.db, deps.firm, id);
                if (!result.ok) {
                    if (result.error === "not found") {
                        return c.json({ error: result.error }, 404);
                    }
                    return c.json({ error: result.error }, 400);
                }
                return c.json(result.payout, 200);
            },
        );
    }

    adminAction(
        "approve",
        "approve",
        "Payout approved. Bridge withdrew from the trading account.",
        approvePayout,
    );
    adminAction(
        "reject",
        "reject",
        "Payout rejected. Approved payouts are deposited back.",
        rejectPayout,
    );
    adminAction(
        "pay",
        "pay",
        "Payout marked paid. Cash sent outside the system.",
        (db, _firm, id) => markPayoutPaid(db, id),
    );
}
