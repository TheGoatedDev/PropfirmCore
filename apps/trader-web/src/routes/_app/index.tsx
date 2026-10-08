import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@propfirmcore/ui/components/alert";
import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import { formatAmount, formatPercent } from "@propfirmcore/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useState } from "react";
import { api, failMsg, keys } from "../../api.ts";
import { TradingAccountsTable } from "../../components/trading-accounts-table.tsx";
import { useUi } from "../../stores/ui.ts";

type Product = {
    id: string;
    name: string;
    brokers: { id: string; name: string }[];
    phases: {
        name: string;
        balance: number;
        fee?: number;
        ruleset: {
            profitTarget: number;
            maxDrawdown: number;
            dailyDrawdown: number;
            minTradingDays: number;
        };
    }[];
    payout?: { split: number };
};

// The terms a trader weighs before buying, from the first phase.
function productTerms(p: Product): [string, string][] {
    const first = p.phases[0];
    if (!first) return [];
    const terms: [string, string][] = [
        ["Fee", first.fee === undefined ? "—" : formatAmount(first.fee)],
        ["Balance", formatAmount(first.balance)],
        ["Profit target", formatPercent(first.ruleset.profitTarget)],
        ["Max drawdown", formatPercent(first.ruleset.maxDrawdown)],
        ["Daily drawdown", formatPercent(first.ruleset.dailyDrawdown)],
        ["Min trading days", String(first.ruleset.minTradingDays)],
    ];
    if (p.payout) terms.push(["Payout split", formatPercent(p.payout.split)]);
    return terms;
}

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
                    className="mb-3 text-base font-medium"
                    data-testid="products-heading"
                >
                    Products
                </h2>
                {paymentId ? (
                    <Alert className="mb-3">
                        <Clock aria-hidden />
                        <AlertTitle>Payment pending</AlertTitle>
                        <AlertDescription>
                            <span data-testid="payment-id">
                                Payment ID: {paymentId}
                            </span>
                        </AlertDescription>
                    </Alert>
                ) : null}
                <div className="space-y-3">
                    {(products.data ?? []).map((p) => (
                        <Card key={p.id}>
                            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                    <CardTitle>{p.name}</CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                        {p.phases
                                            .map((ph) => ph.name)
                                            .join(" → ")}
                                    </p>
                                </div>
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
                                        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
                            <CardContent>
                                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm tabular-nums sm:grid-cols-4 xl:grid-cols-7">
                                    {productTerms(p).map(([k, v]) => (
                                        <div key={k}>
                                            <dt className="text-muted-foreground">
                                                {k}
                                            </dt>
                                            <dd className="font-medium">{v}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
            <section>
                <h2
                    className="mb-3 text-base font-medium"
                    data-testid="accounts-heading"
                >
                    Trading accounts
                </h2>
                <TradingAccountsTable />
            </section>
        </>
    );
}
