import { describe, expect, it } from "vitest";
import {
    assembleFirm,
    defaultFirmPath,
    loadFirmFromPath,
    missingIngestKeys,
    missingInUse,
} from "./firm.ts";

const cfg = loadFirmFromPath(defaultFirmPath());

describe("missingInUse", () => {
    it("empty when all used ids remain", () => {
        expect(
            missingInUse(cfg, {
                products: ["50k"],
                brokers: ["loopback"],
            }),
        ).toEqual([]);
    });

    it("names dropped products and brokers", () => {
        expect(
            missingInUse(cfg, {
                products: ["gone"],
                brokers: ["x"],
            }),
        ).toEqual(["product gone", "broker x"]);
    });
});

describe("missingIngestKeys", () => {
    it("lists missing env names", () => {
        expect(missingIngestKeys(cfg, {})).toEqual(["INGEST_API_KEY_LOOPBACK"]);
        expect(
            missingIngestKeys(cfg, { INGEST_API_KEY_LOOPBACK: "x" }),
        ).toEqual([]);
    });
});

describe("assembleFirm", () => {
    it("roundtrips example seed", () => {
        const assembled = assembleFirm({
            firm: {
                id: cfg.id,
                name: cfg.name,
                dailyCloseTz: cfg.dailyClose.tz,
                dailyCloseTime: cfg.dailyClose.time,
                modulesAffiliates: cfg.modules.affiliates,
                modulesKyc: cfg.modules.kyc,
                modulesMultiBrand: cfg.modules.multiBrand,
                checkoutProvider: cfg.checkout.provider,
                checkoutCurrency: cfg.checkout.currency,
                payoutOnUncoverable: cfg.payout.onUncoverable,
            },
            brokers: cfg.brokers.map((b) => ({
                firmId: cfg.id,
                id: b.id,
                name: b.name,
                bridgeProvider: b.bridge.provider,
                bridgeUrl: b.bridge.url ?? null,
            })),
            products: cfg.products.map((p) => ({
                firmId: cfg.id,
                id: p.id,
                name: p.name,
                payoutSplit: p.payout?.split ?? null,
                payoutMode: p.payout?.mode ?? null,
                payoutOnUncoverable: p.payout?.onUncoverable ?? null,
            })),
            productBrokers: cfg.products.flatMap((p) =>
                p.brokers.map((brokerId) => ({
                    firmId: cfg.id,
                    productId: p.id,
                    brokerId,
                })),
            ),
            phases: cfg.products.flatMap((p) =>
                p.phases.map((ph, idx) => ({
                    firmId: cfg.id,
                    productId: p.id,
                    idx,
                    name: ph.name,
                    kind: ph.kind,
                    balance: ph.balance,
                    fee: ph.fee ?? null,
                    profitTarget: ph.ruleset.profitTarget,
                    maxDrawdown: ph.ruleset.maxDrawdown,
                    dailyDrawdown: ph.ruleset.dailyDrawdown,
                    minTradingDays: ph.ruleset.minTradingDays,
                })),
            ),
        });
        expect(assembled).toEqual(cfg);
    });
});
