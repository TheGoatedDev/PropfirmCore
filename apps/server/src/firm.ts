import { readFileSync } from "node:fs";
import { type FirmConfig, loadFirmConfig } from "@propfirmcore/config";

export function loadFirmFromPath(path: string): FirmConfig {
    return loadFirmConfig(readFileSync(path, "utf8"));
}

export function defaultFirmPath(): string {
    return (
        process.env.FIRM_CONFIG_PATH ??
        `${import.meta.dirname}/../../../firm.example.json`
    );
}
