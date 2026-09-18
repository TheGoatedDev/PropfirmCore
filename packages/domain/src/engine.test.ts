import type { DailyClose, Product } from "@propfirmcore/config";
import { describe, expect, it } from "vitest";
import { tradingDayKey } from "./calendar.ts";
import {
    applyFills,
    applySnapshot,
    forceFail,
    forcePass,
    onFundedPhase,
    openTradingAccount,
    resyncRuleset,
} from "./engine.ts";
import { applyPayout } from "./payout.ts";
import type { Fill, Snapshot } from "./schemas.ts";

const dailyClose: DailyClose = { tz: "America/New_York", time: "17:00" };

const oneStep: Product = {
    id: "1step",
    name: "50k",
    brokers: ["loopback"],
    phases: [
        {
            name: "eval",
            kind: "eval",
            balance: 50_000,
            ruleset: {
                profitTarget: 0.06,
                maxDrawdown: 0.05,
                dailyDrawdown: 0.02,
                minTradingDays: 2,
            },
        },
    ],
};

const twoStep: Product = {
    id: "2step",
    name: "50k 2-step",
    brokers: ["loopback"],
    phases: [
        {
            name: "eval",
            kind: "eval",
            balance: 50_000,
            ruleset: {
                profitTarget: 0.06,
                maxDrawdown: 0.05,
                dailyDrawdown: 0.02,
                minTradingDays: 0,
            },
        },
        {
            name: "funded",
            kind: "funded",
            balance: 50_000,
            ruleset: {
                profitTarget: 0.06,
                maxDrawdown: 0.05,
                dailyDrawdown: 0.02,
                minTradingDays: 0,
            },
        },
    ],
};

const t0 = "2026-01-15T16:00:00.000Z";

function snap(equity: number, ts = t0): Snapshot {
    return {
        externalId: `s-${equity}-${ts}`,
        equity,
        balance: equity,
        ts,
        positions: [],
    };
}

function fill(ts: string, id: string): Fill {
    return {
        externalId: id,
        positionId: id,
        symbol: "EURUSD",
        class: "fx",
        qty: 1,
        price: 1.1,
        side: "buy",
        ts,
        multiplier: 100_000,
        tickSize: 0.00001,
        currency: "USD",
    };
}

describe("tradingDayKey", () => {
    it("rolls at daily close", () => {
        expect(tradingDayKey("2026-01-15T21:59:00.000Z", dailyClose)).toBe(
            "2026-01-15",
        );
        expect(tradingDayKey("2026-01-15T22:00:00.000Z", dailyClose)).toBe(
            "2026-01-16",
        );
    });
});

describe("engine", () => {
    it("opens eval as active at phase balance", () => {
        const a = openTradingAccount(
            "a1",
            oneStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        expect(a.status).toBe("active");
        expect(a.startBalance).toBe(50_000);
        expect(a.equity).toBe(50_000);
        expect(a.userId).toBe("u1");
    });

    it("fails on max drawdown", () => {
        const a = openTradingAccount(
            "a1",
            oneStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const next = applySnapshot(
            a,
            snap(47_500),
            oneStep,
            dailyClose,
        ).account;
        expect(next.status).toBe("failed");
    });

    it("fails on daily drawdown", () => {
        const a = openTradingAccount(
            "a1",
            oneStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const next = applySnapshot(
            a,
            snap(49_000),
            oneStep,
            dailyClose,
        ).account;
        expect(next.status).toBe("failed");
    });

    it("holds pass until min trading days", () => {
        const a = openTradingAccount(
            "a1",
            oneStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const rich = applySnapshot(
            a,
            snap(53_000),
            oneStep,
            dailyClose,
        ).account;
        expect(rich.status).toBe("active");
        const d1 = applyFills(
            rich,
            [fill(t0, "f1")],
            oneStep,
            dailyClose,
            t0,
        ).account;
        expect(d1.status).toBe("active");
        const d2 = applyFills(
            d1,
            [fill("2026-01-16T16:00:00.000Z", "f2")],
            oneStep,
            dailyClose,
            "2026-01-16T16:00:00.000Z",
        ).account;
        expect(d2.status).toBe("passed");
    });

    it("advances eval to funded phase, stays active", () => {
        const a = openTradingAccount(
            "a1",
            twoStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const next = applySnapshot(
            a,
            snap(53_000),
            twoStep,
            dailyClose,
        ).account;
        expect(next.status).toBe("active");
        expect(next.phaseIndex).toBe(1);
        expect(next.equity).toBe(50_000);
        expect(next.tradingDays).toEqual([]);
    });

    it("mayAdvance false keeps eval after profit target", () => {
        const a = openTradingAccount(
            "a1",
            twoStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const next = applySnapshot(
            a,
            snap(53_000),
            twoStep,
            dailyClose,
            [],
            false,
        ).account;
        expect(next.status).toBe("active");
        expect(next.phaseIndex).toBe(0);
        expect(next.equity).toBe(53_000);
    });

    it("stays on funded phase when profit target hits", () => {
        const a = openTradingAccount(
            "a1",
            twoStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const funded = applySnapshot(
            a,
            snap(53_000),
            twoStep,
            dailyClose,
        ).account;
        const rich = applySnapshot(
            funded,
            snap(53_000),
            twoStep,
            dailyClose,
        ).account;
        expect(rich.status).toBe("active");
        expect(rich.phaseIndex).toBe(1);
    });

    it("rolls daily window at close", () => {
        const a = openTradingAccount(
            "a1",
            oneStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const day1 = applySnapshot(
            a,
            snap(49_500, t0),
            oneStep,
            dailyClose,
        ).account;
        expect(day1.status).toBe("active");
        expect(day1.dailyStartEquity).toBe(50_000);
        const day2 = applySnapshot(
            day1,
            snap(49_500, "2026-01-15T22:00:00.000Z"),
            oneStep,
            dailyClose,
        ).account;
        expect(day2.status).toBe("active");
        expect(day2.dailyStartEquity).toBe(49_500);
    });

    it("onFundedPhase follows phase kind", () => {
        const evalBook = openTradingAccount(
            "a1",
            twoStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        expect(onFundedPhase(evalBook, twoStep)).toBe(false);
        const funded = applySnapshot(
            evalBook,
            snap(53_000),
            twoStep,
            dailyClose,
        ).account;
        expect(onFundedPhase(funded, twoStep)).toBe(true);
        expect(onFundedPhase(funded, oneStep)).toBe(false);
    });

    it("net snapshot without applyPayout fails daily dd", () => {
        const a = openTradingAccount(
            "a1",
            twoStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const funded = applySnapshot(
            a,
            snap(53_000),
            twoStep,
            dailyClose,
        ).account;
        const rich = applySnapshot(
            funded,
            snap(53_000),
            twoStep,
            dailyClose,
        ).account;
        const peak = applySnapshot(
            rich,
            snap(53_000, "2026-01-15T22:00:00.000Z"),
            twoStep,
            dailyClose,
        ).account;
        const next = applySnapshot(
            peak,
            snap(50_600, "2026-01-15T22:00:00.000Z"),
            twoStep,
            dailyClose,
        ).account;
        expect(next.status).toBe("failed");
    });

    it("applyPayout then net snapshot stays active", () => {
        const a = openTradingAccount(
            "a1",
            twoStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const funded = applySnapshot(
            a,
            snap(53_000),
            twoStep,
            dailyClose,
        ).account;
        const rich = applySnapshot(
            funded,
            snap(53_000),
            twoStep,
            dailyClose,
        ).account;
        const peak = applySnapshot(
            rich,
            snap(53_000, "2026-01-15T22:00:00.000Z"),
            twoStep,
            dailyClose,
        ).account;
        const debited = applyPayout(peak, 2400);
        const next = applySnapshot(
            debited,
            snap(50_600, "2026-01-15T22:00:00.000Z"),
            twoStep,
            dailyClose,
        ).account;
        expect(next.status).toBe("active");
        expect(next.dailyStartEquity).toBe(50_600);
    });

    it("pins ruleset; product edit does not apply", () => {
        const product: Product = {
            ...oneStep,
            phases: [
                {
                    ...oneStep.phases[0],
                    ruleset: {
                        profitTarget: 0,
                        maxDrawdown: 0.05,
                        dailyDrawdown: 1,
                        minTradingDays: 0,
                    },
                },
            ],
        };
        const a = openTradingAccount(
            "a1",
            product,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const tight: Product = {
            ...product,
            phases: [
                {
                    ...product.phases[0],
                    ruleset: {
                        ...product.phases[0].ruleset,
                        maxDrawdown: 0.01,
                    },
                },
            ],
        };
        expect(
            applySnapshot(a, snap(49_000), tight, dailyClose).account.status,
        ).toBe("active");
        const resynced = resyncRuleset(a, tight);
        expect(resynced.ruleset.maxDrawdown).toBe(0.01);
        expect(
            applySnapshot(resynced, snap(49_000), tight, dailyClose).account
                .status,
        ).toBe("failed");
    });

    it("weekend fill with warn does not fail or block pass", () => {
        const product: Product = {
            ...oneStep,
            phases: [
                {
                    ...oneStep.phases[0],
                    ruleset: {
                        ...oneStep.phases[0].ruleset,
                        minTradingDays: 0,
                        weekend: { onBreach: "warn", closeTrade: true },
                    },
                },
            ],
        };
        const a = openTradingAccount(
            "a1",
            product,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const sat = "2026-01-17T16:00:00.000Z";
        const filled = applyFills(
            a,
            [fill(sat, "f1")],
            product,
            dailyClose,
            sat,
        );
        expect(filled.account.status).toBe("active");
        expect(filled.breaches).toEqual([
            {
                ruleId: "weekend",
                severity: "warn",
                subjectId: "f1",
                positionId: "f1",
            },
        ]);
        expect(filled.closes).toEqual([{ positionId: "f1" }]);
        const rich = applySnapshot(
            filled.account,
            snap(53_000, sat),
            product,
            dailyClose,
        );
        expect(rich.account.status).toBe("passed");
    });

    it("max lot fail closes overweight position", () => {
        const product: Product = {
            ...oneStep,
            phases: [
                {
                    ...oneStep.phases[0],
                    ruleset: {
                        ...oneStep.phases[0].ruleset,
                        minTradingDays: 0,
                        maxLot: { qty: 2, onBreach: "fail", closeTrade: true },
                    },
                },
            ],
        };
        const a = openTradingAccount(
            "a1",
            product,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const result = applySnapshot(
            a,
            {
                ...snap(50_000),
                positions: [
                    {
                        id: "p1",
                        symbol: "EURUSD",
                        class: "fx",
                        qty: 2,
                        avgPrice: 1.1,
                        openedAt: t0,
                        closedAt: null,
                    },
                ],
            },
            product,
            dailyClose,
        );
        expect(result.account.status).toBe("failed");
        expect(result.closes).toEqual([{ positionId: "p1" }]);
    });

    it("consistency bestDay warn; maxWarnings fails", () => {
        const product: Product = {
            ...oneStep,
            phases: [
                {
                    ...oneStep.phases[0],
                    ruleset: {
                        profitTarget: 0,
                        maxDrawdown: 1,
                        dailyDrawdown: 1,
                        minTradingDays: 0,
                        maxWarnings: 1,
                        consistency: {
                            mode: "bestDay",
                            threshold: 0.4,
                            onBreach: "warn",
                            closeTrade: false,
                        },
                    },
                },
            ],
        };
        const a = openTradingAccount(
            "a1",
            product,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        const rich = applySnapshot(a, snap(53_000), product, dailyClose);
        expect(rich.account.status).toBe("failed");
        expect(rich.breaches[0]?.ruleId).toBe("consistency");
        expect(rich.breaches[0]?.severity).toBe("warn");
    });

    it("force fail and pass", () => {
        const a = openTradingAccount(
            "a1",
            oneStep,
            dailyClose,
            t0,
            "u1",
            "loopback",
        );
        expect(forceFail(a).status).toBe("failed");
        expect(forcePass(a).status).toBe("passed");
        expect(forceFail(a).userId).toBe("u1");
    });
});
