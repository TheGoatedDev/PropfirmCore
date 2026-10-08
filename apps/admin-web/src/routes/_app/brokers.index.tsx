import { Button } from "@propfirmcore/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCan } from "../../access.ts";
import { BrokersTable } from "../../components/brokers-table.tsx";

export const Route = createFileRoute("/_app/brokers/")({
    component: Brokers,
});

function Brokers() {
    const navigate = useNavigate();
    const can = useCan();
    return (
        <BrokersTable
            actions={
                can("firm", "write") && (
                    <Button
                        data-testid="add-broker"
                        onClick={() => void navigate({ to: "/brokers/new" })}
                    >
                        <Plus />
                        Add broker
                    </Button>
                )
            }
        />
    );
}
