import type { Product } from "@propfirmcore/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
    const navigate = useNavigate();
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const save = useMutation({
        mutationFn: (product: Product) =>
            saveFirmSlice((current) => {
                if (!current.products.some((p) => p.id === id)) {
                    throw new Error("Product not found");
                }
                return {
                    ...current,
                    products: current.products.map((p) =>
                        p.id === id ? product : p,
                    ),
                };
            }),
        onSuccess: (data, product) => {
            setError(null);
            qc.setQueryData(keys.firm, data);
            if (product.id !== id) {
                void navigate({
                    to: "/products/$id",
                    params: { id: product.id },
                });
            }
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
            <h1 className="text-xl font-semibold">Product</h1>
            <ProductForm
                product={product}
                brokerIds={firm.data.brokers.map((b) => b.id).filter(Boolean)}
                saving={save.isPending}
                onSave={(next) => save.mutate(next)}
            />
        </div>
    );
}
