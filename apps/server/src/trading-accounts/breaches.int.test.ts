import { expect, it } from "vitest";

const base = "http://localhost:3000";

function cookie(res: Response): string {
    return res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
}

async function send(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
): Promise<Response> {
    return fetch(`${base}${path}`, {
        method,
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

type Breach = { ruleId: string; severity: string };

it("traders see warnings on their account; admins also see flags", async () => {
    const signin = await send("POST", "/auth/sign-in/email", {
        email: "admin@example.com",
        password: "changeme",
    });
    expect(signin.ok).toBe(true);
    const admin = { cookie: cookie(signin) };

    const live = (await (
        await send("GET", "/firm", undefined, admin)
    ).json()) as { products: { id?: string; name: string }[] };
    const name = `breaches-${crypto.randomUUID()}`;
    const put = await send(
        "PUT",
        "/firm",
        {
            ...live,
            products: [
                ...live.products,
                {
                    name,
                    brokers: ["loopback"],
                    phases: [
                        {
                            name: "eval",
                            kind: "eval",
                            balance: 50_000,
                            fee: 0,
                            ruleset: {
                                profitTarget: 0.5,
                                maxDrawdown: 0.5,
                                dailyDrawdown: 0.5,
                                minTradingDays: 0,
                                weekend: { onBreach: "warn" },
                                maxLot: { qty: 1, onBreach: "flag" },
                            },
                        },
                    ],
                },
            ],
        },
        admin,
    );
    expect(put.status).toBe(200);
    const after = (await put.json()) as typeof live;
    const productId = after.products.find((p) => p.name === name)?.id;
    expect(productId).toBeTruthy();

    const signup = await send("POST", "/auth/sign-up/email", {
        name: "Trader",
        email: `b${Date.now()}@example.com`,
        password: "password12",
    });
    expect(signup.ok).toBe(true);
    const trader = { cookie: cookie(signup) };

    const buy = await send(
        "POST",
        `/products/${productId}/buy`,
        { brokerId: "loopback" },
        trader,
    );
    expect(buy.ok).toBe(true);
    const bought = (await buy.json()) as { payment: { id: string } };
    const done = await send(
        "POST",
        `/payments/${bought.payment.id}/complete`,
        undefined,
        admin,
    );
    expect(done.ok).toBe(true);
    const { tradingAccount } = (await done.json()) as {
        tradingAccount: { id: string };
    };

    const ingest = { "X-Api-Key": "dev" };
    // Saturday in every firm timezone from UTC-11 to UTC+7.
    const saturday = "2026-10-03T16:00:00.000Z";
    const snap = await send(
        "POST",
        `/ingest/trading-accounts/${tradingAccount.id}/snapshot`,
        {
            externalId: `s-${crypto.randomUUID()}`,
            equity: 50_000,
            balance: 50_000,
            ts: saturday,
            positions: [
                {
                    id: "p1",
                    symbol: "EURUSD",
                    class: "fx",
                    qty: 2,
                    avgPrice: 1.1,
                    openedAt: saturday,
                    closedAt: null,
                },
            ],
        },
        ingest,
    );
    expect(snap.status).toBe(202);
    const fill = await send(
        "POST",
        `/ingest/trading-accounts/${tradingAccount.id}/fills`,
        {
            fills: [
                {
                    externalId: `f-${crypto.randomUUID()}`,
                    positionId: "p1",
                    symbol: "EURUSD",
                    class: "fx",
                    qty: 2,
                    price: 1.1,
                    side: "buy",
                    ts: saturday,
                    multiplier: 1,
                    tickSize: 0.0001,
                    currency: "USD",
                },
            ],
        },
        ingest,
    );
    expect(fill.status).toBe(202);

    const breaches = async (who: { cookie: string }) => {
        const res = await send(
            "GET",
            `/trading-accounts/${tradingAccount.id}/breaches`,
            undefined,
            who,
        );
        expect(res.status).toBe(200);
        const rows = (await res.json()) as Breach[];
        return rows.map((r) => `${r.ruleId}:${r.severity}`).sort();
    };

    await expect
        .poll(() => breaches(admin))
        .toEqual(["maxLot:flag", "weekend:warn"]);
    expect(await breaches(trader)).toEqual(["weekend:warn"]);
});
