import type { Broker } from "@propfirmcore/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { failMsg, keys } from "../../api.ts";
import { BrokerForm } from "../../broker-form.tsx";
import { fetchFirm, saveFirmSlice } from "../../firm-api.ts";
import { useUi } from "../../stores/ui.ts";

export const Route = createFileRoute("/_app/brokers/$id")({
    component: EditBroker,
    staticData: { crumb: "Broker" },
});

function EditBroker() {
    const { id } = Route.useParams();
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const save = useMutation({
        mutationFn: (broker: Broker) =>
            saveFirmSlice((current) => {
                if (!current.brokers.some((b) => b.id === id)) {
                    throw new Error("Broker not found");
                }
                return {
                    ...current,
                    brokers: current.brokers.map((b) =>
                        b.id === id ? broker : b,
                    ),
                };
            }),
        onSuccess: (data, broker) => {
            setError(null);
            qc.setQueryData(keys.firm, data);
            if (broker.id !== id) {
                void navigate({
                    to: "/brokers/$id",
                    params: { id: broker.id },
                });
            }
        },
        onError: (err) => setError(failMsg(err, "Save failed")),
    });

    if (firm.isPending) return <p>Loading</p>;
    if (firm.isError || !firm.data) {
        return <p>{failMsg(firm.error, "Could not load firm")}</p>;
    }
    const broker = firm.data.brokers.find((b) => b.id === id);
    if (!broker) return <p>Broker not found</p>;

    return (
        <div className="space-y-4">
            <BrokerForm
                broker={broker}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
        </div>
    );
}
