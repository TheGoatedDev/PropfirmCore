import { createDb, migrate } from "./db/db.ts";
import { env } from "./env.ts";
import { ensureFirm, loadLiveFirm } from "./firm.ts";
import { connectIngest, runIngestWorker } from "./ingest/nats.ts";
import { log } from "./logger.ts";

const { db, sql } = createDb(env.DATABASE_URL);
await migrate(db);
const holder = { current: await ensureFirm(db, env.FIRM_CONFIG_PATH) };
await sql.listen("firm_config", async () => {
    try {
        holder.current = await loadLiveFirm(db);
    } catch (err) {
        log.error({ err }, "firm reload");
    }
});
const nc = await connectIngest(env.NATS_URL, env.NATS_TOKEN);
await runIngestWorker(nc, db, () => holder.current);
