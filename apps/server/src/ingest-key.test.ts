import { describe, expect, it } from "vitest";
import { apiKeyEqual } from "./ingest-key.ts";

describe("apiKeyEqual", () => {
    it("matches", () => {
        expect(apiKeyEqual("abc", "abc")).toBe(true);
        expect(apiKeyEqual("abc", "abd")).toBe(false);
        expect(apiKeyEqual("ab", "abc")).toBe(false);
    });
});
