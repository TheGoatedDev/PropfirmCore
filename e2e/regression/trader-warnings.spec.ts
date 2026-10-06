import { expect, request, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";
const apiUrl = "http://localhost:3000";

test("trader sees warnings but not flags on their account", async ({
    page,
}) => {
    const admin = await request.newContext({
        baseURL: apiUrl,
        extraHTTPHeaders: { origin: apiUrl },
    });
    const signin = await admin.post("/auth/sign-in/email", {
        data: { email: "admin@example.com", password: "changeme" },
    });
    expect(signin.ok()).toBe(true);

    const live = (await (await admin.get("/firm")).json()) as {
        products: { id?: string; name: string }[];
    };
    const name = `warnings-${crypto.randomUUID()}`;
    const put = await admin.put("/firm", {
        data: {
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
                                maxWarnings: 3,
                                weekend: { onBreach: "warn" },
                                maxLot: { qty: 1, onBreach: "flag" },
                            },
                        },
                    ],
                },
            ],
        },
    });
    expect(put.ok()).toBe(true);
    const productId = ((await put.json()) as typeof live).products.find(
        (p) => p.name === name,
    )?.id;

    await page.goto(`${traderUrl}/signup`);
    await page.getByTestId("sign-up-name").fill("Trader");
    await page
        .getByTestId("sign-up-email")
        .fill(`t${crypto.randomUUID()}@example.com`);
    await page.getByTestId("sign-up-password").fill("password12");
    await page.getByTestId("sign-up-submit").click();
    await page.getByTestId(`product-buy-${productId}`).click();
    const payment = page.getByTestId("payment-id");
    await expect(payment).toBeVisible();
    const paymentId = (await payment.textContent())
        ?.replace("Payment ID:", "")
        .trim();

    const done = await admin.post(`/payments/${paymentId}/complete`);
    expect(done.ok()).toBe(true);
    const { tradingAccount } = (await done.json()) as {
        tradingAccount: { id: string };
    };
    const id = tradingAccount.id;

    const ingest = { "X-Api-Key": "dev" };
    // Saturday in every firm timezone from UTC-11 to UTC+7.
    const saturday = "2026-10-03T16:00:00.000Z";
    const snap = await admin.post(`/ingest/trading-accounts/${id}/snapshot`, {
        headers: ingest,
        data: {
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
    });
    expect(snap.status()).toBe(202);
    const fill = await admin.post(`/ingest/trading-accounts/${id}/fills`, {
        headers: ingest,
        data: {
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
    });
    expect(fill.status()).toBe(202);
    await expect
        .poll(async () => {
            const res = await admin.get(`/trading-accounts/${id}/breaches`);
            return ((await res.json()) as unknown[]).length;
        })
        .toBe(2);

    await page.goto(`${traderUrl}/trading-accounts/${id}`);
    await expect(page.getByTestId("account-warnings-count")).toHaveText(
        "1 of 3 warnings",
    );
    await expect(page.getByTestId("account-warning-0")).toContainText(
        "Weekend",
    );
    await expect(page.getByTestId("account-warning-1")).toHaveCount(0);
    await admin.dispose();
});
