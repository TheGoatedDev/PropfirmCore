import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const traderUrl = "http://localhost:5173";
const adminUrl = "http://localhost:5174";

async function signInAdmin(page: import("@playwright/test").Page) {
    await page.goto(`${adminUrl}/signin`);
    await page.getByTestId("sign-in-email").fill("admin@example.com");
    await page.getByTestId("sign-in-password").fill("changeme");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("home-heading")).toBeVisible();
}

test("admin renames firm and it sticks", async ({ page }) => {
    await signInAdmin(page);
    await page.getByTestId("nav-firm").click();
    await expect(page.getByTestId("firm-heading")).toBeVisible();
    await expect(page.getByTestId("firm-name")).toHaveValue("Acme");
    await page.getByTestId("firm-name").fill("Acme E2E");
    const saved = page.waitForResponse(
        (r) =>
            r.url().includes("/firm") &&
            r.request().method() === "PUT" &&
            r.ok(),
    );
    await page.getByTestId("firm-save").click();
    await saved;
    await page.reload();
    await expect(page.getByTestId("firm-heading")).toBeVisible();
    await expect(page.getByTestId("firm-name")).toHaveValue("Acme E2E");
});

test("admin adds broker and product; trader can buy", async ({ browser }) => {
    const admin = await browser.newPage();
    await signInAdmin(admin);

    await admin.getByTestId("nav-brokers").click();
    await admin.getByTestId("add-broker").click();
    await admin.getByTestId("broker-id").fill("e2e");
    await admin.getByTestId("broker-name").fill("E2E");
    const savedBroker = admin.waitForResponse(
        (r) =>
            r.url().includes("/firm") &&
            r.request().method() === "PUT" &&
            r.ok(),
    );
    await admin.getByTestId("broker-save").click();
    await savedBroker;
    await expect(admin.getByTestId("broker-id")).toHaveValue("e2e");

    await admin.getByTestId("nav-products").click();
    await admin.getByTestId("add-product").click();
    await admin.getByTestId("product-id").fill("e2e-free");
    await admin.getByTestId("product-name").fill("E2E free");
    await admin.getByTestId("product-broker-loopback").click();
    const savedProduct = admin.waitForResponse(
        (r) =>
            r.url().includes("/firm") &&
            r.request().method() === "PUT" &&
            r.ok(),
    );
    await admin.getByTestId("product-save").click();
    await savedProduct;
    await expect(admin.getByTestId("product-id")).toHaveValue("e2e-free");

    const trader = await browser.newPage();
    const email = `t${crypto.randomUUID()}@example.com`;
    await trader.goto(`${traderUrl}/signup`);
    await trader.getByTestId("sign-up-name").fill("Trader");
    await trader.getByTestId("sign-up-email").fill(email);
    await trader.getByTestId("sign-up-password").fill("password12");
    await trader.getByTestId("sign-up-submit").click();
    await expect(trader.getByTestId("products-heading")).toBeVisible();
    await expect(trader.getByText("E2E free", { exact: true })).toBeVisible();
    await trader.getByTestId("product-buy-e2e-free").click();
    await expect(trader.getByTestId("account-status").first()).toHaveText(
        "active",
    );
});
