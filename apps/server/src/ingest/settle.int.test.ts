import { expect, it } from "vitest";

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

it("ingest snapshot settles on worker", async () => {
    const email = `i${Date.now()}@example.com`;
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

    const ingest = { "X-Api-Key": "dev" };
    const snap = await post(
        `/ingest/trading-accounts/${tradingAccount.id}/snapshot`,
        {
            externalId: `e2e-${Date.now()}`,
            equity: 51000,
            balance: 50000,
            ts: new Date().toISOString(),
            positions: [],
        },
        ingest,
    );
    expect(snap.status).toBe(202);

    await expect
        .poll(async () => {
            const g = await fetch(
                `${base}/ingest/trading-accounts/${tradingAccount.id}`,
                { headers: { origin: base, ...ingest } },
            );
            const body = (await g.json()) as { equity: number };
            return body.equity;
        })
        .toBe(51000);
});
