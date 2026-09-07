import { expect, test } from "@playwright/test";

const adminUrl = "http://localhost:5174";
const operatorUrl = "http://localhost:5175";

test("operator cannot use admin", async ({ page }) => {
    await page.goto(`${adminUrl}/signin`);
    await page.getByTestId("sign-in-email").fill("operator@example.com");
    await page.getByTestId("sign-in-password").fill("changeme");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("guest-not-admin")).toBeVisible();
});

test("firm admin cannot use operator", async ({ page }) => {
    await page.goto(`${operatorUrl}/signin`);
    await page.getByTestId("sign-in-email").fill("admin@example.com");
    await page.getByTestId("sign-in-password").fill("changeme");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("guest-not-operator")).toBeVisible();
});
