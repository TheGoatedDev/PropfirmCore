import { Card, CardHeader, CardTitle } from "@propfirmcore/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api, failMsg, keys } from "../../api.ts";
import { fetchFirm } from "../../firm-api.ts";

export const Route = createFileRoute("/_app/")({
    component: AdminHome,
    staticData: { crumb: "Home" },
});

function AdminHome() {
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const payouts = useQuery({
        queryKey: keys.payouts,
        queryFn: async () => {
            const { data, error } = await api.GET("/payouts");
            if (error) throw error;
            return data ?? [];
        },
    });
    const accounts = useQuery({
        queryKey: [...keys.accounts, "count"],
        queryFn: async () => {
            const { data, error } = await api.GET("/trading-accounts", {
                params: { query: { page: 1, pageSize: 1 } },
            });
            if (error) throw error;
            return data ?? { items: [], total: 0 };
        },
    });

    return (
        <div className="space-y-4" data-testid="home-heading">
            {firm.isError ? (
                <p>{failMsg(firm.error, "Could not load firm")}</p>
            ) : null}
            {payouts.isError ? (
                <p>{failMsg(payouts.error, "Could not load payouts")}</p>
            ) : null}
            {accounts.isError ? (
                <p>{failMsg(accounts.error, "Could not load accounts")}</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
                <Link to="/firm" data-testid="link-firm">
                    <Card>
                        <CardHeader>
                            <CardTitle>Firm</CardTitle>
                            <p data-testid="home-firm-name">
                                {firm.isPending ? "…" : (firm.data?.name ?? "")}
                            </p>
                        </CardHeader>
                    </Card>
                </Link>
                <Link to="/brokers" data-testid="link-brokers">
                    <Card>
                        <CardHeader>
                            <CardTitle>Brokers</CardTitle>
                            <p data-testid="brokers-count">
                                {firm.isPending
                                    ? "…"
                                    : (firm.data?.brokers.length ?? 0)}
                            </p>
                        </CardHeader>
                    </Card>
                </Link>
                <Link to="/products" data-testid="link-products">
                    <Card>
                        <CardHeader>
                            <CardTitle>Products</CardTitle>
                            <p data-testid="products-count">
                                {firm.isPending
                                    ? "…"
                                    : (firm.data?.products.length ?? 0)}
                            </p>
                        </CardHeader>
                    </Card>
                </Link>
                <Link to="/payments" data-testid="link-payments">
                    <Card>
                        <CardHeader>
                            <CardTitle>Payments</CardTitle>
                        </CardHeader>
                    </Card>
                </Link>
                <Link to="/payouts" data-testid="link-payouts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Payouts</CardTitle>
                            <p data-testid="payouts-count">
                                {payouts.isPending
                                    ? "…"
                                    : (payouts.data?.length ?? 0)}
                            </p>
                        </CardHeader>
                    </Card>
                </Link>
                <Link
                    to="/trading-accounts"
                    data-testid="link-trading-accounts"
                >
                    <Card>
                        <CardHeader>
                            <CardTitle>Trading accounts</CardTitle>
                            <p data-testid="accounts-count">
                                {accounts.isPending
                                    ? "…"
                                    : (accounts.data?.total ?? 0)}
                            </p>
                        </CardHeader>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
