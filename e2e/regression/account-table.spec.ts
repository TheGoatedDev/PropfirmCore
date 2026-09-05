import { expect, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";

test("account table shows empty chrome and writes q", async ({ page }) => {
    const email = `t${Date.now()}@example.com`;
    await page.goto(`${traderUrl}/signup`);
    await page.getByLabel("Name").fill("Trader");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password12");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(
        page.getByRole("heading", { name: "Trading accounts" }),
    ).toBeVisible();

    await expect(page.getByPlaceholder("Filter id or status…")).toBeVisible();
    await expect(page.getByText("Page 1 of 1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
    await expect(page.getByText("No results.")).toBeVisible();

    await page.getByPlaceholder("Filter id or status…").fill("active");
    await expect(page).toHaveURL(/[?&]q=active/);
});
