import type { FirmConfig } from "@propfirmcore/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { failMsg, keys } from "../../api.ts";
import { fetchFirm, saveFirmSlice } from "../../firm-api.ts";
import { FirmSettingsForm } from "../../firm-settings-form.tsx";
import { useUi } from "../../stores/ui.ts";

export const Route = createFileRoute("/_app/firm")({
    component: Firm,
    staticData: { crumb: "Firm" },
});

function Firm() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const save = useMutation({
        mutationFn: (settings: Omit<FirmConfig, "brokers" | "products">) =>
            saveFirmSlice((current) => ({
                ...settings,
                brokers: current.brokers,
                products: current.products,
            })),
        onSuccess: (data) => {
            setError(null);
            qc.setQueryData(keys.firm, data);
        },
        onError: (err) => setError(failMsg(err, "Save failed")),
    });

    if (firm.isPending) return <p>Loading</p>;
    if (firm.isError || !firm.data) {
        return <p>{failMsg(firm.error, "Could not load firm")}</p>;
    }

    return (
        <div className="space-y-4" data-testid="firm-heading">
            <FirmSettingsForm
                firm={firm.data}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
        </div>
    );
}
