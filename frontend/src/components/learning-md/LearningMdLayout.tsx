import { useMemo, useState } from "react";
import { Button, Segmented, message } from "antd";
import { ExternalLink, RefreshCw, Save } from "react-feather";
import { useShallow } from "zustand/react/shallow";
import { MdMarkdownPreview } from "@/components/learning-md/MdMarkdownPreview";
import { useLearningMdStore } from "@/store/useLearningMdStore";
import { extractToc } from "@/utils/mdToc";
import "./LearningMdLayout.css";

type PaneMode = "split" | "edit" | "preview";

function openLearningMdPopout() {
  const u = new URL(window.location.href);
  u.searchParams.set("view", "learning-md");
  u.searchParams.set("popout", "1");
  window.open(u.toString(), "learning-md-doc", "noopener,noreferrer");
}

interface LearningMdLayoutProps {
  /** 主窗口为 true；独立文档窗口为 false，不显示「新窗口打开」 */
  showPopoutButton?: boolean;
}

export function LearningMdLayout({ showPopoutButton = true }: LearningMdLayoutProps) {
  const [pane, setPane] = useState<PaneMode>("split");
  const { draft, setDraft, loadingDoc, currentPath, dirty, saving, saveDoc, reloadDoc } =
    useLearningMdStore(
      useShallow((s) => ({
        draft: s.draft,
        setDraft: s.setDraft,
        loadingDoc: s.loadingDoc,
        currentPath: s.currentPath,
        dirty: s.dirty,
        saving: s.saving,
        saveDoc: s.saveDoc,
        reloadDoc: s.reloadDoc,
      }))
    );

  const onSave = async () => {
    try {
      await saveDoc();
      message.success("已保存到本地 MD 目录");
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };

  const onReload = () =>
    void reloadDoc()
      .then(() => message.success("已重新加载"))
      .catch((e: Error) => message.error(e.message));

  const tocItems = useMemo(() => extractToc(draft), [draft]);

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="lml-root sketch-card">
      <header className="lml-toolbar" aria-label="文档视图与保存">
        <div className="lml-toolbar-start">
          {showPopoutButton ? (
            <Button
              type="default"
              size="small"
              className="lml-popout-btn"
              icon={<ExternalLink size={16} />}
              onClick={openLearningMdPopout}
            >
              新窗口打开
            </Button>
          ) : null}
          <Segmented<PaneMode>
            size="small"
            className="lml-pane-segmented"
            value={pane}
            onChange={(v) => setPane(v)}
            options={[
              { label: "分栏", value: "split" },
              { label: "仅编辑", value: "edit" },
              { label: "仅预览", value: "preview" },
            ]}
          />
        </div>
        <div className="lml-toolbar-end">
          {dirty ? (
            <span className="lml-dirty-badge" title="有未保存修改">
              未保存
            </span>
          ) : null}
          <Button
            type="default"
            size="small"
            className="lml-doc-action"
            icon={<Save size={16} />}
            loading={saving}
            disabled={!currentPath || !dirty}
            onClick={() => void onSave()}
          >
            保存
          </Button>
          <Button
            type="default"
            size="small"
            className="lml-doc-action"
            icon={<RefreshCw size={16} />}
            loading={loadingDoc}
            disabled={!currentPath}
            onClick={onReload}
          >
            重新加载
          </Button>
        </div>
      </header>
      <div className="lml-body">
        <aside className="lml-toc" aria-label="文档目录">
          <div className="lml-toc-title">目录</div>
          {tocItems.length === 0 ? (
            <p className="lml-toc-empty">暂无标题（使用 # / ## 等）</p>
          ) : (
            <nav className="lml-toc-nav">
              {tocItems.map((item, idx) => (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  className="lml-toc-item"
                  style={{ paddingLeft: 8 + (item.level - 1) * 10 }}
                  onClick={() => scrollToId(item.id)}
                >
                  {item.text}
                </button>
              ))}
            </nav>
          )}
        </aside>
        <div className="lml-main">
          <div
            className={
              pane === "split"
                ? "lml-split lml-split--two"
                : pane === "edit"
                  ? "lml-split lml-split--one"
                  : "lml-split lml-split--one"
            }
          >
            {(pane === "split" || pane === "edit") && (
              <div className="lml-editor-wrap">
                <textarea
                  className="lml-editor sketch-textarea"
                  spellCheck={false}
                  disabled={loadingDoc}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="在此编辑 Markdown…"
                  aria-label="Markdown 源码"
                />
              </div>
            )}
            {(pane === "split" || pane === "preview") && (
              <MdMarkdownPreview markdown={draft} tocItems={tocItems} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
