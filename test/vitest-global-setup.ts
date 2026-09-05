import { type ChildProcess, spawn } from "node:child_process";
import { startInfra, testAppEnv } from "./infra.ts";

async function waitHealth(): Promise<void> {
    for (let i = 0; i < 120; i++) {
        try {
            const res = await fetch("http://localhost:3000/health");
            if (res.ok) return;
        } catch {
            // not up yet
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("api did not start");
}

function run(
    script: string,
    env: NodeJS.ProcessEnv,
    stdio: "inherit" | ["ignore", "pipe", "inherit"] = "inherit",
): ChildProcess {
    return spawn("pnpm", ["--filter", "@propfirmcore/server", script], {
        env,
        stdio,
        detached: true,
    });
}

async function waitWorker(child: ChildProcess): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        let done = false;
        const t = setTimeout(() => {
            if (done) return;
            done = true;
            reject(new Error("worker did not start"));
        }, 120_000);
        let buf = "";
        child.stdout?.on("data", (chunk: Buffer) => {
            const s = String(chunk);
            process.stdout.write(s);
            buf += s;
            if (!done && buf.includes("worker ready")) {
                done = true;
                clearTimeout(t);
                resolve();
            }
        });
        child.on("exit", (code) => {
            if (done) return;
            done = true;
            clearTimeout(t);
            reject(new Error(`worker exited ${code}`));
        });
    });
}

function killTree(child: ChildProcess) {
    if (child.pid == null) return;
    try {
        process.kill(-child.pid, "SIGKILL");
    } catch {
        child.kill("SIGKILL");
    }
}

export async function setup() {
    const infra = await startInfra();
    const env = {
        ...process.env,
        ...testAppEnv,
        DATABASE_URL: infra.databaseUrl,
        NATS_URL: infra.natsUrl,
    };
    const api = run("start", env);
    await waitHealth();
    const worker = run("start:worker", env, ["ignore", "pipe", "inherit"]);
    await waitWorker(worker);
    return async () => {
        killTree(api);
        killTree(worker);
        await infra.stop();
    };
}
