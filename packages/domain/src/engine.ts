import type { DailyClose, Phase, Product } from "@propfirmcore/config";
import { tradingDayKey } from "./calendar.ts";
import { builtinRules, type ExistingBreach, type RuleEval } from "./rules.ts";
import type { Fill, Position, Snapshot, TradingAccount } from "./schemas.ts";

export type RuleBreach = {
    ruleId: string;
    severity: "warn" | "flag";
    subjectId: string;
    positionId?: string;
};

export type SettleClose = { positionId: string };

export type SettleResult = {
    account: TradingAccount;
    breaches: RuleBreach[];
    closes: SettleClose[];
};

export type SettleInput = {
    positions?: Position[];
    fills?: Fill[];
    existing?: ExistingBreach[];
    mayAdvance?: boolean;
};

function emptyResult(account: TradingAccount): SettleResult {
    return { account, breaches: [], closes: [] };
}

function resetToPhase(
    account: TradingAccount,
    phase: Phase,
    phaseIndex: number,
    dailyClose: DailyClose,
    now: string,
): TradingAccount {
    const key = tradingDayKey(now, dailyClose);
    return {
        id: account.id,
        firmId: account.firmId,
        userId: account.userId,
        productId: account.productId,
        phaseIndex,
        status: "active",
        startBalance: phase.balance,
        equity: phase.balance,
        balance: phase.balance,
        peakEquity: phase.balance,
        dailyStartEquity: phase.balance,
        tradingDayKey: key,
        tradingDays: [],
        dailyPnls: [],
        ruleset: phase.ruleset,
        brokerId: account.brokerId,
        brokerLogin: account.brokerLogin,
        brokerPassword: account.brokerPassword,
    };
}

export function onFundedPhase(
    account: TradingAccount,
    product: Product,
): boolean {
    return product.phases[account.phaseIndex]?.kind === "funded";
}

export function openTradingAccount(
    id: string,
    product: Product,
    dailyClose: DailyClose,
    now: string,
    userId: string,
    brokerId: string,
    firmId: string,
): TradingAccount {
    return resetToPhase(
        {
            id,
            firmId,
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
            dailyPnls: [],
            ruleset: product.phases[0].ruleset,
            brokerId,
            brokerLogin: "",
            brokerPassword: "",
        },
        product.phases[0],
        0,
        dailyClose,
        now,
    );
}

export function resyncRuleset(
    account: TradingAccount,
    product: Product,
): TradingAccount {
    const phase = product.phases[account.phaseIndex];
    if (!phase) return account;
    return { ...account, ruleset: phase.ruleset };
}

function collect(
    ruleId: string,
    evals: RuleEval[],
    existing: ExistingBreach[],
): {
    fail: boolean;
    continue: boolean;
    breaches: RuleBreach[];
    closes: SettleClose[];
} {
    const breaches: RuleBreach[] = [];
    const closes: SettleClose[] = [];
    let fail = false;
    let cont = false;
    for (const e of evals) {
        if (e.result === "fail") fail = true;
        if (e.result === "continue") cont = true;
        if (
            (e.result === "warn" || e.result === "flag") &&
            e.subjectId &&
            !existing.some(
                (x) => x.ruleId === ruleId && x.subjectId === e.subjectId,
            )
        ) {
            breaches.push({
                ruleId,
                severity: e.result,
                subjectId: e.subjectId,
                positionId: e.positionId,
            });
        }
        if (e.close && e.positionId) {
            closes.push({ positionId: e.positionId });
        }
    }
    return { fail, continue: cont, breaches, closes };
}

export function settle(
    account: TradingAccount,
    product: Product,
    dailyClose: DailyClose,
    now: string,
    input: SettleInput = {},
): SettleResult {
    if (account.status === "failed" || account.status === "passed") {
        return emptyResult(account);
    }
    const phase = product.phases[account.phaseIndex];
    const existing = input.existing ?? [];
    const ctx = {
        tradingAccount: account,
        ruleset: account.ruleset,
        dailyClose,
        positions: input.positions ?? [],
        fills: input.fills ?? [],
        existing,
    };
    const breaches: RuleBreach[] = [];
    const closes: SettleClose[] = [];
    let failed = false;
    let blocked = false;
    for (const rule of builtinRules) {
        const got = collect(rule.id, rule.evaluate(ctx), existing);
        failed = failed || got.fail;
        blocked = blocked || got.continue;
        breaches.push(...got.breaches);
        closes.push(...got.closes);
    }
    const warnCount =
        existing.filter((e) => e.severity === "warn").length +
        breaches.filter((b) => b.severity === "warn").length;
    if (
        account.ruleset.maxWarnings != null &&
        warnCount >= account.ruleset.maxWarnings
    ) {
        failed = true;
    }
    if (failed) {
        return {
            account: { ...account, status: "failed" },
            breaches,
            closes,
        };
    }
    if (blocked) return { account, breaches, closes };
    if (phase.kind === "funded") return { account, breaches, closes };
    if (input.mayAdvance === false) return { account, breaches, closes };
    const nextIndex = account.phaseIndex + 1;
    if (nextIndex < product.phases.length) {
        return {
            account: resetToPhase(
                account,
                product.phases[nextIndex],
                nextIndex,
                dailyClose,
                now,
            ),
            breaches,
            closes,
        };
    }
    return {
        account: { ...account, status: "passed" },
        breaches,
        closes,
    };
}

export function forceFail(account: TradingAccount): TradingAccount {
    return { ...account, status: "failed" };
}

export function forcePass(account: TradingAccount): TradingAccount {
    return { ...account, status: "passed" };
}

export function applySnapshot(
    account: TradingAccount,
    snapshot: Snapshot,
    product: Product,
    dailyClose: DailyClose,
    existing: ExistingBreach[] = [],
    mayAdvance = true,
): SettleResult {
    const key = tradingDayKey(snapshot.ts, dailyClose);
    const rolled = key !== account.tradingDayKey;
    const dailyPnls = rolled
        ? [
              ...account.dailyPnls,
              {
                  day: account.tradingDayKey,
                  pnl: account.equity - account.dailyStartEquity,
              },
          ]
        : account.dailyPnls;
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
            dailyPnls,
        },
        product,
        dailyClose,
        snapshot.ts,
        { positions: snapshot.positions, existing, mayAdvance },
    );
}

export function applyFills(
    account: TradingAccount,
    fills: Fill[],
    product: Product,
    dailyClose: DailyClose,
    now: string,
    existing: ExistingBreach[] = [],
    mayAdvance = true,
): SettleResult {
    if (fills.length === 0) return emptyResult(account);
    const days = new Set(account.tradingDays);
    for (const fill of fills) days.add(tradingDayKey(fill.ts, dailyClose));
    return settle(
        { ...account, tradingDays: [...days].sort() },
        product,
        dailyClose,
        now,
        { fills, existing, mayAdvance },
    );
}
