import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { permissionsSchema, roleNameSchema } from "@propfirmcore/access";
import {
    createRole,
    deleteRole,
    listRoles,
    type RoleOut,
    updateRole,
} from "@propfirmcore/access/server";
import type { Auth } from "../auth/auth.ts";
import type { Db } from "../db/db.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { actorOf } from "../http/session.ts";

const nameParam = z.object({ name: z.string().min(1) });
const roleSchema = z.object({
    name: z.string(),
    builtin: z.boolean(),
    permissions: permissionsSchema,
    userCount: z.number().int(),
});
const createBody = z.object({
    name: roleNameSchema,
    permissions: permissionsSchema,
});
const updateBody = z.object({ permissions: permissionsSchema });

// Permissions arrays are readonly in @propfirmcore/access; the wire shape is not.
type RoleWire = z.infer<typeof roleSchema>;
const wire = (role: RoleOut) => role as RoleWire;

const json = <T extends z.ZodType>(schema: T) => ({
    content: { "application/json": { schema } },
});
const err = (description: string) => ({ description, ...json(errorSchema) });

type Deps = { db: Db; auth: Auth };

export function mountRoles(app: OpenAPIHono, deps: Deps) {
    async function actor(headers: Headers) {
        const session = await deps.auth.api.getSession({ headers });
        return session ? actorOf(session.user) : null;
    }

    app.openapi(
        createRoute({
            method: "get",
            path: "/roles",
            tags: [tags.roles],
            responses: {
                200: {
                    description: "Builtin and custom Roles. Any Staff.",
                    ...json(z.array(roleSchema)),
                },
                401: err(httpDesc.unauthorized),
                403: err(httpDesc.forbidden),
            },
        }),
        async (c) => {
            const who = await actor(c.req.raw.headers);
            if (!who) return c.json({ error: "unauthorized" }, 401);
            const result = await listRoles(deps.db, deps.auth, who);
            if (result.status === "forbidden") {
                return c.json({ error: "forbidden" }, 403);
            }
            return c.json(result.roles.map(wire), 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/roles",
            tags: [tags.roles],
            request: { body: { ...json(createBody), required: true } },
            responses: {
                200: { description: "The created Role.", ...json(roleSchema) },
                400: err(httpDesc.badRequest),
                401: err(httpDesc.unauthorized),
                403: err(httpDesc.roleForbidden),
                409: err(httpDesc.exists),
            },
        }),
        async (c) => {
            const who = await actor(c.req.raw.headers);
            if (!who) return c.json({ error: "unauthorized" }, 401);
            const result = await createRole(deps.db, who, c.req.valid("json"));
            if (result.status === "forbidden") {
                return c.json({ error: "forbidden" }, 403);
            }
            if (result.status === "exists") {
                return c.json({ error: "exists" }, 409);
            }
            return c.json(wire(result.role), 200);
        },
    );

    app.openapi(
        createRoute({
            method: "put",
            path: "/roles/{name}",
            tags: [tags.roles],
            request: {
                params: nameParam,
                body: { ...json(updateBody), required: true },
            },
            responses: {
                200: { description: "The edited Role.", ...json(roleSchema) },
                400: err(httpDesc.badRequest),
                401: err(httpDesc.unauthorized),
                403: err(httpDesc.roleForbidden),
                404: err(httpDesc.notFound),
            },
        }),
        async (c) => {
            const who = await actor(c.req.raw.headers);
            if (!who) return c.json({ error: "unauthorized" }, 401);
            const result = await updateRole(
                deps.db,
                deps.auth,
                who,
                c.req.valid("param").name,
                c.req.valid("json"),
            );
            if (result.status === "forbidden") {
                return c.json({ error: "forbidden" }, 403);
            }
            if (result.status === "notFound") {
                return c.json({ error: "not found" }, 404);
            }
            return c.json(wire(result.role), 200);
        },
    );

    app.openapi(
        createRoute({
            method: "delete",
            path: "/roles/{name}",
            tags: [tags.roles],
            request: { params: nameParam },
            responses: {
                204: { description: "Deleted." },
                401: err(httpDesc.unauthorized),
                403: err(httpDesc.roleForbidden),
                404: err(httpDesc.notFound),
                409: err(httpDesc.roleInUse),
            },
        }),
        async (c) => {
            const who = await actor(c.req.raw.headers);
            if (!who) return c.json({ error: "unauthorized" }, 401);
            const result = await deleteRole(
                deps.db,
                deps.auth,
                who,
                c.req.valid("param").name,
            );
            if (result.status === "forbidden") {
                return c.json({ error: "forbidden" }, 403);
            }
            if (result.status === "notFound") {
                return c.json({ error: "not found" }, 404);
            }
            if (result.status === "inUse") {
                return c.json({ error: "role in use" }, 409);
            }
            return c.body(null, 204);
        },
    );
}
