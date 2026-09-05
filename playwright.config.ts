import { defineConfig, devices } from "@playwright/test";

const apiEnv = {
    DATABASE_URL: "postgres://propfirm:propfirm@localhost:5432/propfirm",
    NATS_URL: "nats://localhost:4222",
    NATS_TOKEN: "dev",
    INGEST_API_KEY: "dev",
    BETTER_AUTH_SECRET: "change-me-to-a-long-random-string",
    BETTER_AUTH_URL: "http://localhost:3000",
    BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
    BOOTSTRAP_ADMIN_PASSWORD: "changeme",
};

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
            command: "pnpm --filter @propfirmcore/server start",
            url: "http://localhost:3000/health",
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: { ...process.env, ...apiEnv },
        },
        {
            command: "pnpm --filter @propfirmcore/server start:worker",
            url: "http://localhost:3000/health",
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: { ...process.env, ...apiEnv },
        },
        {
            command: "pnpm --filter @propfirmcore/trader-web dev",
            url: "http://localhost:5173",
            reuseExistingServer: !process.env.CI,
        },
        {
            command: "pnpm --filter @propfirmcore/admin-web dev",
            url: "http://localhost:5174",
            reuseExistingServer: !process.env.CI,
        },
    ],
});
