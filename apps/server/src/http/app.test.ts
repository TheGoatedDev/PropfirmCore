import { readFileSync } from "node:fs";
import { loadFirmConfig } from "@propfirmcore/config";
import { describe, expect, it } from "vitest";
import type { Auth } from "../auth/auth.ts";
import type { Db } from "../db/db.ts";
import { noopIngestPublish } from "../ingest/bus.ts";
import { type AppDeps, createApp } from "./app.ts";

const auth = {
    handler: () => new Response("not found", { status: 404 }),
    api: {
        getSession: async () => null,
        generateOpenAPISchema: async () => ({
            paths: { "/sign-in/email": { post: {} } },
        }),
    },
} as unknown as Auth;

const firm = loadFirmConfig(
    readFileSync(
        new URL("../../../../firm.example.json", import.meta.url),
        "utf8",
    ),
);

function app() {
    return createApp({
        apiKey: "secret",
        firm,
        db: {} as Db,
        auth,
        publish: noopIngestPublish,
    } satisfies AppDeps);
}

describe("api", () => {
    it("health", async () => {
        const res = await app().request("/health");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
    });

    it("ingest without key is 401", async () => {
        const res = await app().request("/ingest/trading-accounts/a1");
        expect(res.status).toBe(401);
    });

    it("ingest bearer is not enough", async () => {
        const res = await app().request("/ingest/trading-accounts/a1", {
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
        const res = await app().request("/auth/me");
        expect(res.status).toBe(401);
    });

    it("trading accounts without session is 401", async () => {
        const res = await app().request("/trading-accounts");
        expect(res.status).toBe(401);
    });

    it("serves openapi", async () => {
        const res = await app().request("/openapi.json");
        expect(res.status).toBe(200);
        const spec = (await res.json()) as {
            paths: Record<string, unknown>;
            servers?: { url: string }[];
        };
        expect(spec.servers?.[0]?.url).toBe("http://localhost:3000");
        expect(spec.paths["/ingest/trading-accounts"]).toBeUndefined();
        expect(
            spec.paths["/ingest/trading-accounts/{id}/snapshot"],
        ).toBeTruthy();
        expect(spec.paths["/ingest/trading-accounts/{id}/fills"]).toBeTruthy();
        expect(spec.paths["/trading-accounts"]).toBeTruthy();
        expect(spec.paths["/payouts"]).toBeTruthy();
        expect(spec.paths["/payouts/{id}/approve"]).toBeTruthy();
        expect(spec.paths["/products"]).toBeTruthy();
        expect(spec.paths["/auth/me"]).toBeTruthy();
        expect(spec.paths["/me"]).toBeUndefined();
        expect(spec.paths["/auth/sign-in/email"]).toBeTruthy();
    });
});
