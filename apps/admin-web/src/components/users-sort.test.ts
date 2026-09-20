import { describe, expect, test } from "vitest";
import { nextUserSort } from "./users-sort.ts";

describe("nextUserSort", () => {
    test("toggles default createdAt desc to asc when sort is cleared", () => {
        expect(nextUserSort([{ id: "createdAt", desc: true }], [])).toEqual({
            sort: "createdAt",
            order: "asc",
        });
    });

    test("toggles createdAt asc to desc when sort is cleared", () => {
        expect(nextUserSort([{ id: "createdAt", desc: false }], [])).toEqual({
            sort: "createdAt",
            order: "desc",
        });
    });

    test("falls back to createdAt desc after clearing another column", () => {
        expect(nextUserSort([{ id: "email", desc: true }], [])).toEqual({
            sort: "createdAt",
            order: "desc",
        });
    });
});
