import { createFileRoute } from "@tanstack/react-router";
import { requires } from "../../access.ts";
import { PaymentsTable } from "../../components/payments-table.tsx";

export const Route = createFileRoute("/_app/payments")({
    beforeLoad: requires("payment", "list"),
    component: Payments,
    staticData: { crumb: "Payments" },
});

function Payments() {
    return <PaymentsTable />;
}
