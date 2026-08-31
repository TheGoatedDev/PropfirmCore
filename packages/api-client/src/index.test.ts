import { describe, expect, it } from "vitest";
import { createApiClient } from "./index.ts";
import type { paths } from "./schema.ts";

describe("createApiClient", () => {
    it("builds a client", () => {
        const client = createApiClient("http://localhost:3000");
        expect(typeof client.GET).toBe("function");
    });

    it("knows trading accounts", () => {
        const path = "/trading-accounts" satisfies keyof paths;
        expect(path).toBe("/trading-accounts");
    });

    it("knows better-auth sign-in", () => {
        const path = "/auth/sign-in/email" satisfies keyof paths;
        expect(path).toBe("/auth/sign-in/email");
    });
});
