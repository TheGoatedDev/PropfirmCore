import type { BrokerWrite } from "@propfirmcore/config";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requires } from "../../access.ts";
import { failMsg, keys } from "../../api.ts";
import { useRevealedKey } from "../../broker-credentials.tsx";
import { BrokerForm, emptyBroker } from "../../broker-form.tsx";
import { rotateIngestKey, saveFirmSlice } from "../../firm-api.ts";
import { useUi } from "../../stores/ui.ts";

export const Route = createFileRoute("/_app/brokers/new")({
    beforeLoad: requires("firm", "write"),
    component: NewBroker,
    staticData: { crumb: "New broker" },
});

function NewBroker() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const reveal = useRevealedKey((s) => s.reveal);
    const save = useMutation({
        mutationFn: (broker: BrokerWrite) =>
            saveFirmSlice((current) => ({
                ...current,
                brokers: [...current.brokers, broker],
            })),
        onSuccess: (data) => {
            setError(null);
            const prev = qc.getQueryData(keys.firm) as
                | { brokers: { id: string }[] }
                | undefined;
            const created = data.brokers.find(
                (b) => !prev?.brokers.some((x) => x.id === b.id),
            );
            qc.setQueryData(keys.firm, data);
            if (!created) return;
            void rotateIngestKey(created.id)
                .then((key) => {
                    reveal(created.id, key);
                    void qc.invalidateQueries({ queryKey: keys.firm });
                })
                .catch((err: unknown) =>
                    setError(failMsg(err, "Could not generate ingest key")),
                )
                .finally(() => {
                    void navigate({
                        to: "/brokers/$id",
                        params: { id: created.id },
                    });
                });
        },
        onError: (err) => setError(failMsg(err, "Save failed")),
    });

    return (
        <div>
            <BrokerForm
                broker={emptyBroker()}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
        </div>
    );
}
