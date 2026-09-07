import { timingSafeEqual } from "node:crypto";
import { type FirmConfig, ingestKeyEnvName } from "@propfirmcore/config";
import type { MiddlewareHandler } from "hono";

export function apiKeyEqual(got: string, want: string): boolean {
    const a = Buffer.from(got);
    const b = Buffer.from(want);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

export function ingestKeysFromEnv(
    firm: FirmConfig,
    env: NodeJS.Dict<string> = process.env,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const b of firm.brokers) {
        const name = ingestKeyEnvName(b.id);
        const v = env[name];
        if (!v) throw new Error(`missing ${name}`);
        out[b.id] = v;
    }
    return out;
}

export function matchIngestKey(
    keys: Record<string, string>,
    got: string | undefined,
): string | undefined {
    if (!got) return undefined;
    for (const [id, want] of Object.entries(keys)) {
        if (apiKeyEqual(got, want)) return id;
    }
    return undefined;
}

export function requireIngestKey(
    keys: Record<string, string>,
): MiddlewareHandler {
    return async (c, next) => {
        const id = matchIngestKey(keys, c.req.header("x-api-key"));
        if (!id) return c.json({ error: "unauthorized" }, 401);
        await next();
    };
}
