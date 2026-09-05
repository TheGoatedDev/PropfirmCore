import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const envFile = "../../.env.example";
const kids = ["src/api.ts", "src/worker.ts"].map((f) =>
    spawn("pnpm", ["exec", "tsx", "watch", `--env-file=${envFile}`, f], {
        cwd,
        stdio: "inherit",
    }),
);

function stop() {
    for (const k of kids) k.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await Promise.race(kids.map((k) => new Promise((r) => k.on("exit", r))));
stop();
