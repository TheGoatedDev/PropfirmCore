import { serve } from "@hono/node-server";
import { loadRoles } from "@propfirmcore/access/server";
import { createAuth } from "./auth/auth.ts";
import { bootstrapAdmin } from "./auth/bootstrap-admin.ts";
import { brokerSecrets, loadBrokerSecrets } from "./brokers/credentials.ts";
import { createDb, migrate } from "./db/db.ts";
import { env } from "./env.ts";
import { ensureFirm, loadLiveFirm } from "./firm.ts";
import { createApp } from "./http/app.ts";
import { connectIngest, natsPublish } from "./ingest/nats.ts";
import { log } from "./logger.ts";

const { db, sql } = createDb(env.DATABASE_URL);
await migrate(db);

const firm = await ensureFirm(db, env.FIRM_CONFIG_PATH);
const holder = { current: firm };
await loadBrokerSecrets(db);

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

async function reloadRoles() {
    try {
        await loadRoles(db);
    } catch (err) {
        log.error({ err }, "roles reload");
    }
}
// onlisten runs on every (re)connect: catch NOTIFYs missed while down.
await sql.listen("firm_roles", reloadRoles, reloadRoles);
await loadRoles(db);

await sql.listen("firm_config", async () => {
    try {
        holder.current = await loadLiveFirm(db);
        await loadBrokerSecrets(db);
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
    secrets: brokerSecrets,
    holder,
    auth,
    publish: natsPublish(nc),
});

serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" });
log.info({ port: env.PORT }, "api listening");
