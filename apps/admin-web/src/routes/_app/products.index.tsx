import { Button } from "@propfirmcore/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCan } from "../../access.ts";
import { ProductsTable } from "../../components/products-table.tsx";

export const Route = createFileRoute("/_app/products/")({
    component: Products,
});

function Products() {
    const navigate = useNavigate();
    const can = useCan();
    return (
        <ProductsTable
            actions={
                can("firm", "write") && (
                    <Button
                        data-testid="add-product"
                        onClick={() => void navigate({ to: "/products/new" })}
                    >
                        <Plus />
                        Add product
                    </Button>
                )
            }
        />
    );
}
