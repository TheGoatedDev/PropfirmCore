import { describe, expect, it } from "vitest";
import { describeTags, withAuthOpenAPI } from "./openapi.ts";

describe("withAuthOpenAPI", () => {
    it("retags auth paths and describes groups", async () => {
        const spec = await withAuthOpenAPI(
            {
                paths: {},
            },
            {
                api: {
                    generateOpenAPISchema: async () => ({
                        paths: {
                            "/sign-in/email": { post: { tags: ["Default"] } },
                        },
                    }),
                },
            },
        );
        const signIn = spec.paths?.["/auth/sign-in/email"]?.post as
            | { tags: string[] }
            | undefined;
        expect(signIn?.tags).toEqual(["Authentication"]);
        const tags = spec.tags ?? [];
        expect(tags.every((t) => t.description)).toBe(true);
        expect(tags.map((t) => t.name)).toEqual(["Authentication"]);
    });
});

describe("describeTags", () => {
    it("fills unknown groups", () => {
        expect(describeTags({ "/x": { get: { tags: ["mystery"] } } })).toEqual([
            { name: "mystery", description: "mystery endpoints." },
        ]);
    });
});
