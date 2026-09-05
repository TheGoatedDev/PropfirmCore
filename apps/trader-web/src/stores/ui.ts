import { create } from "zustand";
import { devtools } from "zustand/middleware";

export const useUi = create<{
    error: string | null;
    setError: (error: string | null) => void;
}>()(
    devtools(
        (set) => ({
            error: null,
            setError: (error) => set({ error }),
        }),
        { name: "trader-ui", enabled: import.meta.env.DEV },
    ),
);
