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

    it("parses firm.example.json", () => {
        const json = readFileSync(
            new URL("../../../firm.example.json", import.meta.url),
            "utf8",
        );
        expect(loadFirmConfig(json).name).toBe("Acme");
    });
});
