import { serve } from "@hono/node-server";
import { createAuth } from "./auth/auth.ts";
import { bootstrapAdmin } from "./auth/bootstrap-admin.ts";
import { createDb, migrate } from "./db/db.ts";
import { createApp } from "./http/app.ts";
import { defaultFirmPath, loadFirmFromPath } from "./http/firm.ts";

const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.INGEST_API_KEY;
const secret = process.env.BETTER_AUTH_SECRET;
if (!databaseUrl) throw new Error("DATABASE_URL required");
if (!apiKey) throw new Error("INGEST_API_KEY required");
if (!secret) throw new Error("BETTER_AUTH_SECRET required");

const { db } = createDb(databaseUrl);
await migrate(db);

const auth = createAuth(db, {
    secret,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (bootstrapEmail && bootstrapPassword) {
    await bootstrapAdmin(db, auth, {
        email: bootstrapEmail,
        password: bootstrapPassword,
    });
}

const app = createApp({
    db,
    firm: loadFirmFromPath(defaultFirmPath()),
    apiKey,
    auth,
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
console.log(`api :${port}`);
