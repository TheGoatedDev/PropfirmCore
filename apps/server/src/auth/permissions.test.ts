import { describe, expect, it } from "vitest";
import { roleHasPermission } from "./permissions.ts";

describe("roleHasPermission", () => {
    it("admin can set-role", () => {
        expect(roleHasPermission("admin", "user", "set-role")).toBe(true);
    });

    it("trader cannot set-role", () => {
        expect(roleHasPermission("trader", "user", "set-role")).toBe(false);
    });

    it("unknown role cannot", () => {
        expect(roleHasPermission("mod", "user", "list")).toBe(false);
    });

    it("comma roles: trader,admin can", () => {
        expect(roleHasPermission("trader,admin", "user", "ban")).toBe(true);
    });

    it("admin can complete payment", () => {
        expect(roleHasPermission("admin", "payment", "complete")).toBe(true);
    });

    it("trader cannot complete payment", () => {
        expect(roleHasPermission("trader", "payment", "complete")).toBe(false);
    });

    it("admin can list trading accounts", () => {
        expect(roleHasPermission("admin", "tradingAccount", "list")).toBe(true);
    });

    it("trader cannot list all trading accounts", () => {
        expect(roleHasPermission("trader", "tradingAccount", "list")).toBe(
            false,
        );
    });

    it("admin can approve payout", () => {
        expect(roleHasPermission("admin", "payout", "approve")).toBe(true);
    });

    it("trader cannot approve payout", () => {
        expect(roleHasPermission("trader", "payout", "approve")).toBe(false);
    });
});
