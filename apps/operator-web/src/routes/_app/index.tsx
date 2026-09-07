import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api, failMsg, keys } from "../../api.ts";
import { FirmForm } from "../../firm-form.tsx";
import { useUi } from "../../stores/ui.ts";

export const Route = createFileRoute("/_app/")({
    component: OperatorHome,
    staticData: { crumb: "Firm" },
});

function OperatorHome() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const firm = useQuery({
        queryKey: keys.firm,
        queryFn: async () => {
            const { data, error } = await api.GET("/firm");
            if (error || !data) throw new Error(failMsg(error, "Load failed"));
            return data;
        },
    });
    const save = useMutation({
        mutationFn: async (body: NonNullable<typeof firm.data>) => {
            const { data, error } = await api.PUT("/firm", { body });
            if (error || !data) throw new Error(failMsg(error, "Save failed"));
            return data;
        },
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
        <div className="space-y-4">
            <h1 className="text-xl font-semibold" data-testid="firm-heading">
                Firm
            </h1>
            <FirmForm
                firm={firm.data}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
        </div>
    );
}
