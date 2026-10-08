import { expect, test } from "@playwright/test";

const adminUrl = "http://localhost:5174";

test("a custom Role limits what Staff see", async ({ browser }) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const role = `support-${suffix}`;
    const email = `s${suffix}@example.com`;

    const admin = await browser.newPage();
    await admin.goto(`${adminUrl}/signin`);
    await admin.getByTestId("sign-in-email").fill("admin@example.com");
    await admin.getByTestId("sign-in-password").fill("changeme");
    await admin.getByTestId("sign-in-submit").click();

    await admin.getByTestId("nav-roles").click();
    await expect(admin.getByTestId("roles-heading")).toBeVisible();
    await admin.getByTestId("role-create").click();
    await admin.getByTestId("role-name").fill(role);
    await admin.getByTestId("perm-payout-list").click();
    await admin.getByTestId("perm-payout-approve").click();
    await admin.getByTestId("perm-tradingAccount-read").click();
    await admin.getByTestId("role-save").click();
    await expect(admin.getByText(`Support ${suffix}`)).toBeVisible();

    await admin.getByTestId("nav-users").click();
    await admin.getByTestId("user-create").click();
    await admin.getByTestId("user-create-email").fill(email);
    await admin.getByTestId("user-create-name").fill("Sam");
    await admin.getByTestId("user-create-password").fill("password12");
    await admin.getByTestId("user-create-role").selectOption(role);
    await admin.getByTestId("user-create-submit").click();
    await admin.getByTestId("table-filter").fill(email);
    await expect(admin.getByText(email)).toBeVisible();

    const staff = await browser.newPage();
    await staff.goto(`${adminUrl}/signin`);
    await staff.getByTestId("sign-in-email").fill(email);
    await staff.getByTestId("sign-in-password").fill("password12");
    await staff.getByTestId("sign-in-submit").click();

    await expect(staff.getByTestId("nav-payouts")).toBeVisible();
    await expect(staff.getByTestId("nav-roles")).toBeVisible();
    await expect(staff.getByTestId("nav-firm")).toHaveCount(0);
    await expect(staff.getByTestId("nav-users")).toHaveCount(0);
    await expect(
        staff.getByText("Pick a section from the menu."),
    ).toBeVisible();

    await staff.goto(`${adminUrl}/firm`);
    await expect(staff.getByTestId("home-heading")).toBeVisible();

    // read without list: the account page opens, the list does not.
    await staff.goto(`${adminUrl}/trading-accounts/missing`);
    await expect(staff).toHaveURL(`${adminUrl}/trading-accounts/missing`);
    await staff.goto(`${adminUrl}/trading-accounts`);
    await expect(staff.getByTestId("home-heading")).toBeVisible();

    await staff.getByTestId("nav-roles").click();
    await expect(staff.getByTestId("roles-heading")).toBeVisible();
    await expect(staff.getByTestId("role-create")).toHaveCount(0);
});
