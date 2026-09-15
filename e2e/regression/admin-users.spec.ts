import { expect, test } from "@playwright/test";

const adminUrl = "http://localhost:5174";

test("admin users table create", async ({ page }) => {
    await page.goto(`${adminUrl}/signin`);
    await page.getByTestId("sign-in-email").fill("admin@example.com");
    await page.getByTestId("sign-in-password").fill("changeme");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("nav-users")).toBeVisible();
    await page.getByTestId("nav-users").click();
    await expect(page.getByTestId("users-heading")).toBeVisible();
    await expect(page.getByTestId("table-filter")).toBeVisible();

    const email = `a${crypto.randomUUID()}@example.com`;
    await page.getByTestId("user-create").click();
    await page.getByTestId("user-create-email").fill(email);
    await page.getByTestId("user-create-name").fill("Ada");
    await page.getByTestId("user-create-password").fill("password12");
    await page.getByTestId("user-create-submit").click();
    await page.getByTestId("table-filter").fill(email);
    await expect(page.getByText(email)).toBeVisible();
});
