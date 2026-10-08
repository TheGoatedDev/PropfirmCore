import { expect, type Page, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";
const adminUrl = "http://localhost:5174";

async function signInAdmin(page: Page) {
    await page.goto(`${adminUrl}/signin`);
    await page.getByTestId("sign-in-email").fill("admin@example.com");
    await page.getByTestId("sign-in-password").fill("changeme");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("home-heading")).toBeVisible();
}

test("admin inspects, resyncs, and fails a trading account", async ({
    browser,
}) => {
    const trader = await browser.newPage();
    await trader.goto(`${traderUrl}/signup`);
    await trader.getByTestId("sign-up-name").fill("Trader");
    await trader
        .getByTestId("sign-up-email")
        .fill(`t${crypto.randomUUID()}@example.com`);
    await trader.getByTestId("sign-up-password").fill("password12");
    await trader.getByTestId("sign-up-submit").click();
    await trader.getByTestId("product-buy-50k").click();
    const payment = trader.getByTestId("payment-id");
    await expect(payment).toBeVisible();
    const paymentId = (await payment.textContent())
        ?.replace("Payment ID:", "")
        .trim();

    const admin = await browser.newPage();
    await signInAdmin(admin);
    await admin.getByTestId("nav-payments").click();
    await admin.getByTestId("table-filter").fill(paymentId ?? "");
    const completed = admin.waitForResponse(
        (r) => r.url().includes("/complete") && r.ok(),
    );
    await admin.getByTestId(`payment-complete-${paymentId}`).click();
    await admin.getByTestId("confirm-dialog-confirm").click();
    await completed;

    await trader.reload();
    await trader.getByTestId(/^trading-account-inspect-/).click();
    await expect(trader).toHaveURL(/\/trading-accounts\/[^/]+$/);
    const id = new URL(trader.url()).pathname.split("/").pop() ?? "";

    await admin.getByTestId("nav-trading-accounts").click();
    await admin.getByTestId("table-filter").fill(id);
    await expect(admin).toHaveURL(new RegExp(`[?&]q=${id}`));
    await admin.getByTestId(`account-inspect-${id}`).click();
    await expect(admin).toHaveURL(new RegExp(`/trading-accounts/${id}$`));

    await expect(admin.getByTestId("account-detail-status")).toHaveText(
        "Active",
    );
    await expect(admin.getByTestId("account-breaches-empty")).toBeVisible();

    const resynced = admin.waitForResponse(
        (r) => r.url().endsWith(`/${id}/resync-ruleset`) && r.ok(),
    );
    await admin.getByTestId("account-resync").click();
    await resynced;

    await admin.getByTestId("account-fail").click();
    await admin.getByTestId("confirm-dialog-confirm").click();
    await expect(admin.getByTestId("account-detail-status")).toHaveText(
        "Failed",
    );
    await expect(admin.getByTestId("account-pass")).toBeDisabled();
});
