import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    use: {
        trace: "on-first-retry",
        ...devices["Desktop Chrome"],
    },
    projects: [
        { name: "smoke", testDir: "./e2e/smoke" },
        { name: "regression", testDir: "./e2e/regression" },
    ],
    webServer: [
        {
            command: "node --experimental-strip-types test/start-api-worker.ts",
            url: "http://localhost:3000/health",
            reuseExistingServer: false,
            timeout: 120_000,
        },
        {
            command: "pnpm --filter @propfirmcore/trader-web dev",
            url: "http://localhost:5173",
            reuseExistingServer: false,
        },
        {
            command: "pnpm --filter @propfirmcore/admin-web dev",
            url: "http://localhost:5174",
            reuseExistingServer: false,
        },
    ],
});
