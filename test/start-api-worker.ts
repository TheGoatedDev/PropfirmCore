import { spawn } from "node:child_process";
import { startInfra, testAppEnv } from "./infra.ts";

const infra = await startInfra();
const env = {
    ...process.env,
    ...testAppEnv,
    DATABASE_URL: infra.databaseUrl,
    NATS_URL: infra.natsUrl,
};

function run(script: string) {
    const child = spawn("pnpm", ["--filter", "@propfirmcore/server", script], {
        env,
        stdio: "inherit",
    });
    child.on("exit", (code) => {
        if (code) process.exit(code);
    });
}

run("start");
run("start:worker");
