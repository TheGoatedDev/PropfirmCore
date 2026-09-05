import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        passWithNoTests: true,
        exclude: [
            "**/node_modules/**",
            "e2e/**",
            ...(process.env.TEST_INT ? [] : ["**/*.int.test.ts"]),
        ],
    },
});
