import { expect, test } from "@playwright/test";

test("ingest snapshot settles on worker", async ({ playwright }) => {
    const email = `i${Date.now()}@example.com`;
    const trader = await playwright.request.newContext({
        baseURL: "http://localhost:3000",
    });
    const signup = await trader.post("/auth/sign-up/email", {
        data: { name: "Trader", email, password: "password12" },
    });
    expect(signup.ok()).toBeTruthy();

    const buy = await trader.post("/products/50k/buy");
    expect(buy.ok()).toBeTruthy();
    const bought = (await buy.json()) as { payment: { id: string } };

    const admin = await playwright.request.newContext({
        baseURL: "http://localhost:3000",
    });
    const signin = await admin.post("/auth/sign-in/email", {
        data: { email: "admin@example.com", password: "changeme" },
    });
    expect(signin.ok()).toBeTruthy();

    const done = await admin.post(`/payments/${bought.payment.id}/complete`);
    expect(done.ok()).toBeTruthy();
    const { tradingAccount } = (await done.json()) as {
        tradingAccount: { id: string };
    };

    const ingest = await playwright.request.newContext({
        baseURL: "http://localhost:3000",
        extraHTTPHeaders: { "X-Api-Key": "dev" },
    });
    const snap = await ingest.post(
        `/ingest/trading-accounts/${tradingAccount.id}/snapshot`,
        {
            data: {
                externalId: `e2e-${Date.now()}`,
                equity: 51000,
                balance: 50000,
                ts: new Date().toISOString(),
                positions: [],
            },
        },
    );
    expect(snap.status()).toBe(202);

    await expect
        .poll(async () => {
            const g = await ingest.get(
                `/ingest/trading-accounts/${tradingAccount.id}`,
            );
            const body = (await g.json()) as { equity: number };
            return body.equity;
        })
        .toBe(51000);
});
