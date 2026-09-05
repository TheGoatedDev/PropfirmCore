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

it("lists trading accounts with page and q", async () => {
    const email = `l${Date.now()}@example.com`;
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

    const page = await fetch(`${base}/trading-accounts?page=1&pageSize=1`, {
        headers: { cookie: trader.cookie },
    });
    expect(page.ok).toBe(true);
    const paged = (await page.json()) as {
        items: { id: string }[];
        total: number;
    };
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBeGreaterThanOrEqual(1);

    const q = await fetch(
        `${base}/trading-accounts?q=${encodeURIComponent(tradingAccount.id)}`,
        { headers: { cookie: trader.cookie } },
    );
    expect(q.ok).toBe(true);
    const found = (await q.json()) as {
        items: { id: string }[];
        total: number;
    };
    expect(found.total).toBe(1);
    expect(found.items[0]?.id).toBe(tradingAccount.id);
});
