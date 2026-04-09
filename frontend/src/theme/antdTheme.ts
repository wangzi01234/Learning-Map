import type { ThemeConfig } from "antd";
import { theme } from "antd";
import type { UiThemeId } from "./uiThemeStore";

export function getAntdThemeConfig(id: UiThemeId): ThemeConfig {
  const base: ThemeConfig = {
    token: {
      borderRadius: 14,
    },
    components: {
      Button: { controlHeight: 36 },
      Modal: { borderRadiusLG: 16 },
    },
  };

  switch (id) {
    case "bw-sketch":
      return {
        ...base,
        algorithm: theme.defaultAlgorithm,
        token: {
          ...base.token,
          colorPrimary: "#374151",
          fontFamily: '"Nunito", "Segoe UI", system-ui, sans-serif',
        },
      };
    case "tech":
      return {
        ...base,
        algorithm: theme.darkAlgorithm,
        token: {
          ...base.token,
          colorPrimary: "#22d3ee",
          colorBgElevated: "#111c2e",
          colorText: "#e2e8f0",
          fontFamily: '"DM Sans", "Segoe UI", system-ui, sans-serif',
        },
      };
    case "memphis":
      return {
        ...base,
        algorithm: theme.defaultAlgorithm,
        token: {
          ...base.token,
          colorPrimary: "#db2777",
          fontFamily: '"Nunito", "Segoe UI", system-ui, sans-serif',
        },
      };
    case "mondrian":
      return {
        ...base,
        algorithm: theme.defaultAlgorithm,
        token: {
          ...base.token,
          colorPrimary: "#e30613",
          fontFamily: '"Nunito", system-ui, sans-serif',
          borderRadius: 0,
          borderRadiusLG: 0,
          borderRadiusSM: 0,
          borderRadiusXS: 0,
        },
        components: {
          ...base.components,
          Button: { controlHeight: 36, borderRadius: 0, borderRadiusLG: 0 },
          Modal: { borderRadiusLG: 0 },
          Input: { borderRadius: 0 },
          Select: { borderRadius: 0 },
          Checkbox: { borderRadius: 0 },
        },
      };
    case "rococo":
      return {
        ...base,
        algorithm: theme.defaultAlgorithm,
        token: {
          ...base.token,
          colorPrimary: "#a67c7c",
          fontFamily: '"Nunito", "Georgia", serif',
        },
      };
    default:
      return getAntdThemeConfig("mondrian");
  }
}
