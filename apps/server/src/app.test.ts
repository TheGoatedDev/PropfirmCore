import { readFileSync } from "node:fs";
import { loadFirmConfig } from "@propfirmcore/config";
import { describe, expect, it } from "vitest";
import { type AppDeps, createApp } from "./app.ts";
import type { Auth } from "./auth.ts";
import type { Db } from "./db.ts";

const auth = {
    handler: () => new Response("not found", { status: 404 }),
    api: { getSession: async () => null },
} as unknown as Auth;

const firm = loadFirmConfig(
    readFileSync(
        new URL("../../../firm.example.json", import.meta.url),
        "utf8",
    ),
);

function app() {
    return createApp({
        apiKey: "secret",
        firm,
        db: {} as Db,
        auth,
    } satisfies AppDeps);
}

describe("api", () => {
    it("health", async () => {
        const res = await app().request("/health");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
    });

    it("ingest without key is 401", async () => {
        const res = await app().request("/ingest/accounts/a1");
        expect(res.status).toBe(401);
    });

    it("ingest bearer is not enough", async () => {
        const res = await app().request("/ingest/accounts/a1", {
            headers: { authorization: "Bearer secret" },
        });
        expect(res.status).toBe(401);
    });

    it("webhook unknown provider is 404", async () => {
        const res = await app().request("/checkout/webhook/nope", {
            method: "POST",
            body: "{}",
        });
        expect(res.status).toBe(404);
    });

    it("manual webhook is 400", async () => {
        const res = await app().request("/checkout/webhook/manual", {
            method: "POST",
            body: "{}",
        });
        expect(res.status).toBe(400);
    });

    it("me without session is 401", async () => {
        const res = await app().request("/me");
        expect(res.status).toBe(401);
    });

    it("accounts without session is 401", async () => {
        const res = await app().request("/accounts");
        expect(res.status).toBe(401);
    });

    it("serves openapi", async () => {
        const res = await app().request("/openapi.json");
        expect(res.status).toBe(200);
        const spec = (await res.json()) as { paths: Record<string, unknown> };
        expect(spec.paths["/ingest/accounts/{id}/snapshot"]).toBeTruthy();
        expect(spec.paths["/ingest/accounts/{id}/fills"]).toBeTruthy();
        expect(spec.paths["/accounts"]).toBeTruthy();
        expect(spec.paths["/products"]).toBeTruthy();
    });
});
