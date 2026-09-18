import { expect, test } from "@playwright/test";

const adminUrl = "http://localhost:5174";

async function signInAdmin(page: import("@playwright/test").Page) {
    await page.goto(`${adminUrl}/signin`);
    await page.getByTestId("sign-in-email").fill("admin@example.com");
    await page.getByTestId("sign-in-password").fill("changeme");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("home-heading")).toBeVisible();
}

test("sidebar collapse keeps icon rail and nav works", async ({ page }) => {
    await signInAdmin(page);
    await expect(page.getByText("Trading accounts")).toBeVisible();

    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute(
        "aria-expanded",
        "false",
    );
    await expect(page.getByText("Trading accounts")).toBeHidden();

    await page.getByTestId("nav-firm").click();
    await expect(page.getByTestId("firm-heading")).toBeVisible();

    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByText("Trading accounts")).toBeVisible();
});
