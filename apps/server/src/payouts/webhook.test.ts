import type { TradingAccount } from "@propfirmcore/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebhookBridge } from "./webhook.ts";

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
    brokerId: "loopback",
    brokerLogin: "a1",
    brokerPassword: "loopback",
};

describe("webhookBridge", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("withdraw posts then applyPayout", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);
        const bridge = createWebhookBridge(
            "https://bridge.example/hook",
            "secret",
        );
        const down = await bridge.withdraw(account, 2400);
        expect(down.equity).toBe(50_600);
        expect(down.status).toBe("active");
        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://bridge.example/hook");
        expect(init.method).toBe("POST");
        expect(init.headers).toEqual({
            "content-type": "application/json",
            "X-Api-Key": "secret",
        });
        expect(JSON.parse(init.body as string)).toEqual({
            action: "withdraw",
            accountId: "a1",
            amount: 2400,
        });
    });

    it("deposit posts then restores equity", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);
        const bridge = createWebhookBridge("https://bridge.example/hook");
        const down = await bridge.withdraw(account, 2400);
        const up = await bridge.deposit(down, 2400);
        expect(up.equity).toBe(53_000);
        expect(up.dailyStartEquity).toBe(53_000);
        expect(
            JSON.parse(
                (fetchMock.mock.calls[1] as [string, RequestInit])[1]
                    .body as string,
            ),
        ).toEqual({
            action: "deposit",
            accountId: "a1",
            amount: 2400,
        });
        expect(
            (fetchMock.mock.calls[1] as [string, RequestInit])[1].headers,
        ).toEqual({ "content-type": "application/json" });
    });

    it("freeze posts without applyPayout", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);
        const bridge = createWebhookBridge(
            "https://bridge.example/hook",
            "secret",
        );
        await bridge.freeze(account);
        expect(account.equity).toBe(53_000);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            action: "freeze",
            accountId: "a1",
        });
    });

    it("unfreeze posts without applyPayout", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);
        const bridge = createWebhookBridge("https://bridge.example/hook");
        await bridge.unfreeze(account);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            action: "unfreeze",
            accountId: "a1",
        });
    });

    it("close posts position id", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);
        const bridge = createWebhookBridge("https://bridge.example/hook");
        await bridge.close(account, "p1");
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            action: "close",
            accountId: "a1",
            positionId: "p1",
        });
    });

    it("does not applyPayout on non-2xx", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
        );
        const bridge = createWebhookBridge("https://bridge.example/hook");
        await expect(bridge.withdraw(account, 2400)).rejects.toThrow(
            "bridge 500",
        );
    });

    it("does not applyPayout on network fail", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
        const bridge = createWebhookBridge("https://bridge.example/hook");
        await expect(bridge.withdraw(account, 2400)).rejects.toThrow("offline");
    });

    it("provision returns login", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ login: "mt5", password: "pw" }), {
                status: 200,
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const bridge = createWebhookBridge("https://bridge.example/hook");
        await expect(bridge.provision(account, 50_000)).resolves.toEqual({
            login: "mt5",
            password: "pw",
        });
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            action: "provision",
            accountId: "a1",
            balance: 50_000,
        });
    });

    it("provision rejects bad body", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
        );
        const bridge = createWebhookBridge("https://bridge.example/hook");
        await expect(bridge.provision(account, 50_000)).rejects.toThrow(
            "bridge bad provision",
        );
    });
});
