import { expect, test } from "@playwright/test";

const traderUrl = "http://localhost:5173";
const adminUrl = "http://localhost:5174";

test("trader cannot use admin", async ({ browser }) => {
    const email = `t${crypto.randomUUID()}@example.com`;
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
    await admin.goto(`${adminUrl}/signin`);
    await admin.getByLabel("Email").fill(email);
    await admin.getByLabel("Password").fill(password);
    await admin.getByRole("button", { name: "Sign in" }).click();
    await expect(admin.getByText("not admin")).toBeVisible();
});
