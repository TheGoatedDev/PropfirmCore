import { expect, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";
const adminUrl = "http://localhost:5174";

test("trader buys, admin completes", async ({ browser }) => {
    const email = `t${crypto.randomUUID()}@example.com`;
    const password = "password12";

    const trader = await browser.newPage();
    await trader.goto(`${traderUrl}/signup`);
    await trader.getByTestId("sign-up-name").fill("Trader");
    await trader.getByTestId("sign-up-email").fill(email);
    await trader.getByTestId("sign-up-password").fill(password);
    await trader.getByTestId("sign-up-submit").click();
    await expect(trader.getByTestId("products-heading")).toBeVisible();
    await trader.getByTestId("product-buy-50k").click();
    const payment = trader.getByTestId("payment-id");
    await expect(payment).toBeVisible();
    const paymentId = (await payment.textContent())
        ?.replace("Payment ID:", "")
        .trim();
    expect(paymentId).toBeTruthy();

    const admin = await browser.newPage();
    await admin.goto(`${adminUrl}/signin`);
    await admin.getByTestId("sign-in-email").fill("admin@example.com");
    await admin.getByTestId("sign-in-password").fill("changeme");
    await admin.getByTestId("sign-in-submit").click();
    await expect(admin.getByTestId("accounts-heading")).toBeVisible();
    await admin.getByTestId("payment-complete-id").fill(paymentId ?? "");
    await admin.getByTestId("payment-complete-submit").click();
    await expect(admin.getByTestId("account-status").first()).toHaveText(
        "active",
    );

    await trader.reload();
    await expect(trader.getByTestId("account-status").first()).toHaveText(
        "active",
    );
});
