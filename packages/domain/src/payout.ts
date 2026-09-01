import type { Payout, TradingAccount } from "./schemas.ts";

const openStatuses = new Set(["pending", "approved"]);

export function reservedAmount(
    payouts: Pick<Payout, "id" | "status" | "amount">[],
    exceptId?: string,
): number {
    let n = 0;
    for (const p of payouts) {
        if (exceptId && p.id === exceptId) continue;
        if (openStatuses.has(p.status)) n += p.amount;
    }
    return n;
}

export function availablePayout(
    account: TradingAccount,
    split: number,
    reserved: number,
): number {
    return Math.max(
        0,
        (account.equity - account.startBalance) * split - reserved,
    );
}

export function applyPayout(
    account: TradingAccount,
    amount: number,
): TradingAccount {
    return {
        ...account,
        equity: account.equity - amount,
        balance: account.balance - amount,
        dailyStartEquity: account.dailyStartEquity - amount,
    };
}
