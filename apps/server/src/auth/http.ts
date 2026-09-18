import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { FirmConfig } from "@propfirmcore/config";
import type { Db } from "../db/db.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { roleOf } from "../http/session.ts";
import { kycForMe, kycVerifiedOf } from "../kyc.ts";
import type { Auth } from "./auth.ts";

const meSchema = z.object({
    id: z.string(),
    email: z.string(),
    role: z.string(),
    kycVerified: z.boolean(),
    kyc: z
        .object({
            enabled: z.boolean(),
            gate: z.enum(["payout", "funded"]),
        })
        .nullable(),
});

type Deps = { auth: Auth; db: Db; firm: FirmConfig };

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
                    kycVerified: await kycVerifiedOf(deps.db, session.user.id),
                    kyc: kycForMe(deps.firm),
                },
                200,
            );
        },
    );
    app.on(["POST", "GET"], "/auth/*", (c) => deps.auth.handler(c.req.raw));
}
