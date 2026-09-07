import { expect, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";

test("account table shows empty chrome and writes q", async ({ page }) => {
    const email = `t${crypto.randomUUID()}@example.com`;
    await page.goto(`${traderUrl}/signup`);
    await page.getByTestId("sign-up-name").fill("Trader");
    await page.getByTestId("sign-up-email").fill(email);
    await page.getByTestId("sign-up-password").fill("password12");
    await page.getByTestId("sign-up-submit").click();
    await expect(page.getByTestId("accounts-heading")).toBeVisible();

    await expect(page.getByTestId("table-filter")).toBeVisible();
    await expect(page.getByTestId("table-page")).toHaveText("Page 1 of 1");
    await expect(page.getByTestId("table-prev")).toBeDisabled();
    await expect(page.getByTestId("table-next")).toBeDisabled();
    await expect(page.getByTestId("table-empty")).toBeVisible();

    await page.getByTestId("table-filter").fill("active");
    await expect(page).toHaveURL(/[?&]q=active/);
});
