import { describe, expect, it } from "vitest";
import {
    builtinRoles,
    cleanPermissions,
    hasPermission,
    isBuiltinRole,
    isStaff,
    permissionsOf,
    permissionsSchema,
    roleNameSchema,
    within,
} from "./index.ts";

const support = { payout: ["read", "list", "approve"] } as const;

describe("permissionsSchema", () => {
    it("accepts catalog actions", () => {
        expect(permissionsSchema.parse(support)).toEqual(support);
    });

    it("rejects unknown resources and actions", () => {
        expect(permissionsSchema.safeParse({ payout: ["steal"] }).success).toBe(
            false,
        );
        expect(permissionsSchema.safeParse({ session: ["list"] }).success).toBe(
            false,
        );
    });
});

describe("within", () => {
    it("subset is within", () => {
        expect(within({ payout: ["read"] }, support)).toBe(true);
    });

    it("peers are within each other", () => {
        expect(within(support, support)).toBe(true);
    });

    it("an extra action is not within", () => {
        expect(within({ payout: ["pay"] }, support)).toBe(false);
        expect(within({ firm: ["write"] }, support)).toBe(false);
    });

    it("everything is within admin; nothing but trader is within trader", () => {
        expect(within(support, builtinRoles.admin)).toBe(true);
        expect(within(builtinRoles.trader, builtinRoles.trader)).toBe(true);
        expect(within(support, builtinRoles.trader)).toBe(false);
    });
});

describe("isStaff", () => {
    it("needs at least one Permission", () => {
        expect(isStaff(builtinRoles.trader)).toBe(false);
        expect(isStaff({ payout: [] })).toBe(false);
        expect(isStaff(support)).toBe(true);
        expect(isStaff(builtinRoles.admin)).toBe(true);
    });
});

describe("permissionsOf", () => {
    const custom = new Map([
        ["support", support],
        ["admin", {}],
    ]);

    it("builtins win over a same-named custom Role", () => {
        expect(
            hasPermission(permissionsOf("admin", custom), "firm", "write"),
        ).toBe(true);
    });

    it("custom Roles come from the map", () => {
        expect(
            hasPermission(
                permissionsOf("support", custom),
                "payout",
                "approve",
            ),
        ).toBe(true);
    });

    it("unknown Role has nothing", () => {
        expect(permissionsOf("ghost", custom)).toEqual({});
    });
});

describe("role names", () => {
    it("builtins are reserved", () => {
        expect(isBuiltinRole("admin")).toBe(true);
        expect(isBuiltinRole("trader")).toBe(true);
        expect(isBuiltinRole("toString")).toBe(false);
    });

    it("slug only", () => {
        expect(roleNameSchema.safeParse("support-junior").success).toBe(true);
        expect(roleNameSchema.safeParse("Support").success).toBe(false);
        expect(roleNameSchema.safeParse("a").success).toBe(false);
        expect(roleNameSchema.safeParse("-x").success).toBe(false);
    });
});

describe("cleanPermissions", () => {
    it("drops unknown resources and actions, dedupes, orders", () => {
        expect(
            cleanPermissions({
                payout: ["approve", "steal", "read", "approve"],
                session: ["list"],
                firm: [],
                kyc: "write",
            }),
        ).toEqual({ payout: ["read", "approve"] });
    });

    it("non-objects clean to nothing", () => {
        expect(cleanPermissions(null)).toEqual({});
        expect(cleanPermissions("admin")).toEqual({});
    });
});
