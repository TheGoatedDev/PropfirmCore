import { describe, expect, it } from "vitest";
import {
    type BrokerSecrets,
    bridgeKeyOf,
    hashKey,
    ingestKeyPrefix,
    matchIngestKey,
    newIngestKey,
} from "./credentials.ts";

describe("newIngestKey", () => {
    it("is prefixed and unique", () => {
        const a = newIngestKey();
        const b = newIngestKey();
        expect(a.startsWith(ingestKeyPrefix)).toBe(true);
        expect(a.length).toBe(ingestKeyPrefix.length + 43);
        expect(a).not.toBe(b);
    });
});

describe("matchIngestKey", () => {
    const secrets: BrokerSecrets = new Map([
        ["loopback", { ingestKeyHash: hashKey("dev"), bridgeKey: null }],
        ["mock", { ingestKeyHash: hashKey("other"), bridgeKey: "b" }],
        ["revoked", { ingestKeyHash: null, bridgeKey: null }],
    ]);

    it("returns broker id by hash", () => {
        expect(matchIngestKey(secrets, "dev")).toBe("loopback");
        expect(matchIngestKey(secrets, "other")).toBe("mock");
        expect(matchIngestKey(secrets, "nope")).toBeUndefined();
        expect(matchIngestKey(secrets, undefined)).toBeUndefined();
        expect(matchIngestKey(secrets, "")).toBeUndefined();
    });

    it("bridgeKeyOf", () => {
        expect(bridgeKeyOf(secrets, "mock")).toBe("b");
        expect(bridgeKeyOf(secrets, "loopback")).toBeUndefined();
        expect(bridgeKeyOf(secrets, "missing")).toBeUndefined();
    });
});
