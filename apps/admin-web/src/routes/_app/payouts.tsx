import { createFileRoute } from "@tanstack/react-router";
import { requires } from "../../access.ts";
import { PayoutsTable } from "../../components/payouts-table.tsx";

export const Route = createFileRoute("/_app/payouts")({
    beforeLoad: requires("payout", "list"),
    component: Payouts,
    staticData: { crumb: "Payouts" },
});

function Payouts() {
    return <PayoutsTable />;
}
