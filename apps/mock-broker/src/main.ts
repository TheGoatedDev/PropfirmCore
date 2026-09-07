import { createServer, type IncomingMessage } from "node:http";
import {
    drift,
    handleBridge,
    type MockBook,
    makeIngestClient,
    postFill,
    postSnapshot,
    trySeedBook,
} from "@propfirmcore/mock-broker";
import { log } from "./logger.ts";

function env(name: string, fallback?: string): string {
    const v = process.env[name] ?? fallback;
    if (v == null || v === "") {
        log.error(`missing ${name}`);
        process.exit(1);
    }
    return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitHealth(baseUrl: string) {
    for (;;) {
        try {
            const res = await fetch(`${baseUrl}/health`);
            if (res.ok) return;
        } catch {
            // mill not up
        }
        await sleep(500);
    }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString()) as unknown;
}

function accountIdOf(body: unknown): string | undefined {
    if (!body || typeof body !== "object" || !("accountId" in body)) {
        return undefined;
    }
    const id = body.accountId;
    return typeof id === "string" && id.length > 0 ? id : undefined;
}

const baseUrl = env("BASE_URL", "http://localhost:3000");
const apiKey = env("INGEST_API_KEY_MOCK", "dev");
const port = Number(env("MOCK_BROKER_PORT", "4000"));
const tickMs = Number(env("TICK_MS", "1000"));
const expectedKey = process.env.BRIDGE_WEBHOOK_KEY_MOCK || undefined;
const wantedIds = (process.env.ACCOUNT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const client = makeIngestClient(baseUrl, apiKey);
const books = new Map<string, MockBook>();

async function ensure(id: string) {
    if (books.has(id)) return;
    const book = await trySeedBook(client, id);
    if (!book) return;
    books.set(id, book);
    log.info({ id }, "seeded");
}

const server = createServer((req, res) => {
    if (req.method !== "POST") {
        res.writeHead(404).end();
        return;
    }
    const headerKey =
        typeof req.headers["x-api-key"] === "string"
            ? req.headers["x-api-key"]
            : undefined;
    void readJson(req)
        .then(async (body) => {
            const id = accountIdOf(body);
            if (id) await ensure(id);
            const result = handleBridge(books, expectedKey, headerKey, body);
            if (result.body) {
                res.writeHead(result.status, {
                    "content-type": "application/json",
                }).end(JSON.stringify(result.body));
                return;
            }
            res.writeHead(result.status).end();
        })
        .catch(() => {
            res.writeHead(400).end();
        });
});

server.listen(port, () => {
    log.info({ port, wantedIds }, "mock-broker");
});

async function tick() {
    for (const id of wantedIds) await ensure(id);
    const ts = new Date().toISOString();
    for (const book of books.values()) {
        const id = book.account.id;
        if (!book.frozen) {
            drift(book);
            const fillStatus = await postFill(client, book, ts);
            if (fillStatus !== 202 && fillStatus !== 409) {
                log.warn({ id, status: fillStatus, kind: "fills" });
            }
        }
        const snapStatus = await postSnapshot(client, book, ts);
        if (snapStatus !== 202) {
            log.warn({ id, status: snapStatus, kind: "snapshot" });
        }
    }
}

await waitHealth(baseUrl);
log.info("mill up");

let ticking = false;
setInterval(() => {
    if (ticking) return;
    ticking = true;
    void tick().finally(() => {
        ticking = false;
    });
}, tickMs);
void tick();
