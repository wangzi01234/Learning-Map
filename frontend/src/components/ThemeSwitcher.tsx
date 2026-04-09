import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { UI_THEME_OPTIONS, useUiThemeStore, type UiThemeId } from "@/theme/uiThemeStore";
import "./ThemeSwitcher.css";

export function ThemeSwitcher() {
  const uiTheme = useUiThemeStore((s) => s.uiTheme);
  const setUiTheme = useUiThemeStore((s) => s.setUiTheme);

  const items: MenuProps["items"] = UI_THEME_OPTIONS.map((o) => ({
    key: o.value,
    label: o.label,
  }));

  return (
    <div className="theme-switcher">
      <Dropdown
        menu={{
          items,
          selectable: true,
          selectedKeys: [uiTheme],
          onClick: ({ key }) => setUiTheme(key as UiThemeId),
        }}
        trigger={["click"]}
        placement="bottomRight"
      >
        <Button type="text" className="theme-switcher-trigger" aria-label="界面主题" aria-haspopup="menu">
          主题
        </Button>
      </Dropdown>
    </div>
  );
}
