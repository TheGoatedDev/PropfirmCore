import { describe, expect, it } from "vitest";
import { loadRoles, roleHasPermission, setRoles } from "./index.ts";

describe("roleHasPermission", () => {
    it("admin can set-role", () => {
        expect(roleHasPermission("admin", "user", "set-role")).toBe(true);
    });

    it("admin can list and create users", () => {
        expect(roleHasPermission("admin", "user", "list")).toBe(true);
        expect(roleHasPermission("admin", "user", "create")).toBe(true);
    });

    it("trader cannot set-role", () => {
        expect(roleHasPermission("trader", "user", "set-role")).toBe(false);
    });

    it("unknown role cannot", () => {
        expect(roleHasPermission("mod", "user", "list")).toBe(false);
    });

    it("custom Role from the cache", () => {
        setRoles(new Map([["support", { payout: ["approve"] }]]));
        expect(roleHasPermission("support", "payout", "approve")).toBe(true);
        expect(roleHasPermission("support", "payout", "pay")).toBe(false);
        setRoles(new Map());
        expect(roleHasPermission("support", "payout", "approve")).toBe(false);
    });

    it("admin can complete payment", () => {
        expect(roleHasPermission("admin", "payment", "complete")).toBe(true);
    });

    it("trader cannot complete payment", () => {
        expect(roleHasPermission("trader", "payment", "complete")).toBe(false);
    });

    it("admin can list trading accounts", () => {
        expect(roleHasPermission("admin", "tradingAccount", "resync")).toBe(
            true,
        );
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

    it("admin can write firm", () => {
        expect(roleHasPermission("admin", "firm", "write")).toBe(true);
    });

    it("trader cannot write firm", () => {
        expect(roleHasPermission("trader", "firm", "write")).toBe(false);
    });

    it("admin can write kyc", () => {
        expect(roleHasPermission("admin", "kyc", "write")).toBe(true);
    });

    it("trader cannot write kyc", () => {
        expect(roleHasPermission("trader", "kyc", "write")).toBe(false);
    });
});

describe("loadRoles", () => {
    it("an older reload finishing last does not win", async () => {
        const pending: ((rows: unknown[]) => void)[] = [];
        const db = {
            select: () => ({
                from: () => new Promise((resolve) => pending.push(resolve)),
            }),
        } as unknown as Parameters<typeof loadRoles>[0];
        const older = loadRoles(db);
        const newer = loadRoles(db);
        pending[1]?.([{ name: "ops", permissions: { payout: ["pay"] } }]);
        await newer;
        pending[0]?.([{ name: "ops", permissions: {} }]);
        await older;
        expect(roleHasPermission("ops", "payout", "pay")).toBe(true);
        setRoles(new Map());
    });
});
