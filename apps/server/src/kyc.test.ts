import { describe, expect, it } from "vitest";
import {
    kycBlocksCash,
    kycBlocksFundedEntry,
    kycBlocksInstantFunded,
    kycForMe,
} from "./kyc.ts";

const off = {
    modules: {
        affiliates: false,
        kyc: { enabled: false, gate: "payout" as const },
        multiBrand: false,
    },
};

const payout = {
    modules: {
        affiliates: false,
        kyc: { enabled: true, gate: "payout" as const },
        multiBrand: false,
    },
};

const funded = {
    modules: {
        affiliates: false,
        kyc: { enabled: true, gate: "funded" as const },
        multiBrand: false,
    },
};

const instant = {
    phases: [{ kind: "funded" as const }],
};

const evalFirst = {
    phases: [{ kind: "eval" as const }, { kind: "funded" as const }],
};

describe("kyc gates", () => {
    it("off never blocks", () => {
        expect(kycBlocksCash(off as never, false)).toBe(false);
        expect(kycBlocksFundedEntry(off as never, false)).toBe(false);
        expect(
            kycBlocksInstantFunded(off as never, false, instant as never),
        ).toBe(false);
        expect(kycForMe(off as never)).toBeNull();
    });

    it("payout blocks cash only", () => {
        expect(kycBlocksCash(payout as never, false)).toBe(true);
        expect(kycBlocksCash(payout as never, true)).toBe(false);
        expect(kycBlocksFundedEntry(payout as never, false)).toBe(false);
        expect(
            kycBlocksInstantFunded(payout as never, false, instant as never),
        ).toBe(false);
        expect(kycForMe(payout as never)).toEqual({
            enabled: true,
            gate: "payout",
        });
    });

    it("funded blocks cash, entry, instant-funded buy", () => {
        expect(kycBlocksCash(funded as never, false)).toBe(true);
        expect(kycBlocksFundedEntry(funded as never, false)).toBe(true);
        expect(
            kycBlocksInstantFunded(funded as never, false, instant as never),
        ).toBe(true);
        expect(
            kycBlocksInstantFunded(funded as never, false, evalFirst as never),
        ).toBe(false);
        expect(
            kycBlocksInstantFunded(funded as never, true, instant as never),
        ).toBe(false);
    });
});
