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

async function openAccount(admin: string): Promise<string> {
    const signup = await post("/auth/sign-up/email", {
        name: "Trader",
        email: `st${Date.now()}${Math.random()}@example.com`,
        password: "password12",
    });
    expect(signup.ok).toBe(true);
    const trader = cookie(signup);
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
    const { payment } = (await buy.json()) as { payment: { id: string } };
    const done = await post(`/payments/${payment.id}/complete`, undefined, {
        cookie: admin,
    });
    expect(done.ok).toBe(true);
    const { tradingAccount } = (await done.json()) as {
        tradingAccount: { id: string };
    };
    return tradingAccount.id;
}

it("a passed account cannot be failed; a failed one can be reactivated", async () => {
    const signin = await post("/auth/sign-in/email", {
        email: "admin@example.com",
        password: "changeme",
    });
    expect(signin.ok).toBe(true);
    const admin = cookie(signin);

    // Passed is final for force fail.
    const passedId = await openAccount(admin);
    expect(
        (
            await post(`/trading-accounts/${passedId}/pass`, undefined, {
                cookie: admin,
            })
        ).status,
    ).toBe(200);
    const failPassed = await post(
        `/trading-accounts/${passedId}/fail`,
        undefined,
        { cookie: admin },
    );
    expect(failPassed.status).toBe(409);
    expect(
        (
            await post(`/trading-accounts/${passedId}/reactivate`, undefined, {
                cookie: admin,
            })
        ).status,
    ).toBe(409);

    // Failed can go back to active, once.
    const failedId = await openAccount(admin);
    expect(
        (
            await post(`/trading-accounts/${failedId}/reactivate`, undefined, {
                cookie: admin,
            })
        ).status,
    ).toBe(409);
    expect(
        (
            await post(`/trading-accounts/${failedId}/fail`, undefined, {
                cookie: admin,
            })
        ).status,
    ).toBe(200);
    expect(
        (
            await post(`/trading-accounts/${failedId}/fail`, undefined, {
                cookie: admin,
            })
        ).status,
    ).toBe(409);
    const back = await post(
        `/trading-accounts/${failedId}/reactivate`,
        undefined,
        { cookie: admin },
    );
    expect(back.status).toBe(200);
    expect(((await back.json()) as { status: string }).status).toBe("active");

    // Traders cannot reactivate.
    const trader = await post("/auth/sign-up/email", {
        name: "Trader",
        email: `sx${Date.now()}@example.com`,
        password: "password12",
    });
    expect(
        (
            await post(`/trading-accounts/${failedId}/reactivate`, undefined, {
                cookie: cookie(trader),
            })
        ).status,
    ).toBe(403);
});
