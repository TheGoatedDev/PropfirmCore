import type { BrokerView } from "@propfirmcore/config";
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@propfirmcore/ui/components/alert";
import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import { useConfirm } from "@propfirmcore/ui/components/confirm-dialog";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import { SettingsSection } from "@propfirmcore/ui/components/settings";
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
    const confirm = useConfirm();
    const [copied, setCopied] = useState(false);

    const rotate = useMutation({
        mutationFn: () => rotateIngestKey(broker.id),
        onSuccess: (key) => {
            setError(null);
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
            dismiss();
            void qc.invalidateQueries({ queryKey: keys.firm });
        },
        onError: (err) => setError(failMsg(err, "Revoke failed")),
    });

    return (
        <SettingsSection
            title="Ingest key"
            description={
                <>
                    The broker sends this as <code>X-Api-Key</code> when it
                    pushes snapshots and fills. Without it, ingest is refused.
                </>
            }
            fields="space-y-3"
        >
            <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <KeyStatus
                    set={broker.hasIngestKey}
                    testId="broker-ingest-status"
                />
            </div>
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
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    data-testid="broker-ingest-rotate"
                    onClick={async () => {
                        if (
                            broker.hasIngestKey &&
                            !(await confirm({
                                title: "Rotate the ingest key?",
                                description:
                                    "The current key stops working now. Update the bridge with the new key before it sends again.",
                                confirmLabel: "Rotate key",
                                variant: "destructive",
                                testId: "broker-ingest-rotate-confirm",
                            }))
                        ) {
                            return;
                        }
                        rotate.mutate();
                    }}
                    disabled={rotate.isPending}
                >
                    {broker.hasIngestKey ? "Rotate" : "Generate"}
                </Button>
                {broker.hasIngestKey ? (
                    <Button
                        type="button"
                        variant="ghost"
                        data-testid="broker-ingest-revoke"
                        disabled={revoke.isPending}
                        onClick={async () => {
                            const ok = await confirm({
                                title: "Revoke the ingest key?",
                                description:
                                    "Ingest for this broker is refused until you generate a new key.",
                                confirmLabel: "Revoke key",
                                variant: "destructive",
                                testId: "broker-ingest-revoke-confirm",
                            });
                            if (ok) revoke.mutate();
                        }}
                    >
                        Revoke
                    </Button>
                ) : null}
            </div>
        </SettingsSection>
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
        <SettingsSection
            title="Bridge key"
            description={
                <>
                    Sent as <code>X-Api-Key</code> on every call to the bridge
                    URL. Write-only: it is never shown again.
                </>
            }
            fields="space-y-3"
        >
            <form
                className="space-y-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (value) save.mutate(value);
                }}
            >
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <KeyStatus
                        set={broker.hasBridgeKey}
                        testId="broker-bridge-status"
                    />
                </div>
                <Label htmlFor="broker-bridge-key" className="sr-only">
                    Bridge key
                </Label>
                <div className="flex gap-2">
                    <Input
                        id="broker-bridge-key"
                        data-testid="broker-bridge-key"
                        type="password"
                        autoComplete="off"
                        placeholder={
                            broker.hasBridgeKey ? "Replace key" : "Key"
                        }
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
        </SettingsSection>
    );
}

export function BrokerCredentials({ broker }: { broker: BrokerView }) {
    return (
        // Continues the form's section list, so the first block keeps its rule.
        <div className="[&>section:first-child]:border-t [&>section:first-child]:pt-6">
            <IngestKey broker={broker} />
            {broker.bridge.provider === "webhook" ? (
                <BridgeKey broker={broker} />
            ) : null}
        </div>
    );
}
