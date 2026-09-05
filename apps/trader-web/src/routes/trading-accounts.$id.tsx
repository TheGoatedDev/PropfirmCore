import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@propfirmcore/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { z } from "zod";
import { api, failMsg, fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

const payoutSchema = z.object({ amount: z.coerce.number().positive() });

type Product = {
    id: string;
    phases: { kind: string }[];
};
type Fill = {
    externalId: string;
    symbol: string;
    qty: number;
    price: number;
    side: string;
};
type Snapshot = {
    externalId: string;
    equity: number;
    balance: number;
    ts: string;
};

export const Route = createFileRoute("/trading-accounts/$id")({
    component: Account,
});

function Account() {
    const me = useQuery({ queryKey: keys.me, queryFn: fetchMe, retry: false });
    const { id } = Route.useParams();
    if (!me.data) return <Navigate to="/" />;
    return <AccountDetail id={id} />;
}

function AccountDetail({ id }: { id: string }) {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();

    const account = useQuery({
        queryKey: keys.account(id),
        queryFn: async () => {
            const { data, error } = await api.GET("/trading-accounts/{id}", {
                params: { path: { id } },
            });
            if (error) throw error;
            return data;
        },
    });
    const fills = useQuery({
        queryKey: keys.fills(id),
        queryFn: async () => {
            const { data, error } = await api.GET(
                "/trading-accounts/{id}/fills",
                { params: { path: { id } } },
            );
            if (error) throw error;
            return (data ?? []) as Fill[];
        },
    });
    const snapshots = useQuery({
        queryKey: keys.snapshots(id),
        queryFn: async () => {
            const { data, error } = await api.GET(
                "/trading-accounts/{id}/snapshots",
                { params: { path: { id } } },
            );
            if (error) throw error;
            return (data ?? []) as Snapshot[];
        },
    });
    const payouts = useQuery({
        queryKey: keys.payouts(id),
        queryFn: async () => {
            const { data, error } = await api.GET(
                "/trading-accounts/{id}/payouts",
                { params: { path: { id } } },
            );
            if (error) throw error;
            return data ?? [];
        },
    });
    const products = useQuery({
        queryKey: keys.products,
        queryFn: async () => {
            const { data, error } = await api.GET("/products");
            if (error) throw error;
            return (data ?? []) as Product[];
        },
    });

    const requestPayout = useMutation({
        mutationFn: async (amount: number) => {
            const { error } = await api.POST("/trading-accounts/{id}/payouts", {
                params: { path: { id } },
                body: { amount },
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: keys.payouts(id) }),
                qc.invalidateQueries({ queryKey: keys.account(id) }),
            ]);
        },
        onError: (error) => setError(failMsg(error, "Payout failed")),
    });

    if (account.isError) return <p>Not found</p>;
    if (!account.data) return <p>Loading</p>;

    const acc = account.data;
    const funded =
        acc.status === "active" &&
        products.data?.find((p) => p.id === acc.productId)?.phases[
            acc.phaseIndex
        ]?.kind === "funded";

    async function submitPayout(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const parsed = payoutSchema.safeParse({
            amount: new FormData(e.currentTarget).get("amount"),
        });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid");
            return;
        }
        requestPayout.mutate(parsed.data.amount);
    }

    return (
        <div className="space-y-4">
            <Button
                variant="outline"
                onClick={() => void navigate({ to: "/" })}
            >
                Back
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>{acc.id}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                    <p>Status: {acc.status}</p>
                    <p>Equity: {acc.equity}</p>
                    <p>Balance: {acc.balance}</p>
                </CardContent>
            </Card>
            {funded ? (
                <form
                    className="flex items-end gap-3"
                    onSubmit={(e) => void submitPayout(e)}
                >
                    <div className="space-y-1">
                        <Label htmlFor="amount">Payout amount</Label>
                        <Input
                            id="amount"
                            name="amount"
                            type="number"
                            min="0"
                            step="any"
                            required
                        />
                    </div>
                    <Button type="submit">Request</Button>
                </form>
            ) : null}
            <h3 className="font-medium">Payouts</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(payouts.data ?? []).map((p) => (
                        <TableRow key={p.id}>
                            <TableCell>{p.id}</TableCell>
                            <TableCell>{p.amount}</TableCell>
                            <TableCell>
                                <Badge>{p.status}</Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <h3 className="font-medium">Fills</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Side</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(fills.data ?? []).map((f) => (
                        <TableRow key={f.externalId}>
                            <TableCell>{f.symbol}</TableCell>
                            <TableCell>{f.side}</TableCell>
                            <TableCell>{f.qty}</TableCell>
                            <TableCell>{f.price}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <h3 className="font-medium">Snapshots</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Equity</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Time</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(snapshots.data ?? []).map((s) => (
                        <TableRow key={s.externalId}>
                            <TableCell>{s.equity}</TableCell>
                            <TableCell>{s.balance}</TableCell>
                            <TableCell>{s.ts}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
