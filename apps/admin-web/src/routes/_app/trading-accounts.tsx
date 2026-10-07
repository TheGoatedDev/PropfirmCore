import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/trading-accounts")({
    staticData: { crumb: "Trading accounts" },
    component: () => <Outlet />,
});
