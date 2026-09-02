import { describe, expect, it } from "vitest";
import { applyPayout, availablePayout, reservedAmount } from "./payout.ts";
import type { TradingAccount } from "./schemas.ts";

const account: TradingAccount = {
    id: "a1",
    userId: "u1",
    productId: "50k",
    phaseIndex: 1,
    status: "active",
    startBalance: 50_000,
    equity: 53_000,
    balance: 53_000,
    peakEquity: 53_000,
    dailyStartEquity: 53_000,
    tradingDayKey: "2026-01-15",
    tradingDays: [],
};

describe("availablePayout", () => {
    it("is profit times split minus reserved", () => {
        expect(availablePayout(account, 0.8, 0)).toBe(2400);
        expect(availablePayout(account, 0.8, 400)).toBe(2000);
    });

    it("floors at zero", () => {
        expect(availablePayout({ ...account, equity: 49_000 }, 0.8, 0)).toBe(0);
    });
});

describe("reservedAmount", () => {
    it("sums pending and approved", () => {
        expect(
            reservedAmount([
                {
                    id: "1",
                    status: "pending",
                    amount: 100,
                },
                {
                    id: "2",
                    status: "approved",
                    amount: 50,
                },
                {
                    id: "3",
                    status: "paid",
                    amount: 999,
                },
                {
                    id: "4",
                    status: "rejected",
                    amount: 999,
                },
            ]),
        ).toBe(150);
    });

    it("can skip one id", () => {
        expect(
            reservedAmount(
                [
                    { id: "1", status: "pending", amount: 100 },
                    { id: "2", status: "pending", amount: 50 },
                ],
                "1",
            ),
        ).toBe(50);
    });
});

describe("applyPayout", () => {
    it("debits equity balance and daily start, no status change", () => {
        const next = applyPayout(account, 2400);
        expect(next.equity).toBe(50_600);
        expect(next.balance).toBe(50_600);
        expect(next.dailyStartEquity).toBe(50_600);
        expect(next.startBalance).toBe(50_000);
        expect(next.status).toBe("active");
        expect(next.peakEquity).toBe(53_000);
    });

    it("negative amount credits", () => {
        const next = applyPayout(applyPayout(account, 2400), -2400);
        expect(next.equity).toBe(53_000);
        expect(next.dailyStartEquity).toBe(53_000);
    });
});
