import { ConfirmProvider } from "@propfirmcore/ui/components/confirm-dialog";
import { ThemeProvider } from "@propfirmcore/ui/components/theme-provider";
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
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <ConfirmProvider>
                    <RouterProvider router={router} context={{ queryClient }} />
                </ConfirmProvider>
                <ReactQueryDevtools />
            </QueryClientProvider>
        </ThemeProvider>
    </StrictMode>,
);
