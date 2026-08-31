import type { Ruleset } from "@propfirmcore/config";
import type { TradingAccount } from "./schemas.ts";

export type RuleResult = "pass" | "fail" | "continue";

export type RuleContext = {
    tradingAccount: TradingAccount;
    ruleset: Ruleset;
};

export type Rule = {
    id: string;
    evaluate: (ctx: RuleContext) => RuleResult;
};

export const profitTarget: Rule = {
    id: "profitTarget",
    evaluate: ({ tradingAccount, ruleset }) =>
        tradingAccount.equity - tradingAccount.startBalance >=
        ruleset.profitTarget
            ? "pass"
            : "continue",
};

export const maxDrawdown: Rule = {
    id: "maxDrawdown",
    evaluate: ({ tradingAccount, ruleset }) =>
        tradingAccount.startBalance - tradingAccount.equity >=
        ruleset.maxDrawdown
            ? "fail"
            : "pass",
};

export const dailyDrawdown: Rule = {
    id: "dailyDrawdown",
    evaluate: ({ tradingAccount, ruleset }) =>
        tradingAccount.dailyStartEquity - tradingAccount.equity >=
        ruleset.dailyDrawdown
            ? "fail"
            : "pass",
};

export const minTradingDays: Rule = {
    id: "minTradingDays",
    evaluate: ({ tradingAccount, ruleset }) =>
        tradingAccount.tradingDays.length >= ruleset.minTradingDays
            ? "pass"
            : "continue",
};

export const builtinRules: Rule[] = [
    maxDrawdown,
    dailyDrawdown,
    profitTarget,
    minTradingDays,
];
