import { expect, test } from "@playwright/test";

const adminUrl = "http://localhost:5174";

test("an on switch uses the brand colour in dark mode", async ({ page }) => {
    await page.goto(`${adminUrl}/signin`);
    await page.evaluate(() => localStorage.setItem("vite-ui-theme", "dark"));
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByTestId("sign-in-email").fill("admin@example.com");
    await page.getByTestId("sign-in-password").fill("changeme");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("home-heading")).toBeVisible();

    await page.getByTestId("nav-firm").click();
    const kyc = page.getByTestId("modules-kyc-enabled");
    if ((await kyc.getAttribute("aria-checked")) !== "true") await kyc.click();
    await expect(kyc).toHaveAttribute("aria-checked", "true");

    const [switchBg, brandBg] = await kyc.evaluate((el) => {
        const probe = document.createElement("span");
        probe.style.background = "var(--brand)";
        el.parentElement?.append(probe);
        const out = [
            getComputedStyle(el).backgroundColor,
            getComputedStyle(probe).backgroundColor,
        ];
        probe.remove();
        return out;
    });
    expect(switchBg).toBe(brandBg);
});
