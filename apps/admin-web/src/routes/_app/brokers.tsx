import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/brokers")({
    staticData: { crumb: "Brokers" },
    component: () => <Outlet />,
});
