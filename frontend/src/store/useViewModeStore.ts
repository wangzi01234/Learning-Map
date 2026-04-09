import { create } from "zustand";

export type AppViewMode = "map" | "learning-md";

const STORAGE_KEY = "learning-app-view-mode";

function loadMode(): AppViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "learning-md" || v === "map") return v;
  } catch {
    /* ignore */
  }
  return "map";
}

interface ViewModeState {
  viewMode: AppViewMode;
  setViewMode: (m: AppViewMode) => void;
}

export const useViewModeStore = create<ViewModeState>((set) => ({
  viewMode: loadMode(),
  setViewMode: (viewMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
    set({ viewMode });
  },
}));
