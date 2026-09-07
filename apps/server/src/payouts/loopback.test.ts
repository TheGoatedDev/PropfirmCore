import type { TradingAccount } from "@propfirmcore/domain";
import { describe, expect, it } from "vitest";
import { loopbackBridge } from "./loopback.ts";

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
    brokerId: "loopback",
    brokerLogin: "a1",
    brokerPassword: "loopback",
};

describe("loopbackBridge", () => {
    it("withdraw then deposit restores equity", async () => {
        const down = await loopbackBridge.withdraw(account, 2400);
        expect(down.equity).toBe(50_600);
        expect(down.status).toBe("active");
        const up = await loopbackBridge.deposit(down, 2400);
        expect(up.equity).toBe(53_000);
        expect(up.dailyStartEquity).toBe(53_000);
    });

    it("freeze and unfreeze are no-ops", async () => {
        await loopbackBridge.freeze(account);
        await loopbackBridge.unfreeze(account);
        expect(account.equity).toBe(53_000);
    });

    it("provision returns loopback creds", async () => {
        await expect(
            loopbackBridge.provision(account, 50_000),
        ).resolves.toEqual({ login: "a1", password: "loopback" });
    });
});
