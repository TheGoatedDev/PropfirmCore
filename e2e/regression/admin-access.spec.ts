import { expect, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";
const adminUrl = "http://localhost:5174";

test("trader cannot use admin", async ({ browser }) => {
    const email = `t${crypto.randomUUID()}@example.com`;
    const password = "password12";

    const trader = await browser.newPage();
    await trader.goto(`${traderUrl}/signup`);
    await trader.getByTestId("sign-up-name").fill("Trader");
    await trader.getByTestId("sign-up-email").fill(email);
    await trader.getByTestId("sign-up-password").fill(password);
    await trader.getByTestId("sign-up-submit").click();
    await expect(trader.getByTestId("products-heading")).toBeVisible();

    const admin = await browser.newPage();
    await admin.goto(`${adminUrl}/signin`);
    await admin.getByTestId("sign-in-email").fill(email);
    await admin.getByTestId("sign-in-password").fill(password);
    await admin.getByTestId("sign-in-submit").click();
    await expect(admin.getByTestId("guest-not-admin")).toBeVisible();
});
