import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { roleHasPermission } from "@propfirmcore/access/server";
import {
    type BrokerView,
    brokerOf,
    brokerViewSchema,
    type FirmConfig,
} from "@propfirmcore/config";
import type { Context } from "hono";
import type { Auth } from "../auth/auth.ts";
import type { Db } from "../db/db.ts";
import { firmView } from "../firm/http.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { roleOf } from "../http/session.ts";
import {
    loadBrokerSecrets,
    revokeIngestKey,
    rotateIngestKey,
    setBridgeKey,
} from "./credentials.ts";

type Deps = { db: Db; auth: Auth; holder: { current: FirmConfig } };

const idParam = z.object({ id: z.string().min(1) });
const ingestKeyCreated = z.object({
    ingestKey: z
        .string()
        .describe("The new Ingest key. Shown once; store it now."),
});
const bridgeKeyBody = z.object({
    key: z
        .string()
        .min(1)
        .nullable()
        .describe("Bridge key to send as X-Api-Key. Null clears it."),
});

const errors = {
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
};

const brokerView = {
    description: "The Broker with key flags.",
    content: { "application/json": { schema: brokerViewSchema } },
};

export function mountBrokerCredentials(app: OpenAPIHono, deps: Deps) {
    async function gate(c: Context): Promise<401 | 403 | undefined> {
        const session = await deps.auth.api.getSession({
            headers: c.req.raw.headers,
        });
        if (!session) return 401;
        if (!roleHasPermission(roleOf(session.user), "broker", "credentials")) {
            return 403;
        }
        return undefined;
    }

    async function viewOf(id: string): Promise<BrokerView | undefined> {
        await loadBrokerSecrets(deps.db);
        return firmView(deps.holder.current).brokers.find((b) => b.id === id);
    }

    app.openapi(
        createRoute({
            method: "post",
            path: "/firm/brokers/{id}/ingest-key",
            tags: [tags.firm],
            summary: "Rotate a Broker's Ingest key",
            description:
                "Makes a new Ingest key and returns it once. The old key stops working now.",
            request: { params: idParam },
            responses: {
                200: {
                    description: "The new Ingest key.",
                    content: {
                        "application/json": { schema: ingestKeyCreated },
                    },
                },
                ...errors,
            },
        }),
        async (c) => {
            const denied = await gate(c);
            if (denied === 401) return c.json({ error: "unauthorized" }, 401);
            if (denied === 403) return c.json({ error: "forbidden" }, 403);
            const { id } = c.req.valid("param");
            const key = await rotateIngestKey(deps.db, id);
            if (!key) return c.json({ error: "not found" }, 404);
            await loadBrokerSecrets(deps.db);
            return c.json({ ingestKey: key }, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "delete",
            path: "/firm/brokers/{id}/ingest-key",
            tags: [tags.firm],
            summary: "Revoke a Broker's Ingest key",
            description: "Ingest for this Broker is refused until a rotate.",
            request: { params: idParam },
            responses: { 200: brokerView, ...errors },
        }),
        async (c) => {
            const denied = await gate(c);
            if (denied === 401) return c.json({ error: "unauthorized" }, 401);
            if (denied === 403) return c.json({ error: "forbidden" }, 403);
            const { id } = c.req.valid("param");
            if (!(await revokeIngestKey(deps.db, id))) {
                return c.json({ error: "not found" }, 404);
            }
            const view = await viewOf(id);
            if (!view) return c.json({ error: "not found" }, 404);
            return c.json(view, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "put",
            path: "/firm/brokers/{id}/bridge-key",
            tags: [tags.firm],
            summary: "Set or clear a Broker's Bridge key",
            description: "Only for a Broker whose bridge provider is webhook.",
            request: {
                params: idParam,
                body: {
                    content: { "application/json": { schema: bridgeKeyBody } },
                    required: true,
                },
            },
            responses: {
                200: brokerView,
                400: {
                    description: httpDesc.badRequest,
                    content: { "application/json": { schema: errorSchema } },
                },
                ...errors,
            },
        }),
        async (c) => {
            const denied = await gate(c);
            if (denied === 401) return c.json({ error: "unauthorized" }, 401);
            if (denied === 403) return c.json({ error: "forbidden" }, 403);
            const { id } = c.req.valid("param");
            const { key } = c.req.valid("json");
            const broker = brokerOf(deps.holder.current, id);
            if (!broker) return c.json({ error: "not found" }, 404);
            if (broker.bridge.provider !== "webhook" && key !== null) {
                return c.json(
                    { error: "bridge key needs a webhook bridge" },
                    400,
                );
            }
            if (!(await setBridgeKey(deps.db, id, key))) {
                return c.json({ error: "not found" }, 404);
            }
            const view = await viewOf(id);
            if (!view) return c.json({ error: "not found" }, 404);
            return c.json(view, 200);
        },
    );
}
