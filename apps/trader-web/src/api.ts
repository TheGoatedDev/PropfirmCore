import { createApiClient } from "@propfirmcore/api-client";

export const api = createApiClient("/api", { credentials: "include" });

export const keys = {
    me: ["me"] as const,
    products: ["products"] as const,
    accounts: ["trading-accounts"] as const,
    account: (id: string) => ["trading-accounts", id] as const,
    fills: (id: string) => ["trading-accounts", id, "fills"] as const,
    snapshots: (id: string) => ["trading-accounts", id, "snapshots"] as const,
    payouts: (id: string) => ["trading-accounts", id, "payouts"] as const,
};

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

export function failMsg(error: unknown, fallback: string) {
    if (error && typeof error === "object") {
        if ("error" in error) return String(error.error);
        if ("message" in error) return String(error.message);
    }
    return fallback;
}

export async function fetchMe() {
    const { data } = await api.GET("/auth/me");
    return data ?? null;
}
