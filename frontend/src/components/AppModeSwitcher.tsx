import type { ReactNode } from "react";
import { Segmented } from "antd";
import { GitBranch, FileText } from "react-feather";
import type { AppViewMode } from "@/store/useViewModeStore";
import { useViewModeStore } from "@/store/useViewModeStore";
import "./AppModeSwitcher.css";

const options: { label: ReactNode; value: AppViewMode }[] = [
  {
    value: "map",
    label: (
      <span className="ams-opt">
        <GitBranch size={14} strokeWidth={2} aria-hidden />
        Learning Map
      </span>
    ),
  },
  {
    value: "learning-md",
    label: (
      <span className="ams-opt">
        <FileText size={14} strokeWidth={2} aria-hidden />
        Learning MD
      </span>
    ),
  },
];

export function AppModeSwitcher() {
  const viewMode = useViewModeStore((s) => s.viewMode);
  const setViewMode = useViewModeStore((s) => s.setViewMode);

  return (
    <Segmented<AppViewMode>
      className="ams-segmented"
      size="small"
      value={viewMode}
      options={options}
      onChange={(v) => setViewMode(v)}
    />
  );
}
