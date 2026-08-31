import type { CheckoutAdapter, VerifyResult } from "./port.ts";

export const manualAdapter: CheckoutAdapter = {
    async create(req) {
        return { paymentId: req.paymentId, redirectUrl: null };
    },
    async verify(input): Promise<VerifyResult> {
        if (input.kind === "id") {
            return {
                ok: true,
                paymentId: input.paymentId,
                providerRef: "manual",
            };
        }
        return { ok: false, reason: "manual has no webhook" };
    },
};
