import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type UiThemeId = "bw-sketch" | "tech" | "memphis" | "mondrian" | "rococo";

export const UI_THEME_OPTIONS: { value: UiThemeId; label: string }[] = [
  { value: "mondrian", label: "蒙德里安（默认）" },
  { value: "bw-sketch", label: "黑白线稿" },
  { value: "tech", label: "科技" },
  { value: "memphis", label: "孟菲斯" },
  { value: "rococo", label: "洛可可" },
];

interface UiThemeState {
  uiTheme: UiThemeId;
  setUiTheme: (t: UiThemeId) => void;
}

/** 旧版持久化里可能存了已删除的 default 主题，读入时改为蒙德里安 */
function migratePersistedThemeJson(raw: string | null): string | null {
  if (!raw) return raw;
  try {
    const parsed = JSON.parse(raw) as { state?: { uiTheme?: string } };
    if (parsed?.state?.uiTheme === "default") {
      parsed.state.uiTheme = "mondrian";
      return JSON.stringify(parsed);
    }
  } catch {
    /* ignore */
  }
  return raw;
}

const storage = createJSONStorage(() => ({
  getItem: (name: string) => migratePersistedThemeJson(localStorage.getItem(name)),
  setItem: (name: string, value: string) => localStorage.setItem(name, value),
  removeItem: (name: string) => localStorage.removeItem(name),
}));

export const useUiThemeStore = create<UiThemeState>()(
  persist(
    (set) => ({
      uiTheme: "mondrian",
      setUiTheme: (uiTheme) => set({ uiTheme }),
    }),
    {
      name: "learning-map-ui-theme",
      storage,
    }
  )
);
