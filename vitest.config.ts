import { configDefaults, defineConfig } from "vitest/config";

const exclude = [...configDefaults.exclude, "e2e/**"];

export default defineConfig({
    test: {
        passWithNoTests: true,
        projects: [
            {
                test: {
                    name: "unit",
                    env: { LOG_LEVEL: "silent" },
                    exclude: [...exclude, "**/*.int.test.ts"],
                },
            },
            {
                test: {
                    name: "int",
                    include: ["**/*.int.test.ts"],
                    exclude,
                    globalSetup: ["./test/vitest-global-setup.ts"],
                },
            },
        ],
    },
});
