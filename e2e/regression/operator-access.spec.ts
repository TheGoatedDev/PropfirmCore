import { expect, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";
const operatorUrl = "http://localhost:5175";

test("trader cannot use operator", async ({ browser }) => {
    const email = `t${crypto.randomUUID()}@example.com`;
    const password = "password12";

    const trader = await browser.newPage();
    await trader.goto(`${traderUrl}/signup`);
    await trader.getByTestId("sign-up-name").fill("Trader");
    await trader.getByTestId("sign-up-email").fill(email);
    await trader.getByTestId("sign-up-password").fill(password);
    await trader.getByTestId("sign-up-submit").click();
    await expect(trader.getByTestId("products-heading")).toBeVisible();

    const op = await browser.newPage();
    await op.goto(`${operatorUrl}/signin`);
    await op.getByTestId("sign-in-email").fill(email);
    await op.getByTestId("sign-in-password").fill(password);
    await op.getByTestId("sign-in-submit").click();
    await expect(op.getByTestId("guest-not-operator")).toBeVisible();
});

test("operator sees firm name", async ({ page }) => {
    await page.goto(`${operatorUrl}/signin`);
    await page.getByTestId("sign-in-email").fill("operator@example.com");
    await page.getByTestId("sign-in-password").fill("changeme");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("firm-heading")).toBeVisible();
    await expect(page.getByTestId("firm-name")).toHaveValue("Acme");
});
