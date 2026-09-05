import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { roleOf } from "../http/session.ts";
import type { Auth } from "./auth.ts";

const meSchema = z.object({
    id: z.string(),
    email: z.string(),
    role: z.string(),
});

type Deps = { auth: Auth };

export function mountAuth(app: OpenAPIHono, deps: Deps) {
    app.openapi(
        createRoute({
            method: "get",
            path: "/auth/me",
            tags: [tags.authentication],
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
            return c.json(
                {
                    id: session.user.id,
                    email: session.user.email,
                    role: roleOf(session.user),
                },
                200,
            );
        },
    );
    app.on(["POST", "GET"], "/auth/*", (c) => deps.auth.handler(c.req.raw));
}
