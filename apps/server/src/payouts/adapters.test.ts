import type { FirmConfig } from "@propfirmcore/config";
import type { TradingAccount } from "@propfirmcore/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBridge } from "./adapters.ts";

const firm = {
    brokers: [
        {
            id: "w",
            name: "W",
            bridge: { provider: "webhook", url: "https://bridge.example/hook" },
        },
    ],
} as FirmConfig;

const account = { id: "a1" } as TradingAccount;

describe("getBridge", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("webhook sends the Broker's Bridge key", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);
        const bridge = getBridge(
            firm,
            "w",
            new Map([["w", { ingestKeyHash: null, bridgeKey: "bk" }]]),
        );
        await bridge?.freeze(account);
        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe(
            "bk",
        );
    });

    it("webhook without a Bridge key sends no X-Api-Key", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);
        await getBridge(firm, "w", new Map())?.freeze(account);
        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(init.headers).not.toHaveProperty("X-Api-Key");
    });
});
