import { describe, expect, it } from "vitest";
import { apiKeyEqual, matchIngestKey } from "./ingest-key.ts";

describe("apiKeyEqual", () => {
    it("matches", () => {
        expect(apiKeyEqual("abc", "abc")).toBe(true);
        expect(apiKeyEqual("abc", "abd")).toBe(false);
        expect(apiKeyEqual("ab", "abc")).toBe(false);
    });
});

describe("matchIngestKey", () => {
    it("returns broker id", () => {
        const keys = { loopback: "dev", mock: "other" };
        expect(matchIngestKey(keys, "dev")).toBe("loopback");
        expect(matchIngestKey(keys, "other")).toBe("mock");
        expect(matchIngestKey(keys, "nope")).toBeUndefined();
        expect(matchIngestKey(keys, undefined)).toBeUndefined();
    });
});
