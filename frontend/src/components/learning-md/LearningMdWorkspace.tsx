import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight } from "react-feather";
import { LearningMdLayout } from "@/components/learning-md/LearningMdLayout";
import { MdAssistPanel } from "@/components/learning-md/MdAssistPanel";
import "./LearningMdWorkspace.css";

const STORAGE_KEY = "learning-md-assist-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function LearningMdWorkspace() {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const n = !c;
      try {
        localStorage.setItem(STORAGE_KEY, n ? "1" : "0");
      } catch {
        /* ignore */
      }
      return n;
    });
  }, []);

  return (
    <div className="lmw-root">
      <aside
        className={`lmw-assist ${collapsed ? "lmw-assist--collapsed" : ""}`}
        aria-label="LLM 辅助"
      >
        {!collapsed ? (
          <div className="lmw-assist-panel">
            <MdAssistPanel />
          </div>
        ) : null}
        <button
          type="button"
          className="lmw-collapse-edge"
          onClick={toggle}
          title={collapsed ? "展开 LLM 辅助" : "折叠 LLM 辅助"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={18} strokeWidth={2} /> : <ChevronLeft size={18} strokeWidth={2} />}
        </button>
      </aside>
      <div className="lmw-doc">
        <LearningMdLayout />
      </div>
    </div>
  );
}
