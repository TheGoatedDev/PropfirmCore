import { describe, expect, it } from "vitest";
import {
    banPlan,
    canTouch,
    createPlan,
    kindOf,
    listScope,
    roleOut,
    setRolePlan,
    userOut,
} from "./scope.ts";

const admin: Parameters<typeof listScope>[0] = {
    id: "a1",
    role: "admin",
};
const operator: Parameters<typeof listScope>[0] = {
    id: "o1",
    role: "operator",
};
const trader: Parameters<typeof listScope>[0] = {
    id: "t1",
    role: "trader",
};

const firmTrader = {
    id: "t2",
    email: "t@x.com",
    name: "T",
    role: "trader",
    banned: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const opRow = {
    ...firmTrader,
    id: "o2",
    email: "o@x.com",
    role: "operator",
};

describe("kind/role out", () => {
    it("operator is kind not role", () => {
        expect(kindOf("operator")).toBe("operator");
        expect(roleOut("operator")).toBeNull();
        expect(userOut(opRow).role).toBeNull();
        expect(userOut(opRow).kind).toBe("operator");
    });

    it("firm admin keeps role", () => {
        expect(kindOf("admin")).toBe("firmUser");
        expect(roleOut("admin")).toBe("admin");
    });
});

describe("listScope", () => {
    it("operator all, admin firm, trader none", () => {
        expect(listScope(operator)).toBe("all");
        expect(listScope(admin)).toBe("firm");
        expect(listScope(trader)).toBe("none");
    });
});

describe("canTouch", () => {
    it("admin cannot touch operator", () => {
        expect(canTouch(admin, firmTrader)).toBe(true);
        expect(canTouch(admin, opRow)).toBe(false);
    });

    it("operator can touch both", () => {
        expect(canTouch(operator, firmTrader)).toBe(true);
        expect(canTouch(operator, opRow)).toBe(true);
    });
});

describe("createPlan", () => {
    it("admin cannot create operator", () => {
        expect(createPlan(admin, { kind: "operator" })).toEqual({
            ok: false,
            error: "forbidden",
        });
    });

    it("operator can create operator", () => {
        expect(createPlan(operator, { kind: "operator" })).toEqual({
            ok: true,
            role: "operator",
        });
    });

    it("firm user needs role", () => {
        expect(createPlan(admin, { kind: "firmUser" })).toEqual({
            ok: false,
            error: "badRequest",
        });
        expect(createPlan(admin, { kind: "firmUser", role: "admin" })).toEqual({
            ok: true,
            role: "admin",
        });
    });

    it("trader cannot create", () => {
        expect(
            createPlan(trader, { kind: "firmUser", role: "trader" }),
        ).toEqual({ ok: false, error: "forbidden" });
    });
});

describe("banPlan / setRolePlan", () => {
    it("blocks self", () => {
        expect(banPlan(admin, { ...firmTrader, id: admin.id })).toEqual({
            ok: false,
            error: "forbidden",
        });
        expect(
            setRolePlan(admin, { ...firmTrader, id: admin.id }, "trader"),
        ).toEqual({ ok: false, error: "forbidden" });
    });

    it("admin operator target is not found", () => {
        expect(banPlan(admin, opRow)).toEqual({
            ok: false,
            error: "notFound",
        });
        expect(setRolePlan(admin, opRow, "admin")).toEqual({
            ok: false,
            error: "notFound",
        });
    });

    it("cannot set role on operator even for operator actor", () => {
        expect(setRolePlan(operator, opRow, "admin")).toEqual({
            ok: false,
            error: "forbidden",
        });
        expect(banPlan(operator, opRow)).toEqual({ ok: true });
    });

    it("missing target", () => {
        expect(banPlan(admin, undefined)).toEqual({
            ok: false,
            error: "notFound",
        });
    });
});
