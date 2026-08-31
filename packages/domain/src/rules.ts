import type { Ruleset } from "@propfirmcore/config";
import type { Account } from "./schemas.ts";

export type RuleResult = "pass" | "fail" | "continue";

export type RuleContext = {
    account: Account;
    ruleset: Ruleset;
};

export type Rule = {
    id: string;
    evaluate: (ctx: RuleContext) => RuleResult;
};

export const profitTarget: Rule = {
    id: "profitTarget",
    evaluate: ({ account, ruleset }) =>
        account.equity - account.startBalance >= ruleset.profitTarget
            ? "pass"
            : "continue",
};

export const maxDrawdown: Rule = {
    id: "maxDrawdown",
    evaluate: ({ account, ruleset }) =>
        account.startBalance - account.equity >= ruleset.maxDrawdown
            ? "fail"
            : "pass",
};

export const dailyDrawdown: Rule = {
    id: "dailyDrawdown",
    evaluate: ({ account, ruleset }) =>
        account.dailyStartEquity - account.equity >= ruleset.dailyDrawdown
            ? "fail"
            : "pass",
};

export const minTradingDays: Rule = {
    id: "minTradingDays",
    evaluate: ({ account, ruleset }) =>
        account.tradingDays.length >= ruleset.minTradingDays
            ? "pass"
            : "continue",
};

export const builtinRules: Rule[] = [
    maxDrawdown,
    dailyDrawdown,
    profitTarget,
    minTradingDays,
];
