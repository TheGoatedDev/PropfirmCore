import type { Product } from "@propfirmcore/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { failMsg, keys } from "../../api.ts";
import { fetchFirm, saveFirmSlice } from "../../firm-api.ts";
import { emptyProduct, ProductForm } from "../../product-form.tsx";
import { useUi } from "../../stores/ui.ts";

export const Route = createFileRoute("/_app/products/new")({
    component: NewProduct,
    staticData: { crumb: "New product" },
});

function NewProduct() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const save = useMutation({
        mutationFn: (product: Product) =>
            saveFirmSlice((current) => ({
                ...current,
                products: [...current.products, product],
            })),
        onSuccess: (data, product) => {
            setError(null);
            qc.setQueryData(keys.firm, data);
            void navigate({ to: "/products/$id", params: { id: product.id } });
        },
        onError: (err) => setError(failMsg(err, "Save failed")),
    });

    if (firm.isPending) return <p>Loading</p>;
    if (firm.isError || !firm.data) {
        return <p>{failMsg(firm.error, "Could not load firm")}</p>;
    }

    return (
        <div className="space-y-4">
            <ProductForm
                product={emptyProduct()}
                brokerIds={firm.data.brokers.map((b) => b.id).filter(Boolean)}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
        </div>
    );
}
