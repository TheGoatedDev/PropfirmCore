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
    await expect(page.getByTestId("firm-name")).not.toHaveValue("");
    const name = `Acme ${crypto.randomUUID().slice(0, 8)}`;
    await page.getByTestId("firm-name").fill(name);
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
    await expect(page.getByTestId("firm-name")).toHaveValue(name);
});

test("admin adds broker and product; trader can buy", async ({ browser }) => {
    const admin = await browser.newPage();
    await signInAdmin(admin);

    await admin.getByTestId("nav-brokers").click();
    await admin.getByTestId("add-broker").click();
    await admin.getByTestId("broker-name").fill("E2E");
    const savedBroker = admin.waitForResponse(
        (r) =>
            r.url().includes("/firm") &&
            r.request().method() === "PUT" &&
            r.ok(),
    );
    await admin.getByTestId("broker-save").click();
    await savedBroker;
    await expect(admin).toHaveURL(/\/brokers\/[0-9a-f-]{36}$/i);
    await expect(admin.getByTestId("broker-id")).toHaveValue(/[0-9a-f-]{36}/i);
    await expect(admin.getByTestId("broker-ingest-key")).toHaveValue(
        /^pfc_ik_/,
    );
    await expect(admin.getByTestId("broker-ingest-status")).toHaveText("Set");

    await admin.getByTestId("nav-products").click();
    await admin.getByTestId("add-product").click();
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
    await expect(admin).toHaveURL(/\/products\/[0-9a-f-]{36}$/i);
    const productId = admin.url().split("/").pop() ?? "";

    const trader = await browser.newPage();
    const email = `t${crypto.randomUUID()}@example.com`;
    await trader.goto(`${traderUrl}/signup`);
    await trader.getByTestId("sign-up-name").fill("Trader");
    await trader.getByTestId("sign-up-email").fill(email);
    await trader.getByTestId("sign-up-password").fill("password12");
    await trader.getByTestId("sign-up-submit").click();
    await expect(trader.getByTestId("products-heading")).toBeVisible();
    await expect(trader.getByText("E2E free", { exact: true })).toBeVisible();
    await trader.getByTestId(`product-buy-${productId}`).click();
    await expect(trader.getByTestId("account-status").first()).toHaveText(
        "active",
    );
});

test("broker rows open via the Inspect action, not a row click", async ({
    page,
}) => {
    await signInAdmin(page);
    await page.getByTestId("nav-brokers").click();
    await expect(page).toHaveURL(/\/brokers$/);
    await page.getByTestId("table-row-0").click();
    await expect(page).toHaveURL(/\/brokers$/);
    await page.getByTestId("row-actions-0").click();
    await page.getByTestId("broker-inspect-loopback").click();
    await expect(page).toHaveURL(/\/brokers\/loopback$/);
});

test("admin rotates and revokes a broker ingest key", async ({ page }) => {
    await signInAdmin(page);
    await page.getByTestId("nav-brokers").click();
    await page.getByTestId("add-broker").click();
    await page.getByTestId("broker-name").fill("E2E keys");
    await page.getByTestId("broker-save").click();
    const key = page.getByTestId("broker-ingest-key");
    await expect(key).toHaveValue(/^pfc_ik_/);
    const first = await key.inputValue();
    await page.getByTestId("broker-ingest-done").click();
    await expect(key).toBeHidden();

    await page.getByTestId("broker-ingest-rotate").click();
    await page.getByTestId("broker-ingest-rotate-confirm").click();
    await expect(key).toHaveValue(/^pfc_ik_/);
    expect(await key.inputValue()).not.toBe(first);
    await page.getByTestId("broker-ingest-done").click();

    await page.getByTestId("broker-ingest-revoke").click();
    await page.getByTestId("broker-ingest-revoke-confirm").click();
    await expect(page.getByTestId("broker-ingest-status")).toHaveText(
        "Missing",
    );
    await expect(page.getByTestId("broker-ingest-rotate")).toHaveText(
        "Generate",
    );
});
