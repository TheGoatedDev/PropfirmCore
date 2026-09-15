import { expect, test } from "@playwright/test";

const operatorUrl = "http://localhost:5175";

test("operator users table lists operators", async ({ page }) => {
    await page.goto(`${operatorUrl}/signin`);
    await page.getByTestId("sign-in-email").fill("operator@example.com");
    await page.getByTestId("sign-in-password").fill("changeme");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("nav-users")).toBeVisible();
    await page.getByTestId("nav-users").click();
    await expect(page.getByTestId("users-heading")).toBeVisible();
    await expect(page.getByTestId("user-filter-kind")).toBeVisible();
    await page.getByTestId("table-filter").fill("operator@example.com");
    await expect(page).toHaveURL(/q=operator/);
    await expect(
        page.getByRole("cell", { name: "operator@example.com" }),
    ).toBeVisible();
});
