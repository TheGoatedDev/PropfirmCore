import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import {
    type FirmConfig,
    type FirmView,
    firmConfigWriteSchema,
    firmViewSchema,
} from "@propfirmcore/config";
import type { Auth } from "../auth/auth.ts";
import { roleHasPermission } from "../auth/permissions.ts";
import {
    type BrokerSecrets,
    brokerSecrets,
    loadBrokerSecrets,
} from "../brokers/credentials.ts";
import type { Db } from "../db/db.ts";
import {
    loadFirm,
    missingInUse,
    replaceFirm,
    unknownIds,
    usedIds,
} from "../firm.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { roleOf } from "../http/session.ts";

type Holder = { current: FirmConfig };

type Deps = { db: Db; auth: Auth; holder: Holder };

export function firmView(
    firm: FirmConfig,
    secrets: BrokerSecrets = brokerSecrets,
): FirmView {
    return {
        ...firm,
        brokers: firm.brokers.map((b) => {
            const s = secrets.get(b.id);
            return {
                ...b,
                hasIngestKey: Boolean(s?.ingestKeyHash),
                hasBridgeKey: Boolean(s?.bridgeKey),
            };
        }),
    };
}

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
                        "application/json": { schema: firmViewSchema },
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
            return c.json(firmView(deps.holder.current), 200);
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
                        "application/json": { schema: firmConfigWriteSchema },
                    },
                    required: true,
                },
            },
            responses: {
                200: {
                    description: "The live Firm config after replace.",
                    content: {
                        "application/json": { schema: firmViewSchema },
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
            const unknown = unknownIds(body, deps.holder.current);
            if (unknown.length) {
                return c.json(
                    { error: `unknown id: ${unknown.join(", ")}` },
                    400,
                );
            }
            const used = await usedIds(deps.db);
            const stuck = missingInUse(body, used);
            if (stuck.length) {
                return c.json({ error: `in use: ${stuck.join(", ")}` }, 400);
            }
            await replaceFirm(deps.db, body);
            const live = await loadFirm(deps.db, body.id);
            deps.holder.current = live;
            await loadBrokerSecrets(deps.db);
            return c.json(firmView(live), 200);
        },
    );
}
