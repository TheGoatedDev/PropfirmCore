import { Button } from "@propfirmcore/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { ProductsTable } from "../../components/products-table.tsx";

export const Route = createFileRoute("/_app/products/")({
    component: Products,
});

function Products() {
    const navigate = useNavigate();
    return (
        <ProductsTable
            actions={
                <Button
                    data-testid="add-product"
                    onClick={() => void navigate({ to: "/products/new" })}
                >
                    <Plus />
                    Add product
                </Button>
            }
        />
    );
}
