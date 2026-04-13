import { useEffect } from "react";
import { Button, Modal, Select, Space, Typography, message } from "antd";
import { FilePlus } from "react-feather";
import { useShallow } from "zustand/react/shallow";
import { useLearningMdStore } from "@/store/useLearningMdStore";
import "./LearningMdToolbar.css";

const { Text } = Typography;

interface Props {
  /** 独立窗口：精简文案 */
  variant?: "main" | "popout";
}

export function LearningMdToolbar({ variant = "main" }: Props) {
  const {
    files,
    currentPath,
    loadingList,
    loadingDoc,
    saving,
    dirty,
    listError,
    openPath,
    createNewDoc,
    refreshFileList,
  } = useLearningMdStore(
    useShallow((s) => ({
      files: s.files,
      currentPath: s.currentPath,
      loadingList: s.loadingList,
      loadingDoc: s.loadingDoc,
      saving: s.saving,
      dirty: s.dirty,
      listError: s.listError,
      openPath: s.openPath,
      createNewDoc: s.createNewDoc,
      refreshFileList: s.refreshFileList,
    }))
  );

  useEffect(() => {
    void refreshFileList();
  }, [refreshFileList]);

  const runCreateNew = async () => {
    try {
      await createNewDoc();
      message.success("已新建 Markdown 文档");
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };

  const onCreateNew = () => {
    if (dirty) {
      Modal.confirm({
        title: "当前文档有未保存的修改",
        content: "新建将切换到新文件，未保存内容将丢失。可先点「保存」再新建。",
        okText: "仍要新建",
        cancelText: "取消",
        onOk: () => void runCreateNew(),
      });
      return;
    }
    void runCreateNew();
  };

  return (
    <div className="lmt-root">
      <Space wrap className="lmt-row" size="middle">
        <span className="lmt-label">文档</span>
        <Select
          className="lmt-select ct-select"
          loading={loadingList || loadingDoc}
          value={currentPath ?? undefined}
          placeholder={listError ? "无法加载列表" : "选择 .md 文件"}
          disabled={!!listError && files.length === 0}
          options={files.map((f) => ({ label: f.title, value: f.path }))}
          onChange={(v) => void openPath(String(v))}
          popupMatchSelectWidth={false}
          style={{ minWidth: 240 }}
        />
        <Button
          className="sketch-btn"
          icon={<FilePlus size={16} />}
          loading={saving}
          disabled={!!listError}
          onClick={() => void onCreateNew()}
        >
          新建
        </Button>
      </Space>
      {listError ? (
        <Text type="danger" className="lmt-hint">
          {listError}
        </Text>
      ) : (
        <Text type="secondary" className="lmt-hint">
          {variant === "main"
            ? "与 backend/docs_md（或 MD_DOCS_ROOT）同步；本地编辑器保存后点「重新加载」即可合并。"
            : "此窗口仅文档区；LLM 辅助请在主窗口 Learning MD 模式使用。"}
        </Text>
      )}
    </div>
  );
}
