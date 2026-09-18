import { serve } from "@hono/node-server";
import { createAuth } from "./auth/auth.ts";
import { bootstrapAdmin } from "./auth/bootstrap-admin.ts";
import { createDb, migrate } from "./db/db.ts";
import { env } from "./env.ts";
import { ensureFirm, loadLiveFirm } from "./firm.ts";
import { createApp } from "./http/app.ts";
import { ingestKeysFromEnv } from "./ingest/ingest-key.ts";
import { connectIngest, natsPublish } from "./ingest/nats.ts";
import { log } from "./logger.ts";

const { db, sql } = createDb(env.DATABASE_URL);
await migrate(db);

const firm = await ensureFirm(db, env.FIRM_CONFIG_PATH);
const holder = {
    current: firm,
    ingestKeys: ingestKeysFromEnv(firm),
};

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

await sql.listen("firm_config", async () => {
    try {
        holder.current = await loadLiveFirm(db);
        const next = ingestKeysFromEnv(holder.current);
        for (const k of Object.keys(holder.ingestKeys)) {
            delete holder.ingestKeys[k];
        }
        Object.assign(holder.ingestKeys, next);
    } catch (err) {
        log.error({ err }, "firm reload");
    }
});

const nc = await connectIngest(env.NATS_URL, env.NATS_TOKEN);
const app = createApp({
    db,
    get firm() {
        return holder.current;
    },
    ingestKeys: holder.ingestKeys,
    holder,
    auth,
    publish: natsPublish(nc),
});

serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" });
log.info({ port: env.PORT }, "api listening");
