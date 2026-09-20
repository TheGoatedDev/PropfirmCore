import { Button } from "@propfirmcore/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductsTable } from "../../components/products-table.tsx";

export const Route = createFileRoute("/_app/products/")({
    component: Products,
});

function Products() {
    const navigate = useNavigate();
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end">
                <Button
                    data-testid="add-product"
                    onClick={() => void navigate({ to: "/products/new" })}
                >
                    Add product
                </Button>
            </div>
            <ProductsTable />
        </div>
    );
}
