import { create } from "zustand";

interface AppState {
  filterYear: number | null;
  filterType: string | null;
  filterSpecial: boolean | null;
  setFilterYear: (v: number | null) => void;
  setFilterType: (v: string | null) => void;
  setFilterSpecial: (v: boolean | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  filterYear: null,
  filterType: null,
  filterSpecial: null,
  setFilterYear: (v) => set({ filterYear: v }),
  setFilterType: (v) => set({ filterType: v }),
  setFilterSpecial: (v) => set({ filterSpecial: v }),
}));
