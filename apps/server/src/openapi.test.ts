import { describe, expect, it } from "vitest";
import { describeTags, withAuthOpenAPI } from "./openapi.ts";

describe("withAuthOpenAPI", () => {
    it("retags auth vs admin and describes groups", async () => {
        const spec = await withAuthOpenAPI(
            {
                paths: {
                    "/me": { get: { tags: ["trader"] } },
                },
            },
            {
                api: {
                    generateOpenAPISchema: async () => ({
                        paths: {
                            "/sign-in/email": { post: { tags: ["Default"] } },
                            "/admin/ban-user": { post: { tags: ["Admin"] } },
                        },
                    }),
                },
            },
        );
        const signIn = spec.paths?.["/auth/sign-in/email"]?.post as
            | { tags: string[] }
            | undefined;
        const ban = spec.paths?.["/auth/admin/ban-user"]?.post as
            | { tags: string[] }
            | undefined;
        expect(signIn?.tags).toEqual(["Authentication"]);
        expect(ban?.tags).toEqual(["Authentication - Admin"]);
        const tags = spec.tags ?? [];
        expect(tags.every((t) => t.description)).toBe(true);
        expect(tags.map((t) => t.name).sort()).toEqual([
            "Authentication",
            "Authentication - Admin",
            "trader",
        ]);
    });
});

describe("describeTags", () => {
    it("fills unknown groups", () => {
        expect(describeTags({ "/x": { get: { tags: ["mystery"] } } })).toEqual([
            { name: "mystery", description: "mystery endpoints." },
        ]);
    });
});
