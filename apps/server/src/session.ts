import type { MiddlewareHandler } from "hono";
import type { Auth } from "./auth.ts";
import { roleHasPermission } from "./permissions.ts";

export function requireSession(auth: Auth): MiddlewareHandler {
    return async (c, next) => {
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });
        if (!session) return c.json({ error: "unauthorized" }, 401);
        c.set("session", session);
        await next();
    };
}

export function requirePermission(
    auth: Auth,
    resource: string,
    action: string,
): MiddlewareHandler {
    return async (c, next) => {
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });
        if (!session) return c.json({ error: "unauthorized" }, 401);
        const role =
            (session.user as { role?: string | null }).role ?? "trader";
        if (!roleHasPermission(role, resource, action)) {
            return c.json({ error: "forbidden" }, 403);
        }
        c.set("session", session);
        await next();
    };
}
