import type { TradingAccount } from "@propfirmcore/domain";
import { describe, expect, it } from "vitest";
import { applyAction, type MockBook } from "./book.ts";

const account: TradingAccount = {
    id: "a1",
    firmId: "acme",
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
    brokerId: "mock",
    brokerLogin: "a1",
    brokerPassword: "mock",
};

function book(): MockBook {
    return { account: { ...account }, frozen: false, seq: 0 };
}

describe("applyAction", () => {
    it("freeze and unfreeze", () => {
        const b = book();
        applyAction(b, { action: "freeze", accountId: "a1" });
        expect(b.frozen).toBe(true);
        expect(b.account.equity).toBe(53_000);
        applyAction(b, { action: "unfreeze", accountId: "a1" });
        expect(b.frozen).toBe(false);
    });

    it("withdraw then deposit restores equity", () => {
        const b = book();
        applyAction(b, { action: "withdraw", accountId: "a1", amount: 2400 });
        expect(b.account.equity).toBe(50_600);
        expect(b.account.dailyStartEquity).toBe(50_600);
        applyAction(b, { action: "deposit", accountId: "a1", amount: 2400 });
        expect(b.account.equity).toBe(53_000);
        expect(b.account.dailyStartEquity).toBe(53_000);
    });
});
