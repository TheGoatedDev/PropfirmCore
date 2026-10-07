import type { BrokerView } from "@propfirmcore/config";
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@propfirmcore/ui/components/alert";
import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { create } from "zustand";
import { failMsg, keys } from "./api.ts";
import { revokeIngestKey, rotateIngestKey, setBridgeKey } from "./firm-api.ts";
import { useUi } from "./stores/ui.ts";

/** The one-time Ingest key, held in memory only until the Admin dismisses it. */
export const useRevealedKey = create<{
    revealed: { brokerId: string; key: string } | null;
    reveal: (brokerId: string, key: string) => void;
    dismiss: () => void;
}>()((set) => ({
    revealed: null,
    reveal: (brokerId, key) => set({ revealed: { brokerId, key } }),
    dismiss: () => set({ revealed: null }),
}));

function KeyStatus({ set, testId }: { set: boolean; testId: string }) {
    return (
        <Badge variant={set ? "success" : "destructive"} data-testid={testId}>
            {set ? "Set" : "Missing"}
        </Badge>
    );
}

function IngestKey({ broker }: { broker: BrokerView }) {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const revealed = useRevealedKey((s) =>
        s.revealed?.brokerId === broker.id ? s.revealed.key : null,
    );
    const reveal = useRevealedKey((s) => s.reveal);
    const dismiss = useRevealedKey((s) => s.dismiss);
    const [confirm, setConfirm] = useState<"rotate" | "revoke" | null>(null);
    const [copied, setCopied] = useState(false);

    const rotate = useMutation({
        mutationFn: () => rotateIngestKey(broker.id),
        onSuccess: (key) => {
            setError(null);
            setConfirm(null);
            setCopied(false);
            reveal(broker.id, key);
            void qc.invalidateQueries({ queryKey: keys.firm });
        },
        onError: (err) => setError(failMsg(err, "Rotate failed")),
    });
    const revoke = useMutation({
        mutationFn: () => revokeIngestKey(broker.id),
        onSuccess: () => {
            setError(null);
            setConfirm(null);
            dismiss();
            void qc.invalidateQueries({ queryKey: keys.firm });
        },
        onError: (err) => setError(failMsg(err, "Revoke failed")),
    });

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Ingest key</span>
                <KeyStatus
                    set={broker.hasIngestKey}
                    testId="broker-ingest-status"
                />
            </div>
            <p className="text-sm text-muted-foreground">
                The broker sends this as <code>X-Api-Key</code> on ingest.
            </p>
            {revealed ? (
                <Alert data-testid="broker-ingest-revealed">
                    <AlertTitle>Copy this key now</AlertTitle>
                    <AlertDescription className="space-y-2">
                        <p>It is shown once. Rotate again if you lose it.</p>
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                aria-label="New ingest key"
                                data-testid="broker-ingest-key"
                                value={revealed}
                                onFocus={(e) => e.currentTarget.select()}
                                className="font-mono"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                data-testid="broker-ingest-copy"
                                onClick={() => {
                                    void navigator.clipboard
                                        .writeText(revealed)
                                        .then(() => setCopied(true));
                                }}
                            >
                                {copied ? "Copied" : "Copy"}
                            </Button>
                            <Button
                                type="button"
                                data-testid="broker-ingest-done"
                                onClick={dismiss}
                            >
                                Done
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            ) : null}
            {confirm ? (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm" role="status">
                        {confirm === "rotate"
                            ? "The current key stops working now."
                            : "Ingest for this broker is refused until you rotate."}
                    </span>
                    <Button
                        type="button"
                        variant="destructive"
                        data-testid={`broker-ingest-${confirm}-confirm`}
                        disabled={rotate.isPending || revoke.isPending}
                        onClick={() =>
                            confirm === "rotate"
                                ? rotate.mutate()
                                : revoke.mutate()
                        }
                    >
                        {confirm === "rotate" ? "Rotate key" : "Revoke key"}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setConfirm(null)}
                    >
                        Cancel
                    </Button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        data-testid="broker-ingest-rotate"
                        onClick={() =>
                            broker.hasIngestKey
                                ? setConfirm("rotate")
                                : rotate.mutate()
                        }
                        disabled={rotate.isPending}
                    >
                        {broker.hasIngestKey ? "Rotate" : "Generate"}
                    </Button>
                    {broker.hasIngestKey ? (
                        <Button
                            type="button"
                            variant="ghost"
                            data-testid="broker-ingest-revoke"
                            onClick={() => setConfirm("revoke")}
                        >
                            Revoke
                        </Button>
                    ) : null}
                </div>
            )}
        </div>
    );
}

function BridgeKey({ broker }: { broker: BrokerView }) {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const [value, setValue] = useState("");
    const save = useMutation({
        mutationFn: (key: string | null) => setBridgeKey(broker.id, key),
        onSuccess: () => {
            setError(null);
            setValue("");
            void qc.invalidateQueries({ queryKey: keys.firm });
        },
        onError: (err) => setError(failMsg(err, "Save failed")),
    });

    return (
        <form
            className="space-y-2"
            onSubmit={(e) => {
                e.preventDefault();
                if (value) save.mutate(value);
            }}
        >
            <div className="flex items-center gap-2">
                <Label htmlFor="broker-bridge-key">Bridge key</Label>
                <KeyStatus
                    set={broker.hasBridgeKey}
                    testId="broker-bridge-status"
                />
            </div>
            <p className="text-sm text-muted-foreground">
                Sent as <code>X-Api-Key</code> on calls to the bridge url.
                Write-only.
            </p>
            <div className="flex max-w-xl gap-2">
                <Input
                    id="broker-bridge-key"
                    data-testid="broker-bridge-key"
                    type="password"
                    autoComplete="off"
                    placeholder={broker.hasBridgeKey ? "Replace key" : "Key"}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                />
                <Button
                    type="submit"
                    data-testid="broker-bridge-key-save"
                    disabled={!value || save.isPending}
                >
                    Save
                </Button>
                {broker.hasBridgeKey ? (
                    <Button
                        type="button"
                        variant="ghost"
                        data-testid="broker-bridge-key-clear"
                        disabled={save.isPending}
                        onClick={() => save.mutate(null)}
                    >
                        Clear
                    </Button>
                ) : null}
            </div>
        </form>
    );
}

export function BrokerCredentials({ broker }: { broker: BrokerView }) {
    return (
        <section className="max-w-xl space-y-6 border-t pt-4">
            <h2 className="text-base font-semibold">Credentials</h2>
            <IngestKey broker={broker} />
            {broker.bridge.provider === "webhook" ? (
                <BridgeKey broker={broker} />
            ) : null}
        </section>
    );
}
