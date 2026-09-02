import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadFirmConfig, parseFirmConfig } from "./index.ts";

const valid = {
    name: "Acme",
    dailyClose: { tz: "America/New_York", time: "17:00" },
    products: [
        {
            id: "50k",
            name: "50k one-step",
            phases: [
                {
                    name: "eval",
                    kind: "eval",
                    balance: 50_000,
                    fee: 99,
                    ruleset: {
                        profitTarget: 3000,
                        maxDrawdown: 2500,
                        dailyDrawdown: 1000,
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
                maxDrawdown: 2500,
                dailyDrawdown: 1000,
                minTradingDays: 0,
            },
        },
    ],
    payout: { split: 0.8, mode: "debitOnApprove" as const },
};

describe("parseFirmConfig", () => {
    it("defaults modules off", () => {
        const cfg = parseFirmConfig(valid);
        expect(cfg.modules).toEqual({
            affiliates: false,
            kyc: false,
            multiBrand: false,
        });
        expect(cfg.checkout).toEqual({
            provider: "manual",
            currency: "usd",
        });
        expect(cfg.payout).toEqual({ onUncoverable: "failApprove" });
        expect(cfg.bridge).toEqual({ provider: "loopback" });
    });

    it("rejects unimplemented payout mode", () => {
        expect(() =>
            parseFirmConfig({
                ...valid,
                products: [
                    {
                        ...fundedProduct,
                        payout: { mode: "freezeUntilPaid" },
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

    it("parses firm.example.json", () => {
        const json = readFileSync(
            new URL("../../../firm.example.json", import.meta.url),
            "utf8",
        );
        expect(loadFirmConfig(json).name).toBe("Acme");
    });
});
