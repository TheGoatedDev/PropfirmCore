import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { type FirmConfig, loadFirmConfig } from "@propfirmcore/config";

const repoRoot = resolve(import.meta.dirname, "../../../..");

export function loadFirmFromPath(path: string): FirmConfig {
    return loadFirmConfig(readFileSync(path, "utf8"));
}

export function defaultFirmPath(): string {
    const fromEnv = process.env.FIRM_CONFIG_PATH;
    if (!fromEnv) return resolve(repoRoot, "firm.example.json");
    if (isAbsolute(fromEnv)) return fromEnv;
    return resolve(repoRoot, fromEnv);
}
