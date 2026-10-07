import { createFileRoute } from "@tanstack/react-router";
import { PayoutsTable } from "../../components/payouts-table.tsx";

export const Route = createFileRoute("/_app/payouts")({
    component: Payouts,
    staticData: { crumb: "Payouts" },
});

function Payouts() {
    return <PayoutsTable />;
}
