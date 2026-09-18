import { describe, expect, it } from "vitest";
import {
    banPlan,
    canTouch,
    createPlan,
    listScope,
    roleOut,
    setRolePlan,
    userOut,
} from "./scope.ts";

const admin: Parameters<typeof listScope>[0] = {
    id: "a1",
    role: "admin",
};
const trader: Parameters<typeof listScope>[0] = {
    id: "t1",
    role: "trader",
};

const traderRow = {
    id: "t2",
    email: "t@x.com",
    name: "T",
    role: "trader",
    banned: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("role out", () => {
    it("admin keeps role", () => {
        expect(roleOut("admin")).toBe("admin");
        expect(userOut({ ...traderRow, role: "admin" }).role).toBe("admin");
    });

    it("unknown role is null", () => {
        expect(roleOut("operator")).toBeNull();
    });
});

describe("listScope", () => {
    it("admin all, trader none", () => {
        expect(listScope(admin)).toBe("all");
        expect(listScope(trader)).toBe("none");
    });
});

describe("canTouch", () => {
    it("admin can, trader cannot", () => {
        expect(canTouch(admin, traderRow)).toBe(true);
        expect(canTouch(trader, traderRow)).toBe(false);
    });
});

describe("createPlan", () => {
    it("needs role", () => {
        expect(createPlan(admin, {})).toEqual({
            ok: false,
            error: "badRequest",
        });
        expect(createPlan(admin, { role: "admin" })).toEqual({
            ok: true,
            role: "admin",
        });
    });

    it("trader cannot create", () => {
        expect(createPlan(trader, { role: "trader" })).toEqual({
            ok: false,
            error: "forbidden",
        });
    });
});

describe("banPlan / setRolePlan", () => {
    it("blocks self", () => {
        expect(banPlan(admin, { ...traderRow, id: admin.id })).toEqual({
            ok: false,
            error: "forbidden",
        });
        expect(
            setRolePlan(admin, { ...traderRow, id: admin.id }, "trader"),
        ).toEqual({ ok: false, error: "forbidden" });
    });

    it("missing target", () => {
        expect(banPlan(admin, undefined)).toEqual({
            ok: false,
            error: "notFound",
        });
    });
});
