import { expect, it } from "vitest";

const base = "http://localhost:3000";
const ingest = { "X-Api-Key": "dev" };
const origin = { origin: base };

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
            ...origin,
            ...(body === undefined
                ? {}
                : { "content-type": "application/json" }),
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

function fill(ts: string, id: string) {
    return {
        externalId: id,
        positionId: id,
        symbol: "EURUSD",
        class: "fx" as const,
        qty: 1,
        price: 1.1,
        side: "buy" as const,
        ts,
        multiplier: 100_000,
        tickSize: 0.00001,
        currency: "USD",
    };
}

async function account(id: string) {
    const g = await fetch(`${base}/ingest/trading-accounts/${id}`, {
        headers: { ...origin, ...ingest },
    });
    return g.json() as Promise<{
        equity: number;
        dailyStartEquity: number;
        phaseIndex: number;
        status: string;
    }>;
}

it("approve debit then net snapshot stays active", async () => {
    const email = `p${Date.now()}@example.com`;
    const signup = await post("/auth/sign-up/email", {
        name: "Trader",
        email,
        password: "password12",
    });
    expect(signup.ok).toBe(true);
    const trader = { cookie: cookie(signup) };

    const buy = await post("/products/50k/buy", undefined, {
        cookie: trader.cookie,
    });
    expect(buy.ok).toBe(true);
    const bought = (await buy.json()) as { payment: { id: string } };

    const signin = await post("/auth/sign-in/email", {
        email: "admin@example.com",
        password: "changeme",
    });
    expect(signin.ok).toBe(true);
    const admin = { cookie: cookie(signin) };

    const done = await post(
        `/payments/${bought.payment.id}/complete`,
        undefined,
        { cookie: admin.cookie },
    );
    expect(done.ok).toBe(true);
    const { tradingAccount } = (await done.json()) as {
        tradingAccount: { id: string };
    };
    const id = tradingAccount.id;

    const snap = await post(
        `/ingest/trading-accounts/${id}/snapshot`,
        {
            externalId: `p-eval-${Date.now()}`,
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
        { fills: days.map((ts, i) => fill(ts, `p-f-${Date.now()}-${i}`)) },
        ingest,
    );
    expect(fills.status).toBe(202);

    await expect
        .poll(async () => (await account(id)).phaseIndex, { timeout: 10_000 })
        .toBe(1);

    const fundedSnap = await post(
        `/ingest/trading-accounts/${id}/snapshot`,
        {
            externalId: `p-funded-${Date.now()}`,
            equity: 53000,
            balance: 53000,
            ts: "2026-01-16T16:00:00.000Z",
            positions: [],
        },
        ingest,
    );
    expect(fundedSnap.status).toBe(202);

    await expect
        .poll(async () => (await account(id)).equity, { timeout: 10_000 })
        .toBe(53000);

    const req = await post(
        `/trading-accounts/${id}/payouts`,
        { amount: 2400 },
        { cookie: trader.cookie },
    );
    expect(req.ok).toBe(true);
    const payout = (await req.json()) as { id: string };

    const approved = await post(`/payouts/${payout.id}/approve`, undefined, {
        cookie: admin.cookie,
    });
    expect(approved.ok).toBe(true);
    const book = await account(id);
    expect(book.equity).toBe(50600);
    expect(book.dailyStartEquity).toBe(50600);
    expect(book.status).toBe("active");

    const net = await post(
        `/ingest/trading-accounts/${id}/snapshot`,
        {
            externalId: `p-net-${Date.now()}`,
            equity: 50600,
            balance: 50600,
            ts: "2026-01-16T16:00:00.000Z",
            positions: [],
        },
        ingest,
    );
    expect(net.status).toBe(202);

    await expect
        .poll(
            async () => {
                const a = await account(id);
                return a.equity === 50600 ? a.status : "";
            },
            { timeout: 10_000 },
        )
        .toBe("active");
});
