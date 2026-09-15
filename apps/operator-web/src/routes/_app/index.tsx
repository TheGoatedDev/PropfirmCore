import { Card, CardHeader, CardTitle } from "@propfirmcore/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keys } from "../../api.ts";
import { fetchFirm } from "../../firm-api.ts";

export const Route = createFileRoute("/_app/")({
    component: OperatorHome,
    staticData: { crumb: "Home" },
});

function OperatorHome() {
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });

    if (firm.isPending) return <p>Loading</p>;
    if (firm.isError || !firm.data) {
        return (
            <p>
                {firm.error instanceof Error
                    ? firm.error.message
                    : "Could not load firm"}
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-semibold" data-testid="home-heading">
                Home
            </h1>
            <p data-testid="home-firm-name">{firm.data.name}</p>
            <div className="grid gap-3 sm:grid-cols-3">
                <Link to="/firm" data-testid="link-firm">
                    <Card>
                        <CardHeader>
                            <CardTitle>Firm</CardTitle>
                        </CardHeader>
                    </Card>
                </Link>
                <Link to="/brokers" data-testid="link-brokers">
                    <Card>
                        <CardHeader>
                            <CardTitle>Brokers</CardTitle>
                            <p data-testid="brokers-count">
                                {firm.data.brokers.length}
                            </p>
                        </CardHeader>
                    </Card>
                </Link>
                <Link to="/products" data-testid="link-products">
                    <Card>
                        <CardHeader>
                            <CardTitle>Products</CardTitle>
                            <p data-testid="products-count">
                                {firm.data.products.length}
                            </p>
                        </CardHeader>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
