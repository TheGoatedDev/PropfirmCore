import { createFileRoute } from "@tanstack/react-router";
import { requires } from "../../access.ts";
import { TradingAccountsTable } from "../../components/trading-accounts-table.tsx";

export const Route = createFileRoute("/_app/trading-accounts/")({
    beforeLoad: requires("tradingAccount", "list"),
    component: TradingAccounts,
});

function TradingAccounts() {
    return (
        <section data-testid="accounts-heading">
            <TradingAccountsTable />
        </section>
    );
}
