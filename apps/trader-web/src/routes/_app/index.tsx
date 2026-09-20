import { Button } from "@propfirmcore/ui/components/button";
import { Card, CardHeader, CardTitle } from "@propfirmcore/ui/components/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api, failMsg, keys } from "../../api.ts";
import { TradingAccountsTable } from "../../components/trading-accounts-table.tsx";
import { useUi } from "../../stores/ui.ts";

type Product = {
    id: string;
    name: string;
    brokers: { id: string; name: string }[];
};

export const Route = createFileRoute("/_app/")({
    component: Dashboard,
    staticData: { crumb: "Home" },
});

function Dashboard() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const [paymentId, setPaymentId] = useState<string | null>(null);

    const products = useQuery({
        queryKey: keys.products,
        queryFn: async () => {
            const { data, error } = await api.GET("/products");
            if (error) throw error;
            return (data ?? []) as Product[];
        },
    });

    const buy = useMutation({
        mutationFn: async (input: { id: string; brokerId: string }) => {
            const { data, error } = await api.POST("/products/{id}/buy", {
                params: { path: { id: input.id } },
                body: { brokerId: input.brokerId },
            });
            if (error) throw error;
            return data;
        },
        onSuccess: async (data) => {
            if (data && "payment" in data && data.payment?.id) {
                setPaymentId(data.payment.id);
            }
            await qc.invalidateQueries({ queryKey: keys.accounts });
        },
        onError: (error) => setError(failMsg(error, "Buy failed")),
    });

    return (
        <>
            <section>
                <h2
                    className="mb-3 text-lg font-medium"
                    data-testid="products-heading"
                >
                    Products
                </h2>
                {paymentId ? (
                    <p data-testid="payment-id">Payment ID: {paymentId}</p>
                ) : null}
                <div className="space-y-3">
                    {(products.data ?? []).map((p) => (
                        <Card key={p.id}>
                            <CardHeader className="flex flex-row items-center justify-between gap-3">
                                <CardTitle>{p.name}</CardTitle>
                                <form
                                    className="flex items-center gap-2"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        const brokerId = String(
                                            new FormData(e.currentTarget).get(
                                                "brokerId",
                                            ) ?? "",
                                        );
                                        setError(null);
                                        buy.mutate({ id: p.id, brokerId });
                                    }}
                                >
                                    <select
                                        name="brokerId"
                                        aria-label="Broker"
                                        className="border px-2 py-1 text-sm"
                                        required
                                    >
                                        {p.brokers.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.name}
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        type="submit"
                                        data-testid={`product-buy-${p.id}`}
                                    >
                                        Buy
                                    </Button>
                                </form>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </section>
            <section>
                <h2
                    className="mb-3 text-lg font-medium"
                    data-testid="accounts-heading"
                >
                    Trading accounts
                </h2>
                <TradingAccountsTable />
            </section>
        </>
    );
}
