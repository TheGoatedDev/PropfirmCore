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

function run(script: string, env: NodeJS.ProcessEnv): ChildProcess {
    return spawn("pnpm", ["--filter", "@propfirmcore/server", script], {
        env,
        stdio: "inherit",
        detached: true,
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
    const worker = run("start:worker", env);
    return async () => {
        killTree(api);
        killTree(worker);
        await infra.stop();
    };
}
