import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./router.tsx";
import "./index.css";

const queryClient = new QueryClient();
const root = document.getElementById("root");
if (!root) throw new Error("root missing");
createRoot(root).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} context={{ queryClient }} />
            <ReactQueryDevtools />
        </QueryClientProvider>
    </StrictMode>,
);
