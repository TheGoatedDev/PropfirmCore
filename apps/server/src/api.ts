import { serve } from "@hono/node-server";
import { createAuth } from "./auth/auth.ts";
import { bootstrapAdmin } from "./auth/bootstrap-admin.ts";
import { createDb, migrate } from "./db/db.ts";
import { env } from "./env.ts";
import { defaultFirmPath, loadFirmFromPath } from "./firm.ts";
import { createApp } from "./http/app.ts";
import { connectIngest, natsPublish } from "./ingest/nats.ts";

const { db } = createDb(env.DATABASE_URL);
await migrate(db);

const auth = createAuth(db, {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
});

if (env.BOOTSTRAP_ADMIN_EMAIL && env.BOOTSTRAP_ADMIN_PASSWORD) {
    await bootstrapAdmin(db, auth, {
        email: env.BOOTSTRAP_ADMIN_EMAIL,
        password: env.BOOTSTRAP_ADMIN_PASSWORD,
    });
}

const nc = await connectIngest(env.NATS_URL, env.NATS_TOKEN);
const app = createApp({
    db,
    firm: loadFirmFromPath(defaultFirmPath(env.FIRM_CONFIG_PATH)),
    apiKey: env.INGEST_API_KEY,
    auth,
    publish: natsPublish(nc),
});

serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" });
console.log(`api :${env.PORT}`);
