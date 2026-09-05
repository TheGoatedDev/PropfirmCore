import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        passWithNoTests: true,
        globalSetup: process.env.TEST_INT
            ? ["./test/vitest-global-setup.ts"]
            : undefined,
        exclude: [
            "**/node_modules/**",
            "e2e/**",
            ...(process.env.TEST_INT ? [] : ["**/*.int.test.ts"]),
        ],
    },
});
