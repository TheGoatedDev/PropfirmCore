import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requires } from "../../access.ts";

export const Route = createFileRoute("/_app/trading-accounts")({
    beforeLoad: requires("tradingAccount", "read"),
    staticData: { crumb: "Trading accounts" },
    component: () => <Outlet />,
});
