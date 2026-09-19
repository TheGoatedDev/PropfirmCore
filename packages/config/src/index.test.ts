import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    ingestKeyEnvName,
    loadFirmConfig,
    parseFirmConfig,
    parseFirmConfigWrite,
} from "./index.ts";

const valid = {
    id: "acme",
    name: "Acme",
    dailyClose: { tz: "America/New_York", time: "17:00" },
    brokers: [
        { id: "loopback", name: "Loopback", bridge: { provider: "loopback" } },
    ],
    products: [
        {
            id: "50k",
            name: "50k one-step",
            brokers: ["loopback"],
            phases: [
                {
                    name: "eval",
                    kind: "eval",
                    balance: 50_000,
                    fee: 99,
                    ruleset: {
                        profitTarget: 0.06,
                        maxDrawdown: 0.05,
                        dailyDrawdown: 0.02,
                        minTradingDays: 4,
                    },
                },
            ],
        },
    ],
};

const fundedProduct = {
    ...valid.products[0],
    phases: [
        ...valid.products[0].phases,
        {
            name: "funded",
            kind: "funded" as const,
            balance: 50_000,
            ruleset: {
                profitTarget: 0,
                maxDrawdown: 0.05,
                dailyDrawdown: 0.02,
                minTradingDays: 0,
            },
        },
    ],
    payout: { split: 0.8, mode: "debitOnApprove" as const },
};

describe("parseFirmConfig", () => {
    it("defaults kyc gate payout when enabled omitted", () => {
        const cfg = parseFirmConfig({
            ...valid,
            modules: {
                affiliates: false,
                kyc: { enabled: true },
                multiBrand: false,
            },
        });
        expect(cfg.modules.kyc).toEqual({ enabled: true, gate: "payout" });
    });

    it("defaults modules off", () => {
        const cfg = parseFirmConfig(valid);
        expect(cfg.modules).toEqual({
            affiliates: false,
            kyc: { enabled: false, gate: "payout" },
            multiBrand: false,
        });
        expect(cfg.checkout).toEqual({
            provider: "manual",
            currency: "usd",
        });
        expect(cfg.payout).toEqual({ onUncoverable: "failApprove" });
        expect(cfg.brokers).toEqual([
            {
                id: "loopback",
                name: "Loopback",
                bridge: { provider: "loopback" },
            },
        ]);
    });

    it("rejects webhook bridge without url", () => {
        expect(() =>
            parseFirmConfig({
                ...valid,
                brokers: [
                    { id: "w", name: "W", bridge: { provider: "webhook" } },
                ],
                products: [{ ...valid.products[0], brokers: ["w"] }],
            }),
        ).toThrow();
    });

    it("parses webhook bridge with url", () => {
        const cfg = parseFirmConfig({
            ...valid,
            brokers: [
                {
                    id: "w",
                    name: "W",
                    bridge: {
                        provider: "webhook",
                        url: "https://bridge.example/hook",
                    },
                },
            ],
            products: [{ ...valid.products[0], brokers: ["w"] }],
        });
        expect(cfg.brokers[0]?.bridge).toEqual({
            provider: "webhook",
            url: "https://bridge.example/hook",
        });
    });

    it("rejects unknown product broker", () => {
        expect(() =>
            parseFirmConfig({
                ...valid,
                products: [{ ...valid.products[0], brokers: ["nope"] }],
            }),
        ).toThrow();
    });

    it("rejects duplicate broker id", () => {
        expect(() =>
            parseFirmConfig({
                ...valid,
                brokers: [...valid.brokers, ...valid.brokers],
            }),
        ).toThrow();
    });

    it("accepts freezeUntilApproved", () => {
        const cfg = parseFirmConfig({
            ...valid,
            products: [
                {
                    ...fundedProduct,
                    payout: { mode: "freezeUntilApproved" },
                },
            ],
        });
        expect(cfg.products[0].payout?.mode).toBe("freezeUntilApproved");
    });

    it("rejects unknown payout mode", () => {
        expect(() =>
            parseFirmConfig({
                ...valid,
                products: [
                    {
                        ...fundedProduct,
                        payout: { mode: "debitOnPaid" },
                    },
                ],
            }),
        ).toThrow();
    });

    it("product onUncoverable overrides firm", () => {
        const cfg = parseFirmConfig({
            ...valid,
            payout: { onUncoverable: "failApprove" },
            products: [
                {
                    ...fundedProduct,
                    payout: { split: 0.8, onUncoverable: "autoReject" },
                },
            ],
        });
        expect(cfg.products[0].payout?.onUncoverable).toBe("autoReject");
    });

    it("rejects bad close time", () => {
        expect(() =>
            parseFirmConfig({
                ...valid,
                dailyClose: { tz: "UTC", time: "25:00" },
            }),
        ).toThrow();
    });

    it("loads json", () => {
        expect(loadFirmConfig(JSON.stringify(valid)).name).toBe("Acme");
    });

    it("rejects funded without payout spec", () => {
        expect(() =>
            parseFirmConfig({
                ...valid,
                products: [{ ...fundedProduct, payout: undefined }],
            }),
        ).toThrow();
    });

    it("rejects payout spec without funded phase", () => {
        expect(() =>
            parseFirmConfig({
                ...valid,
                products: [{ ...valid.products[0], payout: { split: 0.8 } }],
            }),
        ).toThrow();
    });

    it("ingest key env name", () => {
        expect(ingestKeyEnvName("loopback")).toBe("INGEST_API_KEY_LOOPBACK");
        expect(ingestKeyEnvName("mt5-live")).toBe("INGEST_API_KEY_MT5_LIVE");
    });

    it("write schema allows omitted broker and product ids", () => {
        const { id: _b, ...broker } = valid.brokers[0];
        const { id: _p, ...product } = valid.products[0];
        const cfg = parseFirmConfigWrite({
            ...valid,
            brokers: [broker, valid.brokers[0]],
            products: [product],
        });
        expect(cfg.brokers[0]?.id).toBeUndefined();
        expect(cfg.products[0]?.id).toBeUndefined();
    });

    it("write schema rejects unknown broker refs", () => {
        const { id: _p, ...product } = valid.products[0];
        expect(() =>
            parseFirmConfigWrite({
                ...valid,
                products: [{ ...product, brokers: ["nope"] }],
            }),
        ).toThrow();
    });

    it("parses firm.example.json", () => {
        const json = readFileSync(
            new URL("../firm.example.json", import.meta.url),
            "utf8",
        );
        expect(loadFirmConfig(json).name).toBe("Acme");
    });
});
