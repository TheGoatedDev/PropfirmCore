import { describe, expect, it, vi } from "vitest";
import { createStaffUser } from "./firm-access.ts";

function fakeAuth(linkAccount: () => Promise<unknown>) {
    const internalAdapter = {
        findUserByEmail: vi.fn(async () => null),
        createUser: vi.fn(async () => ({ id: "u1" })),
        linkAccount: vi.fn(linkAccount),
        deleteUser: vi.fn(async () => {}),
    };
    const ctx = { internalAdapter, password: { hash: async () => "hashed" } };
    return {
        internalAdapter,
        auth: { $context: Promise.resolve(ctx) } as unknown as Parameters<
            typeof createStaffUser
        >[0],
    };
}

const input = { email: "A@x.com", name: "A", password: "pw", role: "trader" };

describe("createStaffUser", () => {
    it("removes the user when the credential row fails", async () => {
        const { auth, internalAdapter } = fakeAuth(async () => {
            throw new Error("db down");
        });
        await expect(createStaffUser(auth, input)).rejects.toThrow("db down");
        expect(internalAdapter.deleteUser).toHaveBeenCalledWith("u1");
    });

    it("lowercases the email and links a credential", async () => {
        const { auth, internalAdapter } = fakeAuth(async () => ({}));
        expect(await createStaffUser(auth, input)).toEqual({ id: "u1" });
        expect(internalAdapter.createUser).toHaveBeenCalledWith(
            { email: "a@x.com", name: "A", role: "trader" },
            { method: "admin" },
        );
        expect(internalAdapter.deleteUser).not.toHaveBeenCalled();
    });
});
