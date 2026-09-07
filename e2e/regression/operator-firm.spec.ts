import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const traderUrl = "http://localhost:5173";
const operatorUrl = "http://localhost:5175";

async function signInOperator(page: import("@playwright/test").Page) {
    await page.goto(`${operatorUrl}/signin`);
    await page.getByTestId("sign-in-email").fill("operator@example.com");
    await page.getByTestId("sign-in-password").fill("changeme");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("firm-heading")).toBeVisible();
}

test("operator renames firm and it sticks", async ({ page }) => {
    await signInOperator(page);
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

test("operator adds broker and product; trader can buy", async ({
    browser,
}) => {
    const op = await browser.newPage();
    await signInOperator(op);

    await op.getByTestId("add-broker").click();
    await op.getByTestId("broker-id-1").fill("e2e");
    await op.getByTestId("broker-name-1").fill("E2E");
    const savedBroker = op.waitForResponse(
        (r) =>
            r.url().includes("/firm") &&
            r.request().method() === "PUT" &&
            r.ok(),
    );
    await op.getByTestId("firm-save").click();
    await savedBroker;
    await expect(op.getByTestId("broker-id-1")).toHaveValue("e2e");

    await op.getByTestId("add-product").click();
    await op.getByTestId("product-id-3").fill("e2e-free");
    await op.getByTestId("product-name-3").fill("E2E free");
    await op.getByTestId("product-broker-3-loopback").click();
    const savedProduct = op.waitForResponse(
        (r) =>
            r.url().includes("/firm") &&
            r.request().method() === "PUT" &&
            r.ok(),
    );
    await op.getByTestId("firm-save").click();
    await savedProduct;
    await expect(op.getByTestId("product-id-3")).toHaveValue("e2e-free");

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
