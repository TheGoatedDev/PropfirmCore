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

type Bucket = { count: number; amount: number };
type Overview = {
    accounts: {
        active: number;
        passed: number;
        failed: number;
        byProduct: {
            productId: string;
            active: number;
            passed: number;
            failed: number;
        }[];
    };
    payments: Record<"pending" | "paid" | "failed" | "canceled", Bucket>;
    payouts: Record<"pending" | "approved" | "rejected" | "paid", Bucket>;
    days: string[];
    fills: number[];
    signups: number[];
    breaches: { warn: number[]; flag: number[] };
};

it("admin overview counts accounts, money and recent activity", async () => {
    expect((await fetch(`${base}/stats/overview`)).status).toBe(401);

    const signup = await post("/auth/sign-up/email", {
        name: "Trader",
        email: `s${Date.now()}@example.com`,
        password: "password12",
    });
    expect(signup.ok).toBe(true);
    const trader = cookie(signup);
    const asTrader = await fetch(`${base}/stats/overview`, {
        headers: { cookie: trader },
    });
    expect(asTrader.status).toBe(403);

    const products = (await (
        await fetch(`${base}/products`, { headers: { cookie: trader } })
    ).json()) as {
        id: string;
        brokers: { id: string }[];
        phases: { fee?: number }[];
    }[];
    const paid = products.find((p) => (p.phases[0]?.fee ?? 0) > 0);
    if (!paid?.brokers[0]) throw new Error("no paid product");
    const buy = await post(
        `/products/${paid.id}/buy`,
        { brokerId: paid.brokers[0].id },
        { cookie: trader },
    );
    expect(buy.ok).toBe(true);

    const signin = await post("/auth/sign-in/email", {
        email: "admin@example.com",
        password: "changeme",
    });
    const res = await fetch(`${base}/stats/overview`, {
        headers: { cookie: cookie(signin) },
    });
    expect(res.status).toBe(200);
    const o = (await res.json()) as Overview;

    expect(o.payments.pending.count).toBeGreaterThanOrEqual(1);
    expect(o.payments.pending.amount).toBeGreaterThan(0);
    for (const k of ["active", "passed", "failed"] as const) {
        expect(o.accounts[k]).toBe(
            o.accounts.byProduct.reduce((n, p) => n + p[k], 0),
        );
    }

    expect(o.days).toHaveLength(14);
    expect([...o.days].sort()).toEqual(o.days);
    for (const series of [
        o.fills,
        o.signups,
        o.breaches.warn,
        o.breaches.flag,
    ]) {
        expect(series).toHaveLength(14);
    }
    expect(o.signups[13]).toBeGreaterThanOrEqual(1);
});
