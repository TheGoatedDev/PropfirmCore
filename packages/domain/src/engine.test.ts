import type { DailyClose, Product } from "@propfirmcore/config";
import { describe, expect, it } from "vitest";
import { tradingDayKey } from "./calendar.ts";
import { applyFills, applySnapshot, openAccount } from "./engine.ts";
import type { Fill, Snapshot } from "./schemas.ts";

const dailyClose: DailyClose = { tz: "America/New_York", time: "17:00" };

const oneStep: Product = {
    id: "1step",
    name: "50k",
    phases: [
        {
            name: "eval",
            kind: "eval",
            balance: 50_000,
            ruleset: {
                profitTarget: 3000,
                maxDrawdown: 2500,
                dailyDrawdown: 1000,
                minTradingDays: 2,
            },
        },
    ],
};

const twoStep: Product = {
    id: "2step",
    name: "50k 2-step",
    phases: [
        {
            name: "eval",
            kind: "eval",
            balance: 50_000,
            ruleset: {
                profitTarget: 3000,
                maxDrawdown: 2500,
                dailyDrawdown: 1000,
                minTradingDays: 0,
            },
        },
        {
            name: "funded",
            kind: "funded",
            balance: 50_000,
            ruleset: {
                profitTarget: 3000,
                maxDrawdown: 2500,
                dailyDrawdown: 1000,
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
        const a = openAccount("a1", oneStep, dailyClose, t0);
        expect(a.status).toBe("active");
        expect(a.startBalance).toBe(50_000);
        expect(a.equity).toBe(50_000);
    });

    it("fails on max drawdown", () => {
        const a = openAccount("a1", oneStep, dailyClose, t0);
        const next = applySnapshot(a, snap(47_500), oneStep, dailyClose);
        expect(next.status).toBe("failed");
    });

    it("fails on daily drawdown", () => {
        const a = openAccount("a1", oneStep, dailyClose, t0);
        const next = applySnapshot(a, snap(49_000), oneStep, dailyClose);
        expect(next.status).toBe("failed");
    });

    it("holds pass until min trading days", () => {
        const a = openAccount("a1", oneStep, dailyClose, t0);
        const rich = applySnapshot(a, snap(53_000), oneStep, dailyClose);
        expect(rich.status).toBe("active");
        const d1 = applyFills(rich, [fill(t0, "f1")], oneStep, dailyClose, t0);
        expect(d1.status).toBe("active");
        const d2 = applyFills(
            d1,
            [fill("2026-01-16T16:00:00.000Z", "f2")],
            oneStep,
            dailyClose,
            "2026-01-16T16:00:00.000Z",
        );
        expect(d2.status).toBe("passed");
    });

    it("advances eval to funded", () => {
        const a = openAccount("a1", twoStep, dailyClose, t0);
        const next = applySnapshot(a, snap(53_000), twoStep, dailyClose);
        expect(next.status).toBe("funded");
        expect(next.phaseIndex).toBe(1);
        expect(next.equity).toBe(50_000);
        expect(next.tradingDays).toEqual([]);
    });

    it("stays funded when profit target hits", () => {
        const a = openAccount("a1", twoStep, dailyClose, t0);
        const funded = applySnapshot(a, snap(53_000), twoStep, dailyClose);
        const rich = applySnapshot(funded, snap(53_000), twoStep, dailyClose);
        expect(rich.status).toBe("funded");
        expect(rich.phaseIndex).toBe(1);
    });

    it("rolls daily window at close", () => {
        const a = openAccount("a1", oneStep, dailyClose, t0);
        const day1 = applySnapshot(a, snap(49_500, t0), oneStep, dailyClose);
        expect(day1.status).toBe("active");
        expect(day1.dailyStartEquity).toBe(50_000);
        const day2 = applySnapshot(
            day1,
            snap(49_500, "2026-01-15T22:00:00.000Z"),
            oneStep,
            dailyClose,
        );
        expect(day2.status).toBe("active");
        expect(day2.dailyStartEquity).toBe(49_500);
    });
});
