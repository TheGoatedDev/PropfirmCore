import { expect, it } from "vitest";
import { defaultFirmPath, loadFirmFromPath } from "./firm.ts";

const base = "http://localhost:3000";

function cookie(res: Response): string {
    return res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
}

async function post(
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
): Promise<Response> {
    return fetch(`${base}${path}`, {
        method: "POST",
        headers: {
            origin: base,
            ...(body === undefined
                ? {}
                : { "content-type": "application/json" }),
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

async function putFirm(cookieHeader: string, body: unknown): Promise<Response> {
    return fetch(`${base}/firm`, {
        method: "PUT",
        headers: {
            origin: base,
            "content-type": "application/json",
            cookie: cookieHeader,
        },
        body: JSON.stringify(body),
    });
}

it("kyc payout gate blocks cash until admin verifies", async () => {
    const seed = loadFirmFromPath(defaultFirmPath());
    const op = cookie(
        await post("/auth/sign-in/email", {
            email: "operator@example.com",
            password: "changeme",
        }),
    );
    const admin = cookie(
        await post("/auth/sign-in/email", {
            email: "admin@example.com",
            password: "changeme",
        }),
    );

    const email = `kyc${Date.now()}@example.com`;
    const signup = await post("/auth/sign-up/email", {
        name: "Trader",
        email,
        password: "password12",
    });
    expect(signup.ok).toBe(true);
    const trader = cookie(signup);

    const meOff = await fetch(`${base}/auth/me`, {
        headers: { origin: base, cookie: trader },
    });
    expect(meOff.ok).toBe(true);
    const offWho = (await meOff.json()) as {
        id: string;
        kycVerified: boolean;
        kyc: unknown;
    };
    expect(offWho.kycVerified).toBe(false);
    expect(offWho.kyc).toBeNull();

    const enabled = {
        ...seed,
        modules: {
            ...seed.modules,
            kyc: { enabled: true, gate: "payout" as const },
        },
    };
    try {
        expect((await putFirm(op, enabled)).ok).toBe(true);

        const meOn = await fetch(`${base}/auth/me`, {
            headers: { origin: base, cookie: trader },
        });
        const onWho = (await meOn.json()) as {
            kycVerified: boolean;
            kyc: { enabled: boolean; gate: string } | null;
        };
        expect(onWho.kyc).toEqual({ enabled: true, gate: "payout" });

        const forbidden = await post(
            `/users/${offWho.id}/kyc`,
            { verified: true },
            { cookie: trader },
        );
        expect(forbidden.status).toBe(403);

        const buy = await post(
            "/products/50k/buy",
            { brokerId: "loopback" },
            { cookie: trader },
        );
        expect(buy.ok).toBe(true);
        const bought = (await buy.json()) as { payment: { id: string } };
        const done = await post(
            `/payments/${bought.payment.id}/complete`,
            undefined,
            { cookie: admin },
        );
        expect(done.ok).toBe(true);
        const { tradingAccount } = (await done.json()) as {
            tradingAccount: { id: string };
        };
        const id = tradingAccount.id;
        const ingest = { "X-Api-Key": "dev" };

        const snap = await post(
            `/ingest/trading-accounts/${id}/snapshot`,
            {
                externalId: `kyc-eval-${Date.now()}`,
                equity: 53000,
                balance: 53000,
                ts: "2026-01-15T16:00:00.000Z",
                positions: [],
            },
            ingest,
        );
        expect(snap.status).toBe(202);
        const days = [
            "2026-01-12T16:00:00.000Z",
            "2026-01-13T16:00:00.000Z",
            "2026-01-14T16:00:00.000Z",
            "2026-01-15T16:00:00.000Z",
        ];
        const fills = await post(
            `/ingest/trading-accounts/${id}/fills`,
            {
                fills: days.map((ts, i) => ({
                    externalId: `kyc-f-${Date.now()}-${i}`,
                    positionId: "p1",
                    symbol: "EURUSD",
                    class: "fx",
                    qty: 1,
                    price: 1,
                    side: "buy",
                    ts,
                    multiplier: 1,
                    tickSize: 0.0001,
                    currency: "USD",
                })),
            },
            ingest,
        );
        expect(fills.status).toBe(202);
        await expect
            .poll(
                async () => {
                    const res = await fetch(`${base}/trading-accounts/${id}`, {
                        headers: { cookie: trader },
                    });
                    const acc = (await res.json()) as { phaseIndex: number };
                    return acc.phaseIndex;
                },
                { timeout: 10_000 },
            )
            .toBe(1);

        const fundedSnap = await post(
            `/ingest/trading-accounts/${id}/snapshot`,
            {
                externalId: `kyc-funded-${Date.now()}`,
                equity: 53000,
                balance: 53000,
                ts: "2026-01-16T16:00:00.000Z",
                positions: [],
            },
            ingest,
        );
        expect(fundedSnap.status).toBe(202);
        await expect
            .poll(
                async () => {
                    const res = await fetch(`${base}/trading-accounts/${id}`, {
                        headers: { cookie: trader },
                    });
                    const acc = (await res.json()) as { equity: number };
                    return acc.equity;
                },
                { timeout: 10_000 },
            )
            .toBe(53000);

        const blocked = await post(
            `/trading-accounts/${id}/payouts`,
            { amount: 100 },
            { cookie: trader },
        );
        expect(blocked.status).toBe(400);
        expect(await blocked.json()).toEqual({ error: "kyc required" });

        const verified = await post(
            `/users/${offWho.id}/kyc`,
            { verified: true },
            { cookie: admin },
        );
        expect(verified.ok).toBe(true);

        const staffList = await fetch(`${base}/trading-accounts?q=${id}`, {
            headers: { cookie: admin },
        });
        const listed = (await staffList.json()) as {
            items: { id: string; kycVerified?: boolean }[];
        };
        expect(listed.items.find((a) => a.id === id)?.kycVerified).toBe(true);

        const okReq = await post(
            `/trading-accounts/${id}/payouts`,
            { amount: 100 },
            { cookie: trader },
        );
        expect(okReq.ok).toBe(true);
    } finally {
        expect((await putFirm(op, seed)).ok).toBe(true);
    }
});
