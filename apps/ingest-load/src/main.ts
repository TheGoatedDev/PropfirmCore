import { fork } from "node:child_process";
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ApiClient, createApiClient } from "@propfirmcore/api-client";
import { productSchema } from "@propfirmcore/config";
import { z } from "zod";
import {
    addMs,
    type Behavior,
    behaviors,
    type Path,
    planPath,
    type Step,
} from "./path.ts";

const originTs = "2026-01-15T16:00:00.000Z";
const here = dirname(fileURLToPath(import.meta.url));
const self = fileURLToPath(import.meta.url);
const defaultProfile = resolve(here, "../profiles/default.json");

const profileSchema = z.object({
    baseUrl: z.string().min(1),
    productId: z.string().min(1),
    accounts: z.number().int().positive(),
    rps: z.number().positive(),
    duration: z.string().regex(/^\d+(ms|s|m|h)$/),
    mix: z
        .array(
            z.object({
                behavior: z.enum(behaviors),
                weight: z.number().positive(),
            }),
        )
        .min(1),
});

type Profile = z.infer<typeof profileSchema>;

type Book = {
    id: string;
    behavior: Behavior;
    queue: Step[];
    lastEquity: number;
    lastBalance: number;
    lastTs: string;
    seq: number;
};

type WorkerStart = {
    baseUrl: string;
    apiKey: string;
    rps: number;
    durationMs: number;
    books: Book[];
};

type Progress = { accepted: number; errors: number; inFlight: number };

function die(msg: string): never {
    console.error(msg);
    process.exit(1);
}

function flag(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    if (i === -1) return undefined;
    return process.argv[i + 1];
}

function parseDuration(s: string): number {
    const m = /^(\d+)(ms|s|m|h)$/.exec(s);
    if (!m) throw new Error(`bad duration: ${s}`);
    const n = Number(m[1]);
    const mult = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 } as const;
    return n * mult[m[2] as keyof typeof mult];
}

function pickBehavior(mix: Profile["mix"]): Behavior {
    const total = mix.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const x of mix) {
        r -= x.weight;
        if (r <= 0) return x.behavior;
    }
    return mix[mix.length - 1].behavior;
}

function cookieJar() {
    const bag = new Map<string, string>();
    return {
        header() {
            return [...bag.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
        },
        store(res: Response) {
            for (const raw of res.headers.getSetCookie()) {
                const nv = raw.split(";", 1)[0];
                const eq = nv.indexOf("=");
                if (eq > 0) bag.set(nv.slice(0, eq).trim(), nv.slice(eq + 1));
            }
        },
    };
}

function nextStep(book: Book): Step {
    const s = book.queue.shift();
    if (s) return s;
    book.lastTs = addMs(book.lastTs, 1);
    return {
        kind: "snapshot",
        equity: book.lastEquity,
        balance: book.lastBalance,
        ts: book.lastTs,
    };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeClient(
    baseUrl: string,
    apiKey: string,
    jar?: ReturnType<typeof cookieJar>,
    bearer?: { token?: string },
) {
    return createApiClient(baseUrl, {
        fetch: async (input: Request) => {
            const headers = new Headers(input.headers);
            const cookie = jar?.header();
            if (cookie) headers.set("cookie", cookie);
            if (bearer?.token)
                headers.set("Authorization", `Bearer ${bearer.token}`);
            headers.set("X-Api-Key", apiKey);
            headers.set("Origin", baseUrl);
            const res = await fetch(new Request(input, { headers }));
            jar?.store(res);
            return res;
        },
    });
}

function shard<T>(items: T[], n: number): T[][] {
    const out: T[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < items.length; i++) out[i % n].push(items[i]);
    return out.filter((s) => s.length > 0);
}

async function send(client: ApiClient, book: Book, step: Step) {
    book.seq++;
    const externalId = `${book.id}-${book.seq}`;
    if (step.kind === "snapshot") {
        const { response } = await client.POST(
            "/ingest/trading-accounts/{id}/snapshot",
            {
                params: { path: { id: book.id } },
                body: {
                    externalId,
                    equity: step.equity,
                    balance: step.balance,
                    ts: step.ts,
                    positions: [],
                },
            },
        );
        return response.status === 202;
    }
    const { response } = await client.POST(
        "/ingest/trading-accounts/{id}/fills",
        {
            params: { path: { id: book.id } },
            body: {
                fills: [
                    {
                        externalId,
                        positionId: externalId,
                        symbol: "EURUSD",
                        class: "fx",
                        qty: 1,
                        price: 1.1,
                        side: "buy",
                        ts: step.ts,
                        multiplier: 100_000,
                        tickSize: 0.00001,
                        currency: "USD",
                    },
                ],
            },
        },
    );
    return response.status === 202;
}

async function runIngest(
    client: ApiClient,
    books: Book[],
    rps: number,
    durationMs: number,
    onProgress: (p: Progress) => void,
): Promise<Progress> {
    const start = Date.now();
    const end = start + durationMs;
    const progress: Progress = { accepted: 0, errors: 0, inFlight: 0 };
    let sent = 0;
    let rr = 0;
    const busy = new Set<string>();

    function pick(): Book | undefined {
        for (let n = 0; n < books.length; n++) {
            const b = books[rr++ % books.length];
            if (b && !busy.has(b.id)) return b;
        }
        return undefined;
    }

    const ticks = setInterval(() => onProgress({ ...progress }), 1000);

    while (Date.now() < end) {
        const elapsed = Date.now() - start;
        const target = Math.floor((elapsed * rps) / 1000);
        while (sent < target && Date.now() < end) {
            const book = pick();
            if (!book) break;
            sent++;
            busy.add(book.id);
            progress.inFlight++;
            const step = nextStep(book);
            void send(client, book, step)
                .then((ok) => {
                    if (ok) progress.accepted++;
                    else progress.errors++;
                })
                .catch(() => {
                    progress.errors++;
                })
                .finally(() => {
                    progress.inFlight--;
                    busy.delete(book.id);
                });
        }
        await sleep(5);
    }
    while (progress.inFlight > 0) await sleep(10);
    clearInterval(ticks);
    onProgress({ ...progress });
    return progress;
}

async function workerMain() {
    const start = await new Promise<WorkerStart>((resolve) => {
        process.once("message", (msg) => resolve(msg as WorkerStart));
    });
    const client = makeClient(start.baseUrl, start.apiKey);
    const result = await runIngest(
        client,
        start.books,
        start.rps,
        start.durationMs,
        (p) => process.send?.({ type: "progress", ...p }),
    );
    process.send?.({ type: "done", ...result });
}

function spawnWorker(payload: WorkerStart): {
    done: Promise<Progress>;
    progress: Progress;
} {
    const progress: Progress = { accepted: 0, errors: 0, inFlight: 0 };
    const child = fork(self, [], {
        execArgv: process.execArgv,
        env: { ...process.env, INGEST_LOAD_WORKER: "1" },
    }) as unknown as {
        on(
            event: "message",
            cb: (msg: { type: string } & Progress) => void,
        ): void;
        on(event: "exit", cb: (code: number | null) => void): void;
        on(event: "error", cb: (err: Error) => void): void;
        send(msg: WorkerStart): boolean;
    };
    const done = new Promise<Progress>((resolve, reject) => {
        child.on("message", (msg) => {
            progress.accepted = msg.accepted;
            progress.errors = msg.errors;
            progress.inFlight = msg.inFlight;
            if (msg.type === "done") resolve(progress);
        });
        child.on("exit", (code) => {
            if (code && code !== 0) reject(new Error(`worker exit ${code}`));
        });
        child.on("error", reject);
    });
    child.send(payload);
    return { done, progress };
}

async function main() {
    const profilePath = resolve(flag("--profile") ?? defaultProfile);
    const profile = profileSchema.parse(
        JSON.parse(readFileSync(profilePath, "utf8")) as unknown,
    );
    const durationMs = parseDuration(profile.duration);
    const apiKey = process.env.INGEST_API_KEY ?? "dev";
    const jar = cookieJar();
    const bearer: { token?: string } = {};
    const client = makeClient(profile.baseUrl, apiKey, jar, bearer);

    const health = await fetch(`${profile.baseUrl}/health`);
    if (!health.ok) die(`api down: ${health.status}`);

    const email = `load-${Date.now()}@example.com`;
    const signed = await client.POST("/auth/sign-up/email", {
        body: { name: "load", email, password: "password12" },
    });
    if (signed.error || !signed.data)
        die(`signup failed: ${JSON.stringify(signed.error)}`);
    if (signed.data.token) bearer.token = signed.data.token;

    const listed = await client.GET("/products");
    if (listed.error || !listed.data)
        die(`products failed: ${JSON.stringify(listed.error)}`);
    const products = z.array(productSchema).parse(listed.data);
    const product = products.find((p) => p.id === profile.productId);
    if (!product) die(`unknown product ${profile.productId}`);
    const phase = product.phases[0];
    if ((phase.fee ?? 0) !== 0) die(`product ${product.id} fee is not 0`);
    const ruleset = phase.ruleset;
    const startBalance = phase.balance;

    const assigned: Record<Behavior, number> = {
        passEval: 0,
        blowMaxDd: 0,
        blowDailyDd: 0,
    };
    const books: Book[] = [];
    for (let i = 0; i < profile.accounts; i++) {
        const bought = await client.POST("/products/{id}/buy", {
            params: { path: { id: product.id } },
        });
        if (bought.error || !bought.data)
            die(`buy failed: ${JSON.stringify(bought.error)}`);
        const acc = z
            .object({ id: z.string() })
            .safeParse(bought.data.tradingAccount);
        if (!acc.success) die("buy returned no trading account");
        const behavior = pickBehavior(profile.mix);
        assigned[behavior]++;
        const path: Path = planPath({
            behavior,
            startBalance,
            ruleset,
            originTs,
        });
        books.push({
            id: acc.data.id,
            behavior,
            queue: path.steps,
            lastEquity: path.lastEquity,
            lastBalance: path.lastBalance,
            lastTs: path.lastTs,
            seq: 0,
        });
    }

    const want = Number(flag("--workers") ?? availableParallelism());
    if (!Number.isInteger(want) || want < 1) die("bad --workers");
    const workers = Math.max(1, Math.min(want, books.length));
    const slices = shard(books, workers);
    const rpsEach = profile.rps / slices.length;

    const status = { active: 0, passed: 0, failed: 0 };
    let polling = true;
    const poll = (async () => {
        while (polling) {
            const { data } = await client.GET("/trading-accounts");
            if (data) {
                status.active = 0;
                status.passed = 0;
                status.failed = 0;
                for (const a of data) status[a.status]++;
            }
            await sleep(1000);
        }
    })();

    const start = Date.now();
    const kids = slices.map((slice) =>
        spawnWorker({
            baseUrl: profile.baseUrl,
            apiKey,
            rps: rpsEach,
            durationMs,
            books: slice,
        }),
    );

    const ticks = setInterval(() => {
        const s = Math.floor((Date.now() - start) / 1000);
        let accepted = 0;
        let errors = 0;
        let inFlight = 0;
        for (const k of kids) {
            accepted += k.progress.accepted;
            errors += k.progress.errors;
            inFlight += k.progress.inFlight;
        }
        process.stderr.write(
            `ingest-load ${s}s workers=${kids.length} 202=${accepted} err=${errors} in-flight=${inFlight} active=${status.active} passed=${status.passed} failed=${status.failed}\n`,
        );
    }, 1000);

    const results = await Promise.all(kids.map((k) => k.done));
    clearInterval(ticks);
    polling = false;
    await poll;

    let accepted = 0;
    let errors = 0;
    for (const r of results) {
        accepted += r.accepted;
        errors += r.errors;
    }

    const summary = {
        ok: errors === 0,
        durationMs: Date.now() - start,
        workers: kids.length,
        accepted,
        errors,
        assigned,
        status,
    };
    console.log(JSON.stringify(summary));
    if (errors > 0) process.exit(1);
}

if (process.env.INGEST_LOAD_WORKER === "1") await workerMain();
else await main();
