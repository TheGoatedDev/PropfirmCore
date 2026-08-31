import { describe, expect, it } from "vitest";
import { manualAdapter } from "./manual.ts";

describe("manualAdapter", () => {
    it("create has no redirect", async () => {
        const session = await manualAdapter.create({
            paymentId: "p1",
            userId: "u1",
            productId: "50k",
            amount: 99,
            currency: "usd",
        });
        expect(session).toEqual({ paymentId: "p1", redirectUrl: null });
    });

    it("verify id ok", async () => {
        const result = await manualAdapter.verify({
            kind: "id",
            paymentId: "p1",
        });
        expect(result).toEqual({
            ok: true,
            paymentId: "p1",
            providerRef: "manual",
        });
    });

    it("verify webhook rejected", async () => {
        const result = await manualAdapter.verify({
            kind: "webhook",
            headers: new Headers(),
            body: "{}",
        });
        expect(result.ok).toBe(false);
    });
});
