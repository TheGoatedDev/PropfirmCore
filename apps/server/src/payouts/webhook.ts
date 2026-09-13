import { applyPayout } from "@propfirmcore/domain";
import type { Bridge } from "./port.ts";

type Body =
    | { action: "withdraw" | "deposit"; accountId: string; amount: number }
    | { action: "freeze" | "unfreeze"; accountId: string }
    | { action: "provision"; accountId: string; balance: number }
    | { action: "closePosition"; accountId: string; positionId: string };

async function post(url: string, key: string | undefined, body: Body) {
    const headers: Record<string, string> = {
        "content-type": "application/json",
    };
    if (key) headers["X-Api-Key"] = key;
    const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`bridge ${res.status}`);
}

export function createWebhookBridge(url: string, key?: string): Bridge {
    return {
        async withdraw(account, amount) {
            await post(url, key, {
                action: "withdraw",
                accountId: account.id,
                amount,
            });
            return applyPayout(account, amount);
        },
        async deposit(account, amount) {
            await post(url, key, {
                action: "deposit",
                accountId: account.id,
                amount,
            });
            return applyPayout(account, -amount);
        },
        async freeze(account) {
            await post(url, key, { action: "freeze", accountId: account.id });
        },
        async unfreeze(account) {
            await post(url, key, { action: "unfreeze", accountId: account.id });
        },
        async provision(account, balance) {
            const headers: Record<string, string> = {
                "content-type": "application/json",
            };
            if (key) headers["X-Api-Key"] = key;
            const res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    action: "provision",
                    accountId: account.id,
                    balance,
                }),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`bridge ${res.status}`);
            const json: unknown = await res.json();
            if (
                !json ||
                typeof json !== "object" ||
                !("login" in json) ||
                !("password" in json) ||
                typeof json.login !== "string" ||
                typeof json.password !== "string"
            ) {
                throw new Error("bridge bad provision");
            }
            return { login: json.login, password: json.password };
        },
        async closePosition(account, positionId) {
            await post(url, key, {
                action: "closePosition",
                accountId: account.id,
                positionId,
            });
        },
    };
}
