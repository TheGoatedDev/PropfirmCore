import type { BrokerWrite } from "@propfirmcore/config";
import { EmptyNote } from "@propfirmcore/ui/components/page-section";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { failMsg, keys } from "../../api.ts";
import { BrokerCredentials } from "../../broker-credentials.tsx";
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
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const save = useMutation({
        mutationFn: (broker: BrokerWrite) =>
            saveFirmSlice((current) => {
                if (!current.brokers.some((b) => b.id === id)) {
                    throw new Error("Broker not found");
                }
                return {
                    ...current,
                    brokers: current.brokers.map((b) =>
                        b.id === id ? { ...broker, id } : b,
                    ),
                };
            }),
        onSuccess: (data) => {
            setError(null);
            qc.setQueryData(keys.firm, data);
        },
        onError: (err) => setError(failMsg(err, "Save failed")),
    });

    if (firm.isPending) return <EmptyNote>Loading…</EmptyNote>;
    if (firm.isError || !firm.data) {
        return (
            <EmptyNote>{failMsg(firm.error, "Could not load firm")}</EmptyNote>
        );
    }
    const broker = firm.data.brokers.find((b) => b.id === id);
    if (!broker) return <EmptyNote>Broker not found.</EmptyNote>;

    return (
        <div>
            <BrokerForm
                broker={broker}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
            <BrokerCredentials broker={broker} />
        </div>
    );
}
