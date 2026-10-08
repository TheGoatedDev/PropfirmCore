import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requires } from "../../access.ts";

export const Route = createFileRoute("/_app/brokers")({
    beforeLoad: requires("firm", "read"),
    staticData: { crumb: "Brokers" },
    component: () => <Outlet />,
});
