import type { DailyClose, Phase, Product } from "@propfirmcore/config";
import { tradingDayKey } from "./calendar.ts";
import { builtinRules } from "./rules.ts";
import type { Account, Fill, Snapshot } from "./schemas.ts";

function resetToPhase(
    account: Account,
    phase: Phase,
    phaseIndex: number,
    dailyClose: DailyClose,
    now: string,
): Account {
    const key = tradingDayKey(now, dailyClose);
    return {
        id: account.id,
        userId: account.userId,
        productId: account.productId,
        phaseIndex,
        status: phase.kind === "funded" ? "funded" : "active",
        startBalance: phase.balance,
        equity: phase.balance,
        balance: phase.balance,
        peakEquity: phase.balance,
        dailyStartEquity: phase.balance,
        tradingDayKey: key,
        tradingDays: [],
    };
}

export function openAccount(
    id: string,
    product: Product,
    dailyClose: DailyClose,
    now: string,
    userId: string | null = null,
): Account {
    return resetToPhase(
        {
            id,
            userId,
            productId: product.id,
            phaseIndex: 0,
            status: "active",
            startBalance: 0,
            equity: 0,
            balance: 0,
            peakEquity: 0,
            dailyStartEquity: 0,
            tradingDayKey: "",
            tradingDays: [],
        },
        product.phases[0],
        0,
        dailyClose,
        now,
    );
}

export function settle(
    account: Account,
    product: Product,
    dailyClose: DailyClose,
    now: string,
): Account {
    if (account.status === "failed" || account.status === "passed") {
        return account;
    }
    const phase = product.phases[account.phaseIndex];
    const ctx = { account, ruleset: phase.ruleset };
    const results = builtinRules.map((r) => r.evaluate(ctx));
    if (results.includes("fail")) return { ...account, status: "failed" };
    if (!results.every((r) => r === "pass")) return account;
    if (phase.kind === "funded") return account;
    const nextIndex = account.phaseIndex + 1;
    if (nextIndex < product.phases.length) {
        return resetToPhase(
            account,
            product.phases[nextIndex],
            nextIndex,
            dailyClose,
            now,
        );
    }
    return { ...account, status: "passed" };
}

export function forceFail(account: Account): Account {
    return { ...account, status: "failed" };
}

export function forcePass(account: Account): Account {
    return { ...account, status: "passed" };
}

export function applySnapshot(
    account: Account,
    snapshot: Snapshot,
    product: Product,
    dailyClose: DailyClose,
): Account {
    const key = tradingDayKey(snapshot.ts, dailyClose);
    const rolled = key !== account.tradingDayKey;
    return settle(
        {
            ...account,
            equity: snapshot.equity,
            balance: snapshot.balance,
            peakEquity: Math.max(account.peakEquity, snapshot.equity),
            tradingDayKey: key,
            dailyStartEquity: rolled
                ? snapshot.equity
                : account.dailyStartEquity,
        },
        product,
        dailyClose,
        snapshot.ts,
    );
}

export function applyFills(
    account: Account,
    fills: Fill[],
    product: Product,
    dailyClose: DailyClose,
    now: string,
): Account {
    if (fills.length === 0) return account;
    const days = new Set(account.tradingDays);
    for (const fill of fills) days.add(tradingDayKey(fill.ts, dailyClose));
    return settle(
        { ...account, tradingDays: [...days].sort() },
        product,
        dailyClose,
        now,
    );
}
