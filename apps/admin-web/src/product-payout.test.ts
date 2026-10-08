import { productWriteSchema } from "@propfirmcore/config";
import { describe, expect, it } from "vitest";
import { productForSave } from "./product-payout.ts";

const evalPhase = {
    name: "eval",
    kind: "eval" as const,
    balance: 50_000,
    fee: 99,
    ruleset: {
        profitTarget: 0.06,
        maxDrawdown: 0.05,
        dailyDrawdown: 0.02,
        minTradingDays: 4,
    },
};
const fundedPhase = { ...evalPhase, name: "funded", kind: "funded" as const };
const payout = { split: 0.8, mode: "debitOnApprove" as const };

describe("productForSave", () => {
    it("drops the payout spec from an eval-only product", () => {
        const saved = productForSave({
            name: "Eval only",
            brokers: ["mock"],
            phases: [evalPhase],
            payout,
        });
        expect(saved.payout).toBeUndefined();
        expect(productWriteSchema.safeParse(saved).success).toBe(true);
    });

    it("keeps the payout spec when a phase is funded", () => {
        const saved = productForSave({
            name: "Two step",
            brokers: ["mock"],
            phases: [evalPhase, fundedPhase],
            payout,
        });
        expect(saved.payout).toEqual(payout);
        expect(productWriteSchema.safeParse(saved).success).toBe(true);
    });

    it("adds the default payout spec to a funded product missing one", () => {
        const saved = productForSave({
            name: "No spec",
            brokers: ["mock"],
            phases: [evalPhase, fundedPhase],
        });
        expect(saved.payout).toEqual(payout);
    });
});
