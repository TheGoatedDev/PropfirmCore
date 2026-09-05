import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import { Card, CardHeader, CardTitle } from "@propfirmcore/ui/components/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@propfirmcore/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, failMsg, keys } from "../../api.ts";
import { useUi } from "../../stores/ui.ts";

type Product = { id: string; name: string };

export const Route = createFileRoute("/_app/")({
    component: Dashboard,
    staticData: { crumb: "Home" },
});

function Dashboard() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [paymentId, setPaymentId] = useState<string | null>(null);

    const products = useQuery({
        queryKey: keys.products,
        queryFn: async () => {
            const { data, error } = await api.GET("/products");
            if (error) throw error;
            return (data ?? []) as Product[];
        },
    });
    const accounts = useQuery({
        queryKey: keys.accounts,
        queryFn: async () => {
            const { data, error } = await api.GET("/trading-accounts");
            if (error) throw error;
            return data ?? [];
        },
    });

    const buy = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await api.POST("/products/{id}/buy", {
                params: { path: { id } },
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
                <h2 className="mb-3 text-lg font-medium">Products</h2>
                {paymentId ? <p>Payment ID: {paymentId}</p> : null}
                <div className="space-y-3">
                    {(products.data ?? []).map((p) => (
                        <Card key={p.id}>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>{p.name}</CardTitle>
                                <Button
                                    onClick={() => {
                                        setError(null);
                                        buy.mutate(p.id);
                                    }}
                                >
                                    Buy
                                </Button>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </section>
            <section>
                <h2 className="mb-3 text-lg font-medium">Trading accounts</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Equity</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(accounts.data ?? []).map((a) => (
                            <TableRow
                                key={a.id}
                                className="cursor-pointer"
                                onClick={() =>
                                    void navigate({
                                        to: "/trading-accounts/$id",
                                        params: { id: a.id },
                                    })
                                }
                            >
                                <TableCell>{a.id}</TableCell>
                                <TableCell>{a.productId}</TableCell>
                                <TableCell>
                                    <Badge>{a.status}</Badge>
                                </TableCell>
                                <TableCell>{a.equity}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>
        </>
    );
}
