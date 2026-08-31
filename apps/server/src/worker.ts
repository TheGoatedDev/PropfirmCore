import { Worker } from "bullmq";
import Redis from "ioredis";

const url = process.env.REDIS_URL;
if (!url) throw new Error("REDIS_URL required");

const connection = new Redis(url, { maxRetriesPerRequest: null });
const worker = new Worker("jobs", async () => undefined, { connection });
worker.on("ready", () => console.log("worker ready"));
