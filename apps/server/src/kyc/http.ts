import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { Auth } from "../auth/auth.ts";
import { roleHasPermission } from "../auth/permissions.ts";
import type { Db } from "../db/db.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { roleOf } from "../http/session.ts";
import { setKycVerified } from "../kyc.ts";

const idParam = z.object({ id: z.string().min(1) });
const body = z.object({ verified: z.boolean() });

type Deps = { db: Db; auth: Auth };

export function mountKyc(app: OpenAPIHono, deps: Deps) {
    app.openapi(
        createRoute({
            method: "post",
            path: "/users/{id}/kyc",
            tags: [tags.kyc],
            request: {
                params: idParam,
                body: {
                    content: { "application/json": { schema: body } },
                    required: true,
                },
            },
            responses: {
                200: {
                    description: "KYC flag on the User.",
                    content: {
                        "application/json": {
                            schema: z.object({
                                id: z.string(),
                                kycVerified: z.boolean(),
                            }),
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
            if (!roleHasPermission(roleOf(session.user), "kyc", "write")) {
                return c.json({ error: "forbidden" }, 403);
            }
            const { id } = c.req.valid("param");
            const { verified } = c.req.valid("json");
            const ok = await setKycVerified(deps.db, id, verified);
            if (!ok) return c.json({ error: "not found" }, 404);
            return c.json({ id, kycVerified: verified }, 200);
        },
    );
}
