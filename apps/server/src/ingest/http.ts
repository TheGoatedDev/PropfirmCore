import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { FirmConfig } from "@propfirmcore/config";
import {
    fillSchema,
    snapshotSchema,
    tradingAccountSchema,
} from "@propfirmcore/domain";
import type { Db } from "../db/db.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { getById } from "../trading-accounts/service.ts";
import { requireApiKey } from "./ingest-key.ts";
import { ingestFills, ingestSnapshot } from "./service.ts";

const fillsBody = z.object({ fills: z.array(fillSchema).min(1) });
const idParam = z.object({ id: z.string().min(1) });

type Deps = { apiKey: string; firm: FirmConfig; db: Db };

export function mountIngest(app: OpenAPIHono, deps: Deps) {
    app.use("/ingest/*", requireApiKey(deps.apiKey));

    app.openapi(
        createRoute({
            method: "get",
            path: "/ingest/trading-accounts/{id}",
            tags: [tags.ingest],
            security: [{ apiKey: [] }],
            request: { params: idParam },
            responses: {
                200: {
                    description: "The trading account.",
                    content: {
                        "application/json": { schema: tradingAccountSchema },
                    },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const account = await getById(deps.db, id);
            if (!account) return c.json({ error: "not found" }, 404);
            return c.json(account, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/ingest/trading-accounts/{id}/snapshot",
            tags: [tags.ingest],
            security: [{ apiKey: [] }],
            request: {
                params: idParam,
                body: {
                    content: { "application/json": { schema: snapshotSchema } },
                    required: true,
                },
            },
            responses: {
                200: {
                    description:
                        "The trading account after applying the equity snapshot.",
                    content: {
                        "application/json": { schema: tradingAccountSchema },
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
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const result = await ingestSnapshot(
                deps.db,
                deps.firm,
                id,
                c.req.valid("json"),
            );
            if (!result.ok) {
                if (result.error === "not found") {
                    return c.json({ error: result.error }, 404);
                }
                return c.json({ error: result.error }, 400);
            }
            return c.json(result.account, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/ingest/trading-accounts/{id}/fills",
            tags: [tags.ingest],
            security: [{ apiKey: [] }],
            request: {
                params: idParam,
                body: {
                    content: { "application/json": { schema: fillsBody } },
                    required: true,
                },
            },
            responses: {
                200: {
                    description:
                        "The trading account after applying the fills.",
                    content: {
                        "application/json": { schema: tradingAccountSchema },
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
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const result = await ingestFills(
                deps.db,
                deps.firm,
                id,
                c.req.valid("json").fills,
            );
            if (!result.ok) {
                if (result.error === "not found") {
                    return c.json({ error: result.error }, 404);
                }
                return c.json({ error: result.error }, 400);
            }
            return c.json(result.account, 200);
        },
    );
}
