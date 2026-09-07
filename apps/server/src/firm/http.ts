import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { firmConfigSchema } from "@propfirmcore/config";
import type { Auth } from "../auth/auth.ts";
import { roleHasPermission } from "../auth/permissions.ts";
import type { Db } from "../db/db.ts";
import {
    missingIngestKeys,
    missingInUse,
    replaceFirm,
    usedIds,
} from "../firm.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { roleOf } from "../http/session.ts";
import { ingestKeysFromEnv } from "../ingest/ingest-key.ts";

type Holder = {
    current: import("@propfirmcore/config").FirmConfig;
    ingestKeys: Record<string, string>;
};

type Deps = { db: Db; auth: Auth; holder: Holder };

export function mountFirm(app: OpenAPIHono, deps: Deps) {
    app.openapi(
        createRoute({
            method: "get",
            path: "/firm",
            tags: [tags.firm],
            responses: {
                200: {
                    description: "The live Firm config.",
                    content: {
                        "application/json": { schema: firmConfigSchema },
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
            if (!roleHasPermission(roleOf(session.user), "firm", "read")) {
                return c.json({ error: "forbidden" }, 403);
            }
            return c.json(deps.holder.current, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "put",
            path: "/firm",
            tags: [tags.firm],
            request: {
                body: {
                    content: {
                        "application/json": { schema: firmConfigSchema },
                    },
                    required: true,
                },
            },
            responses: {
                200: {
                    description: "The live Firm config after replace.",
                    content: {
                        "application/json": { schema: firmConfigSchema },
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
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            if (!roleHasPermission(roleOf(session.user), "firm", "write")) {
                return c.json({ error: "forbidden" }, 403);
            }
            const body = c.req.valid("json");
            if (body.id !== deps.holder.current.id) {
                return c.json({ error: "id is immutable" }, 400);
            }
            const keys = missingIngestKeys(body);
            if (keys.length) {
                return c.json({ error: `missing ${keys.join(", ")}` }, 400);
            }
            const used = await usedIds(deps.db, body.id);
            const stuck = missingInUse(body, used);
            if (stuck.length) {
                return c.json({ error: `in use: ${stuck.join(", ")}` }, 400);
            }
            await replaceFirm(deps.db, body);
            deps.holder.current = body;
            const next = ingestKeysFromEnv(body);
            for (const k of Object.keys(deps.holder.ingestKeys)) {
                delete deps.holder.ingestKeys[k];
            }
            Object.assign(deps.holder.ingestKeys, next);
            return c.json(body, 200);
        },
    );
}
