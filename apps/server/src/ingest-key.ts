import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export function apiKeyEqual(got: string, want: string): boolean {
    const a = Buffer.from(got);
    const b = Buffer.from(want);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

export function requireApiKey(key: string): MiddlewareHandler {
    return async (c, next) => {
        const got = c.req.header("x-api-key");
        if (!got || !apiKeyEqual(got, key)) {
            return c.json({ error: "unauthorized" }, 401);
        }
        await next();
    };
}
