import { applyPayout } from "@propfirmcore/domain";
import type { Bridge } from "./port.ts";

type Body = {
    action: "withdraw" | "deposit";
    accountId: string;
    amount: number;
};

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
    };
}
