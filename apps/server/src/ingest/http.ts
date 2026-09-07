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
import { log } from "../logger.ts";
import { fillsFrozenForAccount } from "../payouts/service.ts";
import { getById } from "../trading-accounts/service.ts";
import type { IngestPublish } from "./bus.ts";
import { matchIngestKey, requireIngestKey } from "./ingest-key.ts";

const fillsBody = z.object({ fills: z.array(fillSchema).min(1) });
const idParam = z.object({ id: z.string().min(1) });
const snapshotAccepted = z.object({
    accountId: z.string(),
    externalId: z.string(),
});
const fillsAccepted = z.object({
    accountId: z.string(),
    externalIds: z.array(z.string()),
});

type Deps = {
    ingestKeys: Record<string, string>;
    db: Db;
    firm: FirmConfig;
    publish: IngestPublish;
};

export function mountIngest(app: OpenAPIHono, deps: Deps) {
    app.use("/ingest/*", requireIngestKey(deps.ingestKeys));

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
            if (
                !account ||
                account.brokerId !==
                    matchIngestKey(deps.ingestKeys, c.req.header("x-api-key"))
            ) {
                return c.json({ error: "not found" }, 404);
            }
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
                202: {
                    description: httpDesc.accepted,
                    content: {
                        "application/json": { schema: snapshotAccepted },
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
                503: {
                    description: httpDesc.unavailable,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const body = c.req.valid("json");
            const account = await getById(deps.db, id);
            if (
                !account ||
                account.brokerId !==
                    matchIngestKey(deps.ingestKeys, c.req.header("x-api-key"))
            ) {
                return c.json({ error: "not found" }, 404);
            }
            try {
                await deps.publish.snapshot({ accountId: id, ...body });
            } catch (err) {
                log.error({ err, accountId: id, kind: "snapshot" });
                return c.json({ error: "unavailable" }, 503);
            }
            return c.json({ accountId: id, externalId: body.externalId }, 202);
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
                202: {
                    description: httpDesc.accepted,
                    content: {
                        "application/json": { schema: fillsAccepted },
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
                409: {
                    description: httpDesc.conflict,
                    content: { "application/json": { schema: errorSchema } },
                },
                503: {
                    description: httpDesc.unavailable,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const { id } = c.req.valid("param");
            const body = c.req.valid("json");
            const account = await getById(deps.db, id);
            if (
                !account ||
                account.brokerId !==
                    matchIngestKey(deps.ingestKeys, c.req.header("x-api-key"))
            ) {
                return c.json({ error: "not found" }, 404);
            }
            if (await fillsFrozenForAccount(deps.db, deps.firm, account)) {
                return c.json({ error: "frozen" }, 409);
            }
            try {
                await deps.publish.fills({ accountId: id, fills: body.fills });
            } catch (err) {
                log.error({ err, accountId: id, kind: "fills" });
                return c.json({ error: "unavailable" }, 503);
            }
            return c.json(
                {
                    accountId: id,
                    externalIds: body.fills.map((f) => f.externalId),
                },
                202,
            );
        },
    );
}
