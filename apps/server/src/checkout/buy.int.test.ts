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

it("buy requires brokerId and provisions on fee 0", async () => {
    const email = `b${Date.now()}@example.com`;
    const signup = await post("/auth/sign-up/email", {
        name: "Trader",
        email,
        password: "password12",
    });
    expect(signup.ok).toBe(true);
    const trader = { cookie: cookie(signup) };

    const missing = await post("/products/50k/buy", undefined, {
        cookie: trader.cookie,
    });
    expect(missing.status).toBe(400);

    const bad = await post(
        "/products/50k/buy",
        { brokerId: "nope" },
        { cookie: trader.cookie },
    );
    expect(bad.status).toBe(400);

    const buy = await post(
        "/products/load/buy",
        { brokerId: "loopback" },
        { cookie: trader.cookie },
    );
    expect(buy.ok).toBe(true);
    const bought = (await buy.json()) as {
        tradingAccount: {
            id: string;
            brokerId: string;
            brokerLogin: string;
            brokerPassword: string;
        };
    };
    expect(bought.tradingAccount.brokerId).toBe("loopback");
    expect(bought.tradingAccount.brokerLogin).toBe(bought.tradingAccount.id);
    expect(bought.tradingAccount.brokerPassword).toBe("loopback");
});
