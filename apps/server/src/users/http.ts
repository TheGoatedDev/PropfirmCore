import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { Auth } from "../auth/auth.ts";
import { roleHasPermission } from "../auth/permissions.ts";
import type { Db } from "../db/db.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { actorOf } from "../http/session.ts";
import { firmRoles } from "./scope.ts";
import {
    createListedUser,
    listUsers,
    setUserBanned,
    setUserRole,
} from "./service.ts";

const idParam = z.object({ id: z.string().min(1) });
const listQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    q: z.string().optional(),
    sort: z.enum(["email", "createdAt"]).default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
    role: z.enum(firmRoles).optional(),
    banned: z.enum(["true", "false"]).optional(),
});
const userOutSchema = z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.enum(firmRoles).nullable(),
    banned: z.boolean(),
    createdAt: z.string(),
});
const listSchema = z.object({
    items: z.array(userOutSchema),
    total: z.number().int(),
});
const createBody = z.object({
    email: z.email(),
    name: z.string().min(1),
    password: z.string().min(8),
    role: z.enum(firmRoles),
});
const banBody = z.object({ banned: z.boolean() });
const roleBody = z.object({ role: z.enum(firmRoles) });

type Deps = { db: Db; auth: Auth };

export function mountUsers(app: OpenAPIHono, deps: Deps) {
    app.openapi(
        createRoute({
            method: "get",
            path: "/users",
            tags: [tags.users],
            request: { query: listQuery },
            responses: {
                200: {
                    description: "Users you can see.",
                    content: {
                        "application/json": { schema: listSchema },
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
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            const who = actorOf(session.user);
            if (!roleHasPermission(who.role, "user", "list")) {
                return c.json({ error: "forbidden" }, 403);
            }
            const query = c.req.valid("query");
            const listed = await listUsers(deps.db, {
                who,
                page: query.page,
                pageSize: query.pageSize,
                q: query.q,
                sort: query.sort,
                order: query.order,
                role: query.role,
                banned:
                    query.banned === "true"
                        ? true
                        : query.banned === "false"
                          ? false
                          : undefined,
            });
            return c.json(listed, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/users",
            tags: [tags.users],
            request: {
                body: {
                    content: { "application/json": { schema: createBody } },
                    required: true,
                },
            },
            responses: {
                200: {
                    description: "The created User.",
                    content: {
                        "application/json": { schema: userOutSchema },
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
                409: {
                    description: httpDesc.exists,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            const body = c.req.valid("json");
            const result = await createListedUser(
                deps.db,
                deps.auth,
                c.req.raw.headers,
                actorOf(session.user),
                body,
            );
            if (result.status === "forbidden") {
                return c.json({ error: "forbidden" }, 403);
            }
            if (result.status === "badRequest") {
                return c.json({ error: "invalid" }, 400);
            }
            if (result.status === "exists") {
                return c.json({ error: "exists" }, 409);
            }
            return c.json(result.user, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/users/{id}/ban",
            tags: [tags.users],
            request: {
                params: idParam,
                body: {
                    content: { "application/json": { schema: banBody } },
                    required: true,
                },
            },
            responses: {
                200: {
                    description: "The User ban flag.",
                    content: {
                        "application/json": { schema: userOutSchema },
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
            const result = await setUserBanned(
                deps.db,
                actorOf(session.user),
                c.req.valid("param").id,
                c.req.valid("json").banned,
            );
            if (result.status === "forbidden") {
                return c.json({ error: "forbidden" }, 403);
            }
            if (result.status === "notFound") {
                return c.json({ error: "not found" }, 404);
            }
            return c.json(result.user, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/users/{id}/role",
            tags: [tags.users],
            request: {
                params: idParam,
                body: {
                    content: { "application/json": { schema: roleBody } },
                    required: true,
                },
            },
            responses: {
                200: {
                    description: "The User Role.",
                    content: {
                        "application/json": { schema: userOutSchema },
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
            const result = await setUserRole(
                deps.db,
                actorOf(session.user),
                c.req.valid("param").id,
                c.req.valid("json").role,
            );
            if (result.status === "forbidden") {
                return c.json({ error: "forbidden" }, 403);
            }
            if (result.status === "notFound") {
                return c.json({ error: "not found" }, 404);
            }
            if (result.status === "badRequest") {
                return c.json({ error: "invalid" }, 400);
            }
            return c.json(result.user, 200);
        },
    );
}
