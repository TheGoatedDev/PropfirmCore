import { expect, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";

test("theme toggle sets html class", async ({ page }) => {
    const email = `t${crypto.randomUUID()}@example.com`;
    await page.goto(`${traderUrl}/signup`);
    await page.getByTestId("sign-up-name").fill("Trader");
    await page.getByTestId("sign-up-email").fill(email);
    await page.getByTestId("sign-up-password").fill("password12");
    await page.getByTestId("sign-up-submit").click();
    await expect(page.getByTestId("products-heading")).toBeVisible();

    await page.getByTestId("theme-toggle").click();
    await page.getByTestId("theme-dark").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(
        await page.evaluate(() => localStorage.getItem("vite-ui-theme")),
    ).toBe("dark");

    await page.getByTestId("theme-toggle").click();
    await page.getByTestId("theme-light").click();
    await expect(page.locator("html")).toHaveClass(/light/);
});
