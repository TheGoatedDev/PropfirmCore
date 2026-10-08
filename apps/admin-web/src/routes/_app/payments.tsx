import { createFileRoute } from "@tanstack/react-router";
import { PaymentsTable } from "../../components/payments-table.tsx";

export const Route = createFileRoute("/_app/payments")({
    component: Payments,
    staticData: { crumb: "Payments" },
});

function Payments() {
    return <PaymentsTable />;
}
