import type { BrokerWrite } from "@propfirmcore/config";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { failMsg, keys } from "../../api.ts";
import { BrokerForm, emptyBroker } from "../../broker-form.tsx";
import { saveFirmSlice } from "../../firm-api.ts";
import { useUi } from "../../stores/ui.ts";

export const Route = createFileRoute("/_app/brokers/new")({
    component: NewBroker,
    staticData: { crumb: "New broker" },
});

function NewBroker() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
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
            if (created) {
                void navigate({
                    to: "/brokers/$id",
                    params: { id: created.id },
                });
            }
        },
        onError: (err) => setError(failMsg(err, "Save failed")),
    });

    return (
        <div className="space-y-4">
            <BrokerForm
                broker={emptyBroker()}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
        </div>
    );
}
