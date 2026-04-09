import type { UiThemeId } from "./uiThemeStore";

export interface G6VisualTheme {
  fills: string[];
  stroke: string;
  label: string;
  edge: string;
  edgeLabel: string;
  edgeLabelBg: string;
  edgeLabelStroke: string;
  selectedStroke: string;
  selectedShadow: string;
  labelFontFamily: string;
}

const G6_MAP: Record<UiThemeId, G6VisualTheme> = {
  "bw-sketch": {
    fills: ["#f3f4f6", "#e5e7eb", "#d1d5db", "#e7e5e4", "#f5f5f4", "#e4e4e7", "#d4d4d8", "#fafafa"],
    stroke: "#171717",
    label: "#0a0a0a",
    edge: "#404040",
    edgeLabel: "#525252",
    edgeLabelBg: "#fafafa",
    edgeLabelStroke: "#a3a3a3",
    selectedStroke: "#000000",
    selectedShadow: "rgba(0, 0, 0, 0.35)",
    labelFontFamily: '"Kalam", "Nunito", sans-serif',
  },
  tech: {
    fills: ["#0e7490", "#0369a1", "#1d4ed8", "#5b21b6", "#0f766e", "#15803d", "#a16207", "#be185d"],
    stroke: "#67e8f9",
    label: "#ecfeff",
    edge: "#38bdf8",
    edgeLabel: "#bae6fd",
    edgeLabelBg: "#0f172a",
    edgeLabelStroke: "#0ea5e9",
    selectedStroke: "#f0f9ff",
    selectedShadow: "rgba(34, 211, 238, 0.55)",
    labelFontFamily: '"DM Sans", sans-serif',
  },
  memphis: {
    fills: ["#fde047", "#f472b6", "#38bdf8", "#a3e635", "#c084fc", "#fb923c", "#f9a8d4", "#5eead4"],
    stroke: "#18181b",
    label: "#18181b",
    edge: "#18181b",
    edgeLabel: "#18181b",
    edgeLabelBg: "#fef08a",
    edgeLabelStroke: "#18181b",
    selectedStroke: "#db2777",
    selectedShadow: "rgba(219, 39, 119, 0.45)",
    labelFontFamily: '"Nunito", sans-serif',
  },
  mondrian: {
    fills: ["#ffffff", "#e30613", "#005baa", "#ffdd00", "#ffffff", "#e30613", "#005baa", "#ffdd00"],
    stroke: "#000000",
    label: "#000000",
    edge: "#000000",
    edgeLabel: "#000000",
    edgeLabelBg: "#ffffff",
    edgeLabelStroke: "#000000",
    selectedStroke: "#005baa",
    selectedShadow: "rgba(0, 91, 170, 0.35)",
    labelFontFamily: '"Nunito", sans-serif',
  },
  rococo: {
    fills: ["#fce7f3", "#ddd6fe", "#fef3c7", "#fecdd3", "#e0e7ff", "#ffedd5", "#d9f99d", "#f5d0fe"],
    stroke: "#9d6b53",
    label: "#4a3728",
    edge: "#a67c52",
    edgeLabel: "#6b5344",
    edgeLabelBg: "#fdf8f0",
    edgeLabelStroke: "#c4a574",
    selectedStroke: "#b08968",
    selectedShadow: "rgba(176, 137, 104, 0.4)",
    labelFontFamily: '"Nunito", "Georgia", serif',
  },
};

export function getG6Theme(id: UiThemeId): G6VisualTheme {
  return G6_MAP[id] ?? G6_MAP.mondrian;
}
