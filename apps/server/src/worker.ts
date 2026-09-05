import { createDb } from "./db/db.ts";
import { env } from "./env.ts";
import { defaultFirmPath, loadFirmFromPath } from "./firm.ts";
import { connectIngest, runIngestWorker } from "./ingest/nats.ts";

const { db } = createDb(env.DATABASE_URL);
const nc = await connectIngest(env.NATS_URL, env.NATS_TOKEN);
console.log("worker ready");
await runIngestWorker(
    nc,
    db,
    loadFirmFromPath(defaultFirmPath(env.FIRM_CONFIG_PATH)),
);
