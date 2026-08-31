import { createApiClient } from "@propfirmcore/api-client";

export const api = createApiClient("/api", { credentials: "include" });

export async function authPost(path: string, body?: Record<string, unknown>) {
    const res = await fetch(`/api${path}`, {
        method: "POST",
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) return { error: json };
    return { data: json };
}
