import type { Broker } from "@propfirmcore/config";
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
        mutationFn: (broker: Broker) =>
            saveFirmSlice((current) => ({
                ...current,
                brokers: [...current.brokers, broker],
            })),
        onSuccess: (data, broker) => {
            setError(null);
            qc.setQueryData(keys.firm, data);
            void navigate({ to: "/brokers/$id", params: { id: broker.id } });
        },
        onError: (err) => setError(failMsg(err, "Save failed")),
    });

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-semibold">New broker</h1>
            <BrokerForm
                broker={emptyBroker()}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
        </div>
    );
}
