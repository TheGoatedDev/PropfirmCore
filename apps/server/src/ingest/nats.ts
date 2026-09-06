import { AckPolicy, jetstream, jetstreamManager } from "@nats-io/jetstream";
import { connect } from "@nats-io/transport-node";
import type { FirmConfig } from "@propfirmcore/config";
import type { Db } from "../db/db.ts";
import { log } from "../logger.ts";
import {
    decodeFills,
    decodeSnapshot,
    encodeMsg,
    type IngestPublish,
    ingestConsumer,
    ingestFillsSubject,
    ingestSnapshotSubject,
    ingestStream,
} from "./bus.ts";
import { ingestFills, ingestSnapshot } from "./service.ts";

type Nc = Awaited<ReturnType<typeof connect>>;

async function ignoreExists(p: Promise<unknown>) {
    try {
        await p;
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/already (in use|exists)/i.test(msg)) throw e;
    }
}

export async function connectIngest(url: string, token: string): Promise<Nc> {
    const nc = await connect({ servers: url, token });
    const jsm = await jetstreamManager(nc);
    await ignoreExists(
        jsm.streams.add({
            name: ingestStream,
            subjects: [ingestSnapshotSubject, ingestFillsSubject],
        }),
    );
    await ignoreExists(
        jsm.consumers.add(ingestStream, {
            durable_name: ingestConsumer,
            ack_policy: AckPolicy.Explicit,
        }),
    );
    return nc;
}

export function natsPublish(nc: Nc): IngestPublish {
    const js = jetstream(nc);
    return {
        snapshot: async (msg) => {
            await js.publish(ingestSnapshotSubject, encodeMsg(msg));
        },
        fills: async (msg) => {
            await js.publish(ingestFillsSubject, encodeMsg(msg));
        },
    };
}

export async function runIngestWorker(
    nc: Nc,
    db: Db,
    firm: FirmConfig,
): Promise<void> {
    const js = jetstream(nc);
    const consumer = await js.consumers.get(ingestStream, ingestConsumer);
    const messages = await consumer.consume();
    log.info("worker ready");
    for await (const m of messages) {
        try {
            if (m.subject === ingestSnapshotSubject) {
                const msg = decodeSnapshot(m.data);
                await ingestSnapshot(db, firm, msg.accountId, msg);
            } else if (m.subject === ingestFillsSubject) {
                const msg = decodeFills(m.data);
                await ingestFills(db, firm, msg.accountId, msg.fills);
            }
            m.ack();
        } catch (e) {
            log.error({ err: e });
            m.nak();
        }
    }
}
