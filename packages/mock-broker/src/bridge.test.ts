import type { TradingAccount } from "@propfirmcore/domain";
import { describe, expect, it } from "vitest";
import type { MockBook } from "./book.ts";
import { handleBridge } from "./bridge.ts";

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
    dailyPnls: [],
    ruleset: {
        profitTarget: 0,
        maxDrawdown: 1,
        dailyDrawdown: 1,
        minTradingDays: 0,
    },
    brokerId: "mock",
    brokerLogin: "a1",
    brokerPassword: "mock",
};

function books(): Map<string, MockBook> {
    return new Map([
        ["a1", { account: { ...account }, frozen: false, seq: 0 }],
    ]);
}

describe("handleBridge", () => {
    it("404 unknown account", () => {
        expect(
            handleBridge(books(), undefined, undefined, {
                action: "freeze",
                accountId: "missing",
            }).status,
        ).toBe(404);
    });

    it("401 wrong key", () => {
        expect(
            handleBridge(books(), "secret", "nope", {
                action: "freeze",
                accountId: "a1",
            }).status,
        ).toBe(401);
    });

    it("204 freeze when key matches", () => {
        const m = books();
        expect(
            handleBridge(m, "secret", "secret", {
                action: "freeze",
                accountId: "a1",
            }).status,
        ).toBe(204);
        expect(m.get("a1")?.frozen).toBe(true);
    });

    it("400 bad body", () => {
        expect(handleBridge(books(), undefined, undefined, {}).status).toBe(
            400,
        );
    });

    it("200 provision creates book", () => {
        const m = new Map();
        const res = handleBridge(m, undefined, undefined, {
            action: "provision",
            accountId: "new",
            balance: 50_000,
        });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ login: "new", password: "mock" });
        expect(m.get("new")?.account.balance).toBe(50_000);
    });
});
