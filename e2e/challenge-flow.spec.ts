import { expect, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";
const adminUrl = "http://localhost:5174";

test("trader buys, admin completes", async ({ browser }) => {
    const email = `t${Date.now()}@example.com`;
    const password = "password12";

    const trader = await browser.newPage();
    await trader.goto(`${traderUrl}/signup`);
    await trader.getByLabel("Name").fill("Trader");
    await trader.getByLabel("Email").fill(email);
    await trader.getByLabel("Password").fill(password);
    await trader.getByRole("button", { name: "Sign up" }).click();
    await expect(
        trader.getByRole("heading", { name: "Products" }),
    ).toBeVisible();
    await trader.getByRole("button", { name: "Buy" }).click();
    const payment = trader.getByText(/^Payment ID:/);
    await expect(payment).toBeVisible();
    const paymentId = (await payment.textContent())
        ?.replace("Payment ID:", "")
        .trim();
    expect(paymentId).toBeTruthy();

    const admin = await browser.newPage();
    await admin.goto(adminUrl);
    await admin.getByLabel("Email").fill("admin@example.com");
    await admin.getByLabel("Password").fill("changeme");
    await admin.getByRole("button", { name: "Sign in" }).click();
    await expect(
        admin.getByRole("heading", { name: "Accounts" }),
    ).toBeVisible();
    await admin.getByLabel("Payment ID").fill(paymentId ?? "");
    await admin.getByRole("button", { name: "Complete" }).click();
    await expect(admin.getByText("active").first()).toBeVisible();

    await trader.reload();
    await expect(trader.getByText("active").first()).toBeVisible();
});

test("trader cannot use admin", async ({ browser }) => {
    const email = `t${Date.now()}@example.com`;
    const password = "password12";

    const trader = await browser.newPage();
    await trader.goto(`${traderUrl}/signup`);
    await trader.getByLabel("Name").fill("Trader");
    await trader.getByLabel("Email").fill(email);
    await trader.getByLabel("Password").fill(password);
    await trader.getByRole("button", { name: "Sign up" }).click();
    await expect(
        trader.getByRole("heading", { name: "Products" }),
    ).toBeVisible();

    const admin = await browser.newPage();
    await admin.goto(adminUrl);
    await admin.getByLabel("Email").fill(email);
    await admin.getByLabel("Password").fill(password);
    await admin.getByRole("button", { name: "Sign in" }).click();
    await expect(admin.getByText("not admin")).toBeVisible();
});
