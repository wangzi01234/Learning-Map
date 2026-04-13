import { Button, message } from "antd";
import { useState } from "react";
import { ArrowRightCircle, GitBranch, FileText } from "react-feather";
import { postConvertMapToMd, postConvertMdToMap } from "@/api/client";
import { useAppStore } from "@/store/useAppStore";
import { useLearningMdStore } from "@/store/useLearningMdStore";
import { useViewModeStore } from "@/store/useViewModeStore";
import "./MdMapConvertBar.css";

export function MdMapConvertBar() {
  const [mdBusy, setMdBusy] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);

  const caseSlug = useAppStore((s) => s.currentCaseSlug);
  const nodes = useAppStore((s) => s.nodes);
  const edges = useAppStore((s) => s.edges);
  const todos = useAppStore((s) => s.todos);
  const hydrateSnapshot = useAppStore((s) => s.hydrateSnapshot);

  const draft = useLearningMdStore((s) => s.draft);
  const refreshFileList = useLearningMdStore((s) => s.refreshFileList);
  const openPath = useLearningMdStore((s) => s.openPath);

  const setViewMode = useViewModeStore((s) => s.setViewMode);

  const mdTrim = draft.trim();
  const canMdToMap = mdTrim.length > 0 && !mdBusy && !mapBusy;
  const canMapToMd = nodes.length > 0 && !mdBusy && !mapBusy;

  const onMdToMap = async () => {
    if (!canMdToMap) return;
    setMdBusy(true);
    const hide = message.loading("正在将 MD 转为图谱（调用 LLM）…", 0);
    try {
      const snap = await postConvertMdToMap({
        case_slug: caseSlug,
        markdown: draft,
      });
      hydrateSnapshot(snap.nodes, snap.edges, snap.todos);
      setViewMode("map");
      message.success(`已保存快照「${snap.name}」并切换到 Learning Map`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      hide();
      setMdBusy(false);
    }
  };

  const onMapToMd = async () => {
    if (!canMapToMd) return;
    setMapBusy(true);
    const hide = message.loading("正在将图谱转为 MD（调用 LLM）…", 0);
    try {
      const { path } = await postConvertMapToMd({
        case_slug: caseSlug,
        nodes,
        edges,
        todos,
      });
      await refreshFileList();
      await openPath(path);
      setViewMode("learning-md");
      message.success(`已写入「${path}」并切换到 Learning MD`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      hide();
      setMapBusy(false);
    }
  };

  return (
    <div className="mmc-bar" aria-label="MD 与图谱互转">
      <Button
        type="default"
        size="small"
        className="mmc-btn"
        icon={<FileText size={14} aria-hidden />}
        loading={mdBusy}
        disabled={!canMdToMap}
        onClick={() => void onMdToMap()}
      >
        <span className="mmc-btn-label">
          MD <ArrowRightCircle size={12} className="mmc-arrow" aria-hidden /> Map
        </span>
      </Button>
      <Button
        type="default"
        size="small"
        className="mmc-btn"
        icon={<GitBranch size={14} aria-hidden />}
        loading={mapBusy}
        disabled={!canMapToMd}
        onClick={() => void onMapToMd()}
      >
        <span className="mmc-btn-label">
          Map <ArrowRightCircle size={12} className="mmc-arrow" aria-hidden /> MD
        </span>
      </Button>
    </div>
  );
}
