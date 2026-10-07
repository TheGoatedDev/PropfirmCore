import { createFileRoute } from "@tanstack/react-router";
import { TradingAccountsTable } from "../../components/trading-accounts-table.tsx";

export const Route = createFileRoute("/_app/trading-accounts/")({
    component: TradingAccounts,
});

function TradingAccounts() {
    return (
        <section data-testid="accounts-heading">
            <TradingAccountsTable />
        </section>
    );
}
