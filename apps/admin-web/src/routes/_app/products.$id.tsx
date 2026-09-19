import type { ProductWrite } from "@propfirmcore/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { failMsg, keys } from "../../api.ts";
import { fetchFirm, saveFirmSlice } from "../../firm-api.ts";
import { ProductForm } from "../../product-form.tsx";
import { useUi } from "../../stores/ui.ts";

export const Route = createFileRoute("/_app/products/$id")({
    component: EditProduct,
    staticData: { crumb: "Product" },
});

function EditProduct() {
    const { id } = Route.useParams();
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const save = useMutation({
        mutationFn: (product: ProductWrite) =>
            saveFirmSlice((current) => {
                if (!current.products.some((p) => p.id === id)) {
                    throw new Error("Product not found");
                }
                return {
                    ...current,
                    products: current.products.map((p) =>
                        p.id === id ? { ...product, id } : p,
                    ),
                };
            }),
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
    const product = firm.data.products.find((p) => p.id === id);
    if (!product) return <p>Product not found</p>;

    return (
        <div className="space-y-4">
            <ProductForm
                product={product}
                brokers={firm.data.brokers}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
        </div>
    );
}
