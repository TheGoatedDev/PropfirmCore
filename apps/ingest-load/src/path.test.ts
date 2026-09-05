import { describe, expect, it } from "vitest";
import { planPath } from "./path.ts";

const origin = "2026-01-15T16:00:00.000Z";
const start = 50_000;
const ruleset = {
    profitTarget: 3000,
    maxDrawdown: 2500,
    dailyDrawdown: 1000,
    minTradingDays: 4,
};

describe("planPath", () => {
    it("passEval hits target after min trading days", () => {
        const p = planPath({
            behavior: "passEval",
            startBalance: start,
            ruleset,
            originTs: origin,
        });
        const fills = p.steps.filter((s) => s.kind === "fills");
        const snaps = p.steps.filter((s) => s.kind === "snapshot");
        expect(fills).toHaveLength(4);
        expect(new Set(fills.map((f) => f.ts)).size).toBe(4);
        expect(snaps.at(-1)?.equity).toBe(53_000);
        expect(p.lastEquity).toBe(53_000);
    });

    it("blowMaxDd drops by max drawdown", () => {
        const p = planPath({
            behavior: "blowMaxDd",
            startBalance: start,
            ruleset,
            originTs: origin,
        });
        expect(
            p.steps.filter((s) => s.kind === "snapshot").at(-1)?.equity,
        ).toBe(47_500);
    });

    it("blowDailyDd drops by daily drawdown", () => {
        const p = planPath({
            behavior: "blowDailyDd",
            startBalance: start,
            ruleset,
            originTs: origin,
        });
        expect(
            p.steps.filter((s) => s.kind === "snapshot").at(-1)?.equity,
        ).toBe(49_000);
    });
});
