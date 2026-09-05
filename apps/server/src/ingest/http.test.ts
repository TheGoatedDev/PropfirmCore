import { readFileSync } from "node:fs";
import { loadFirmConfig } from "@propfirmcore/config";
import { describe, expect, it, vi } from "vitest";
import type { Auth } from "../auth/auth.ts";
import type { Db } from "../db/db.ts";
import { createApp } from "../http/app.ts";
import type { IngestPublish } from "./bus.ts";

vi.mock("../trading-accounts/service.ts", () => ({
    getById: vi.fn(),
}));

const { getById } = await import("../trading-accounts/service.ts");

const auth = {
    handler: () => new Response("not found", { status: 404 }),
    api: {
        getSession: async () => null,
        generateOpenAPISchema: async () => ({
            paths: { "/sign-in/email": { post: {} } },
        }),
    },
} as unknown as Auth;

const firm = loadFirmConfig(
    readFileSync(
        new URL("../../../../firm.example.json", import.meta.url),
        "utf8",
    ),
);

const account = {
    id: "acc_1",
    userId: "u1",
    productId: "50k",
    phaseIndex: 0,
    status: "active" as const,
    startBalance: 50_000,
    equity: 50_000,
    balance: 50_000,
    peakEquity: 50_000,
    dailyStartEquity: 50_000,
    tradingDayKey: "2026-01-01",
    tradingDays: [] as string[],
};

const snapshot = {
    externalId: "s1",
    equity: 51_000,
    balance: 50_000,
    ts: "2026-01-01T00:00:00.000Z",
    positions: [],
};

const fill = {
    externalId: "f1",
    positionId: "p1",
    symbol: "EURUSD",
    class: "fx" as const,
    qty: 1,
    price: 1.1,
    side: "buy" as const,
    ts: "2026-01-01T00:00:00.000Z",
    multiplier: 1,
    tickSize: 0.0001,
    currency: "USD",
};

function app(publish: IngestPublish) {
    return createApp({
        apiKey: "secret",
        firm,
        db: {} as Db,
        auth,
        publish,
    });
}

const key = { "x-api-key": "secret" };

describe("ingest http", () => {
    it("404 snapshot does not publish", async () => {
        vi.mocked(getById).mockResolvedValue(null);
        const publish: IngestPublish = {
            snapshot: vi.fn(),
            fills: vi.fn(),
        };
        const res = await app(publish).request(
            "/ingest/trading-accounts/acc_1/snapshot",
            {
                method: "POST",
                headers: { ...key, "content-type": "application/json" },
                body: JSON.stringify(snapshot),
            },
        );
        expect(res.status).toBe(404);
        expect(publish.snapshot).not.toHaveBeenCalled();
    });

    it("202 snapshot", async () => {
        vi.mocked(getById).mockResolvedValue(account);
        const publish: IngestPublish = {
            snapshot: vi.fn(),
            fills: vi.fn(),
        };
        const res = await app(publish).request(
            "/ingest/trading-accounts/acc_1/snapshot",
            {
                method: "POST",
                headers: { ...key, "content-type": "application/json" },
                body: JSON.stringify(snapshot),
            },
        );
        expect(res.status).toBe(202);
        expect(await res.json()).toEqual({
            accountId: "acc_1",
            externalId: "s1",
        });
        expect(publish.snapshot).toHaveBeenCalledWith({
            accountId: "acc_1",
            ...snapshot,
        });
    });

    it("202 fills", async () => {
        vi.mocked(getById).mockResolvedValue(account);
        const publish: IngestPublish = {
            snapshot: vi.fn(),
            fills: vi.fn(),
        };
        const res = await app(publish).request(
            "/ingest/trading-accounts/acc_1/fills",
            {
                method: "POST",
                headers: { ...key, "content-type": "application/json" },
                body: JSON.stringify({ fills: [fill] }),
            },
        );
        expect(res.status).toBe(202);
        expect(await res.json()).toEqual({
            accountId: "acc_1",
            externalIds: ["f1"],
        });
        expect(publish.fills).toHaveBeenCalledWith({
            accountId: "acc_1",
            fills: [fill],
        });
    });

    it("503 when publish throws", async () => {
        vi.mocked(getById).mockResolvedValue(account);
        const publish: IngestPublish = {
            snapshot: async () => {
                throw new Error("down");
            },
            fills: vi.fn(),
        };
        const res = await app(publish).request(
            "/ingest/trading-accounts/acc_1/snapshot",
            {
                method: "POST",
                headers: { ...key, "content-type": "application/json" },
                body: JSON.stringify(snapshot),
            },
        );
        expect(res.status).toBe(503);
    });
});
