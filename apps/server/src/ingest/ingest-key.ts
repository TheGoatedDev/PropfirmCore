import type { MiddlewareHandler } from "hono";
import { type BrokerSecrets, matchIngestKey } from "../brokers/credentials.ts";

export function requireIngestKey(secrets: BrokerSecrets): MiddlewareHandler {
    return async (c, next) => {
        const id = matchIngestKey(secrets, c.req.header("x-api-key"));
        if (!id) return c.json({ error: "unauthorized" }, 401);
        await next();
    };
}
