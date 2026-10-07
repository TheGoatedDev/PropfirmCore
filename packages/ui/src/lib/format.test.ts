import { describe, expect, it } from "vitest";
import {
    formatAmount,
    formatDateTime,
    formatEnum,
    formatPercent,
} from "./format.ts";

describe("formatAmount", () => {
    it("groups thousands and rounds to cents", () => {
        expect(formatAmount(50006.30219554121)).toBe("50,006.30");
    });

    it("keeps whole numbers at two decimals", () => {
        expect(formatAmount(50000)).toBe("50,000.00");
    });

    it("keeps the sign on losses", () => {
        expect(formatAmount(-1234.5)).toBe("-1,234.50");
    });
});

describe("formatPercent", () => {
    it("renders a rule fraction as a percent", () => {
        expect(formatPercent(0.06)).toBe("6%");
        expect(formatPercent(0.025)).toBe("2.5%");
    });
});

describe("formatDateTime", () => {
    it("renders an ISO timestamp in the given zone", () => {
        expect(formatDateTime("2026-01-15T16:00:00.000Z", "utc")).toBe(
            "Jan 15, 2026, 4:00:00\u202fPM",
        );
    });

    it("returns the input when it is not a timestamp", () => {
        expect(formatDateTime("not a date")).toBe("not a date");
    });
});

describe("formatEnum", () => {
    it("capitalises a lowercase value", () => {
        expect(formatEnum("active")).toBe("Active");
        expect(formatEnum("trader")).toBe("Trader");
    });

    it("splits camelCase into words", () => {
        expect(formatEnum("debitOnApprove")).toBe("Debit on approve");
        expect(formatEnum("multiBrand")).toBe("Multi brand");
    });

    it("splits snake and kebab case", () => {
        expect(formatEnum("not_verified")).toBe("Not verified");
        expect(formatEnum("fail-approve")).toBe("Fail approve");
    });

    it("keeps known acronyms upper case", () => {
        expect(formatEnum("kyc")).toBe("KYC");
    });
});
