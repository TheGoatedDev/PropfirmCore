import { type Actor, setRoles } from "@propfirmcore/access/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    banPlan,
    createPlan,
    listScope,
    setRolePlan,
    userOut,
} from "./scope.ts";

const admin: Actor = { id: "a1", role: "admin" };
const trader: Actor = { id: "t1", role: "trader" };
const ops: Actor = { id: "o1", role: "user-ops" };

const row = (id: string, role: string) => ({
    id,
    email: `${id}@x.com`,
    name: id,
    role,
    banned: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

beforeEach(() => {
    setRoles(
        new Map([
            ["user-ops", { user: ["list", "create", "ban", "set-role"] }],
            ["finance", { payout: ["pay"] }],
        ]),
    );
});

afterEach(() => setRoles(new Map()));

describe("userOut", () => {
    it("passes custom Roles through", () => {
        expect(userOut(row("u1", "user-ops")).role).toBe("user-ops");
    });
});

describe("listScope", () => {
    it("needs user:list", () => {
        expect(listScope(admin)).toBe("all");
        expect(listScope(ops)).toBe("all");
        expect(listScope(trader)).toBe("none");
    });
});

describe("createPlan", () => {
    it("Role must exist and be within the actor", () => {
        expect(createPlan(admin, { role: "ghost" })).toEqual({
            ok: false,
            error: "badRequest",
        });
        expect(createPlan(admin, { role: "finance" })).toEqual({ ok: true });
        expect(createPlan(ops, { role: "user-ops" })).toEqual({ ok: true });
        expect(createPlan(ops, { role: "finance" })).toEqual({
            ok: false,
            error: "forbidden",
        });
        expect(createPlan(ops, { role: "admin" })).toEqual({
            ok: false,
            error: "forbidden",
        });
    });

    it("trader cannot create", () => {
        expect(createPlan(trader, { role: "trader" })).toEqual({
            ok: false,
            error: "forbidden",
        });
    });
});

describe("banPlan", () => {
    it("blocks self, stronger targets, missing targets", () => {
        expect(banPlan(admin, row(admin.id, "admin"))).toEqual({
            ok: false,
            error: "forbidden",
        });
        expect(banPlan(ops, row("a2", "admin"))).toEqual({
            ok: false,
            error: "forbidden",
        });
        expect(banPlan(ops, row("o2", "user-ops"))).toEqual({ ok: true });
        expect(banPlan(admin, undefined)).toEqual({
            ok: false,
            error: "notFound",
        });
    });
});

describe("setRolePlan", () => {
    it("current and new Role must both be within the actor", () => {
        expect(setRolePlan(ops, row("a2", "admin"), "trader")).toEqual({
            ok: false,
            error: "forbidden",
        });
        expect(setRolePlan(ops, row("t2", "trader"), "finance")).toEqual({
            ok: false,
            error: "forbidden",
        });
        expect(setRolePlan(ops, row("t2", "trader"), "user-ops")).toEqual({
            ok: true,
        });
        expect(setRolePlan(admin, row("t2", "trader"), "ghost")).toEqual({
            ok: false,
            error: "badRequest",
        });
        expect(setRolePlan(admin, row(admin.id, "admin"), "trader")).toEqual({
            ok: false,
            error: "forbidden",
        });
    });
});
