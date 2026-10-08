import type { ProductWrite } from "@propfirmcore/config";
import { EmptyNote } from "@propfirmcore/ui/components/page-section";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requires } from "../../access.ts";
import { failMsg, keys } from "../../api.ts";
import { fetchFirm, saveFirmSlice } from "../../firm-api.ts";
import { emptyProduct, ProductForm } from "../../product-form.tsx";
import { useUi } from "../../stores/ui.ts";

export const Route = createFileRoute("/_app/products/new")({
    beforeLoad: requires("firm", "write"),
    component: NewProduct,
    staticData: { crumb: "New product" },
});

function NewProduct() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const save = useMutation({
        mutationFn: (product: ProductWrite) =>
            saveFirmSlice((current) => ({
                ...current,
                products: [...current.products, product],
            })),
        onSuccess: (data) => {
            setError(null);
            const prev = qc.getQueryData(keys.firm) as
                | { products: { id: string }[] }
                | undefined;
            const created = data.products.find(
                (p) => !prev?.products.some((x) => x.id === p.id),
            );
            qc.setQueryData(keys.firm, data);
            if (created) {
                void navigate({
                    to: "/products/$id",
                    params: { id: created.id },
                });
            }
        },
        onError: (err) => setError(failMsg(err, "Save failed")),
    });

    if (firm.isPending) return <EmptyNote>Loading…</EmptyNote>;
    if (firm.isError || !firm.data) {
        return (
            <EmptyNote>{failMsg(firm.error, "Could not load firm")}</EmptyNote>
        );
    }

    return (
        <div>
            <ProductForm
                product={emptyProduct()}
                brokers={firm.data.brokers}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
        </div>
    );
}
