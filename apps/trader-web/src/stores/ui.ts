import { create } from "zustand";

export const useUi = create<{
    error: string | null;
    setError: (error: string | null) => void;
}>((set) => ({
    error: null,
    setError: (error) => set({ error }),
}));
