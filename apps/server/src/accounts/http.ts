import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { FirmConfig } from "@propfirmcore/config";
import { accountSchema, forceFail, forcePass } from "@propfirmcore/domain";
import { eq } from "drizzle-orm";
import type { Auth } from "../auth.ts";
import {
    accountFromRow,
    accounts,
    accountToRow,
    type Db,
    fills,
    snapshots,
} from "../db.ts";
import { errorSchema, httpDesc } from "../http-desc.ts";
import { tags } from "../openapi.ts";
import { roleHasPermission } from "../permissions.ts";

const idParam = z.object({ id: z.string().min(1) });

type Deps = { db: Db; firm: FirmConfig; auth: Auth };

function actor(user: { id: string; role?: string | null }) {
    return { id: user.id, role: user.role ?? "trader" };
}

function canRead(
    who: { id: string; role: string },
    account: { userId: string | null },
) {
    if (account.userId === who.id) return true;
    return roleHasPermission(who.role, "account", "read");
}

export function mountAccounts(app: OpenAPIHono, deps: Deps) {
    app.openapi(
        createRoute({
            method: "get",
            path: "/products",
            tags: [tags.trader],
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
            path: "/accounts",
            tags: [tags.trader],
            responses: {
                200: {
                    description: "Trading accounts you can see.",
                    content: {
                        "application/json": { schema: z.array(accountSchema) },
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
            const who = actor(session.user);
            const rows = roleHasPermission(who.role, "account", "list")
                ? await deps.db.select().from(accounts)
                : await deps.db
                      .select()
                      .from(accounts)
                      .where(eq(accounts.userId, who.id));
            return c.json(rows.map(accountFromRow), 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/accounts/{id}",
            tags: [tags.trader],
            request: { params: idParam },
            responses: {
                200: {
                    description: "The trading account.",
                    content: { "application/json": { schema: accountSchema } },
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
                .from(accounts)
                .where(eq(accounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            const account = accountFromRow(rows[0]);
            if (!canRead(actor(session.user), account)) {
                return c.json({ error: "forbidden" }, 403);
            }
            return c.json(account, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/accounts/{id}/fills",
            tags: [tags.trader],
            request: { params: idParam },
            responses: {
                200: {
                    description: "Fills on this account.",
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
            const rows = await deps.db
                .select()
                .from(accounts)
                .where(eq(accounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            if (!canRead(actor(session.user), accountFromRow(rows[0]))) {
                return c.json({ error: "forbidden" }, 403);
            }
            const data = await deps.db
                .select()
                .from(fills)
                .where(eq(fills.accountId, id));
            return c.json(data, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/accounts/{id}/snapshots",
            tags: [tags.trader],
            request: { params: idParam },
            responses: {
                200: {
                    description: "Equity snapshots on this account.",
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
            const rows = await deps.db
                .select()
                .from(accounts)
                .where(eq(accounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            if (!canRead(actor(session.user), accountFromRow(rows[0]))) {
                return c.json({ error: "forbidden" }, 403);
            }
            const data = await deps.db
                .select()
                .from(snapshots)
                .where(eq(snapshots.accountId, id));
            return c.json(data, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/accounts/{id}/fail",
            tags: [tags.admin],
            request: { params: idParam },
            responses: {
                200: {
                    description: "The account is now failed.",
                    content: { "application/json": { schema: accountSchema } },
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
                !roleHasPermission(actor(session.user).role, "account", "fail")
            ) {
                return c.json({ error: "forbidden" }, 403);
            }
            const { id } = c.req.valid("param");
            const rows = await deps.db
                .select()
                .from(accounts)
                .where(eq(accounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            const account = forceFail(accountFromRow(rows[0]));
            await deps.db
                .update(accounts)
                .set(accountToRow(account))
                .where(eq(accounts.id, id));
            return c.json(account, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/accounts/{id}/pass",
            tags: [tags.admin],
            request: { params: idParam },
            responses: {
                200: {
                    description: "The account is now passed.",
                    content: { "application/json": { schema: accountSchema } },
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
                !roleHasPermission(actor(session.user).role, "account", "pass")
            ) {
                return c.json({ error: "forbidden" }, 403);
            }
            const { id } = c.req.valid("param");
            const rows = await deps.db
                .select()
                .from(accounts)
                .where(eq(accounts.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            const account = forcePass(accountFromRow(rows[0]));
            await deps.db
                .update(accounts)
                .set(accountToRow(account))
                .where(eq(accounts.id, id));
            return c.json(account, 200);
        },
    );
}
