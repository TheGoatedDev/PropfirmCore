import { describe, expect, it } from "vitest";
import {
    assembleFirm,
    defaultFirmPath,
    loadFirmFromPath,
    missingIngestKeys,
    missingInUse,
    unknownIds,
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
        expect(missingIngestKeys(cfg, { INGEST_API_KEY: "x" })).toEqual([]);
    });

    it("requires shared key when a broker has no id", () => {
        const { id: _, ...broker } = cfg.brokers[0];
        expect(missingIngestKeys({ ...cfg, brokers: [broker] }, {})).toEqual([
            "INGEST_API_KEY",
        ]);
        expect(
            missingIngestKeys(
                { ...cfg, brokers: [broker] },
                { INGEST_API_KEY: "x" },
            ),
        ).toEqual([]);
    });
});

describe("unknownIds", () => {
    it("empty when ids match live firm", () => {
        expect(unknownIds(cfg, cfg)).toEqual([]);
    });

    it("names ids not on the live firm", () => {
        expect(
            unknownIds(
                {
                    ...cfg,
                    brokers: [
                        ...cfg.brokers,
                        {
                            id: "nope",
                            name: "Nope",
                            bridge: { provider: "loopback" },
                        },
                    ],
                },
                cfg,
            ),
        ).toEqual(["broker nope"]);
    });

    it("ignores omitted ids", () => {
        const { id: _, ...broker } = cfg.brokers[0];
        expect(
            unknownIds({ ...cfg, brokers: [...cfg.brokers, broker] }, cfg),
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
                modulesKyc: cfg.modules.kyc.enabled,
                modulesKycGate: cfg.modules.kyc.gate,
                modulesMultiBrand: cfg.modules.multiBrand,
                checkoutProvider: cfg.checkout.provider,
                checkoutCurrency: cfg.checkout.currency,
                payoutOnUncoverable: cfg.payout.onUncoverable,
            },
            brokers: cfg.brokers.map((b) => ({
                id: b.id,
                name: b.name,
                bridgeProvider: b.bridge.provider,
                bridgeUrl: b.bridge.url ?? null,
            })),
            products: cfg.products.map((p) => ({
                id: p.id,
                name: p.name,
                payoutSplit: p.payout?.split ?? null,
                payoutMode: p.payout?.mode ?? null,
                payoutOnUncoverable: p.payout?.onUncoverable ?? null,
            })),
            productBrokers: cfg.products.flatMap((p) =>
                p.brokers.map((brokerId) => ({
                    productId: p.id,
                    brokerId,
                })),
            ),
            phases: cfg.products.flatMap((p) =>
                p.phases.map((ph, idx) => ({
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
