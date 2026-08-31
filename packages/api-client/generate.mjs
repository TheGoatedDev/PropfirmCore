import { execSync } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "oa-"));
copyFileSync(join(root, "openapi.json"), join(dir, "openapi.json"));
execSync(
    "npx --yes -p typescript@5.9.3 -p openapi-typescript@7.13.0 openapi-typescript openapi.json -o schema.ts",
    { cwd: dir, stdio: "inherit" },
);
copyFileSync(join(dir, "schema.ts"), join(root, "src/schema.ts"));
