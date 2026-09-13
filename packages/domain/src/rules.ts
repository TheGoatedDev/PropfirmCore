import type { DailyClose, Ruleset } from "@propfirmcore/config";
import { isWeekend } from "./calendar.ts";
import type { Fill, Position, TradingAccount } from "./schemas.ts";

export type RuleResult = "pass" | "fail" | "continue" | "warn" | "flag";

export type ExistingBreach = {
    ruleId: string;
    subjectId: string;
    severity: "warn" | "flag";
};

export type RuleContext = {
    tradingAccount: TradingAccount;
    ruleset: Ruleset;
    dailyClose: DailyClose;
    positions: Position[];
    fills: Fill[];
    existing: ExistingBreach[];
};

export type RuleEval = {
    result: RuleResult;
    subjectId?: string;
    positionId?: string;
    close?: boolean;
};

export type Rule = {
    id: string;
    evaluate: (ctx: RuleContext) => RuleEval[];
};

function frac(n: number, d: number): number {
    return d === 0 ? 0 : n / d;
}

function one(result: RuleResult): RuleEval[] {
    return [{ result }];
}

export const profitTarget: Rule = {
    id: "profitTarget",
    evaluate: ({ tradingAccount, ruleset }) =>
        frac(
            tradingAccount.equity - tradingAccount.startBalance,
            tradingAccount.startBalance,
        ) >= ruleset.profitTarget
            ? one("pass")
            : one("continue"),
};

export const maxDrawdown: Rule = {
    id: "maxDrawdown",
    evaluate: ({ tradingAccount, ruleset }) =>
        frac(
            tradingAccount.startBalance - tradingAccount.equity,
            tradingAccount.startBalance,
        ) >= ruleset.maxDrawdown
            ? one("fail")
            : one("pass"),
};

export const dailyDrawdown: Rule = {
    id: "dailyDrawdown",
    evaluate: ({ tradingAccount, ruleset }) =>
        frac(
            tradingAccount.dailyStartEquity - tradingAccount.equity,
            tradingAccount.dailyStartEquity,
        ) >= ruleset.dailyDrawdown
            ? one("fail")
            : one("pass"),
};

export const minTradingDays: Rule = {
    id: "minTradingDays",
    evaluate: ({ tradingAccount, ruleset }) =>
        tradingAccount.tradingDays.length >= ruleset.minTradingDays
            ? one("pass")
            : one("continue"),
};

export const consistency: Rule = {
    id: "consistency",
    evaluate: ({ tradingAccount, ruleset, positions }) => {
        const spec = ruleset.consistency;
        if (!spec) return one("pass");
        const total = tradingAccount.equity - tradingAccount.startBalance;
        if (total <= 0) return one("pass");
        const currentDay = {
            day: tradingAccount.tradingDayKey,
            pnl: tradingAccount.equity - tradingAccount.dailyStartEquity,
        };
        const days = [...tradingAccount.dailyPnls, currentDay];
        const best =
            spec.mode === "bestDay"
                ? Math.max(...days.map((d) => d.pnl))
                : Math.max(
                      0,
                      ...positions
                          .filter((p) => p.closedAt && p.realizedPnl != null)
                          .map((p) => p.realizedPnl ?? 0),
                  );
        if (best / total <= spec.threshold) return one("pass");
        if (spec.mode === "bestDay") {
            const day =
                days.find((d) => d.pnl === best)?.day ??
                tradingAccount.tradingDayKey;
            return [
                {
                    result: spec.onBreach,
                    subjectId: day,
                    close: false,
                },
            ];
        }
        const pos = positions.find(
            (p) => p.closedAt && (p.realizedPnl ?? 0) === best,
        );
        return [
            {
                result: spec.onBreach,
                subjectId: pos?.id ?? "bestTrade",
                positionId: pos?.id,
                close: spec.closeTrade,
            },
        ];
    },
};

export const weekend: Rule = {
    id: "weekend",
    evaluate: ({ ruleset, fills, dailyClose }) => {
        const spec = ruleset.weekend;
        if (!spec) return one("pass");
        const hits = fills.filter((f) => isWeekend(f.ts, dailyClose.tz));
        if (hits.length === 0) return one("pass");
        return hits.map((f) => ({
            result: spec.onBreach,
            subjectId: f.externalId,
            positionId: f.positionId,
            close: spec.closeTrade,
        }));
    },
};

export const maxLot: Rule = {
    id: "maxLot",
    evaluate: ({ ruleset, positions }) => {
        const spec = ruleset.maxLot;
        if (!spec) return one("pass");
        const hits = positions.filter(
            (p) => p.closedAt == null && Math.abs(p.qty) >= spec.qty,
        );
        if (hits.length === 0) return one("pass");
        return hits.map((p) => ({
            result: spec.onBreach,
            subjectId: p.id,
            positionId: p.id,
            close: spec.closeTrade,
        }));
    },
};

export const builtinRules: Rule[] = [
    maxDrawdown,
    dailyDrawdown,
    profitTarget,
    minTradingDays,
    consistency,
    weekend,
    maxLot,
];
