import { Button } from "@propfirmcore/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BrokersTable } from "../../components/brokers-table.tsx";

export const Route = createFileRoute("/_app/brokers/")({
    component: Brokers,
});

function Brokers() {
    const navigate = useNavigate();
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end">
                <Button
                    data-testid="add-broker"
                    onClick={() => void navigate({ to: "/brokers/new" })}
                >
                    Add broker
                </Button>
            </div>
            <BrokersTable />
        </div>
    );
}
