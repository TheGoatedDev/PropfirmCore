import { fillSchema, snapshotSchema } from "@propfirmcore/domain";
import { z } from "zod";

export const ingestStream = "INGEST";
export const ingestConsumer = "worker";
export const ingestSnapshotSubject = "ingest.snapshot";
export const ingestFillsSubject = "ingest.fills";

export const ingestSnapshotMsg = snapshotSchema.extend({
    accountId: z.string().min(1),
});
export const ingestFillsMsg = z.object({
    accountId: z.string().min(1),
    fills: z.array(fillSchema).min(1),
});

export type IngestSnapshotMsg = z.infer<typeof ingestSnapshotMsg>;
export type IngestFillsMsg = z.infer<typeof ingestFillsMsg>;

export type IngestPublish = {
    snapshot(msg: IngestSnapshotMsg): Promise<void>;
    fills(msg: IngestFillsMsg): Promise<void>;
};

export const noopIngestPublish: IngestPublish = {
    snapshot: async () => undefined,
    fills: async () => undefined,
};

export function encodeMsg(msg: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(msg));
}

export function decodeSnapshot(data: Uint8Array): IngestSnapshotMsg {
    return ingestSnapshotMsg.parse(JSON.parse(new TextDecoder().decode(data)));
}

export function decodeFills(data: Uint8Array): IngestFillsMsg {
    return ingestFillsMsg.parse(JSON.parse(new TextDecoder().decode(data)));
}
