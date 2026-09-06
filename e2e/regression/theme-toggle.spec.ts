import { expect, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";

test("theme toggle sets html class", async ({ page }) => {
    const email = `t${crypto.randomUUID()}@example.com`;
    await page.goto(`${traderUrl}/signup`);
    await page.getByLabel("Name").fill("Trader");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password12");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();

    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(
        await page.evaluate(() => localStorage.getItem("vite-ui-theme")),
    ).toBe("dark");

    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.getByRole("menuitem", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
});
