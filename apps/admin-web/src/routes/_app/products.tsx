import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requires } from "../../access.ts";

export const Route = createFileRoute("/_app/products")({
    beforeLoad: requires("firm", "read"),
    staticData: { crumb: "Products" },
    component: () => <Outlet />,
});
