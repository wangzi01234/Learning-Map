import { useEffect, useState } from "react";
import { Button, Input, List, Modal, Select, Space, Typography, message } from "antd";
import { BookOpen, Loader, Save } from "react-feather";
import {
  getGraphSnapshot,
  getLearningCaseDetail,
  getLearningCases,
  listGraphSnapshots,
  saveGraphSnapshot,
  type LearningCaseMeta,
} from "@/api/client";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import "./CaseToolbar.css";

const { Text } = Typography;

export function CaseToolbar() {
  const {
    currentCaseSlug,
    setCurrentCaseSlug,
    applyCaseInitial,
    hydrateSnapshot,
    nodes,
    edges,
    todos,
  } = useAppStore(
    useShallow((s) => ({
      currentCaseSlug: s.currentCaseSlug,
      setCurrentCaseSlug: s.setCurrentCaseSlug,
      applyCaseInitial: s.applyCaseInitial,
      hydrateSnapshot: s.hydrateSnapshot,
      nodes: s.nodes,
      edges: s.edges,
      todos: s.todos,
    }))
  );

  const [cases, setCases] = useState<LearningCaseMeta[]>([]);
  const [loadOpen, setLoadOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotList, setSnapshotList] = useState<Awaited<ReturnType<typeof listGraphSnapshots>>>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);

  useEffect(() => {
    void getLearningCases()
      .then(setCases)
      .catch(() => {
        setCases([]);
      });
  }, []);

  const currentMeta = cases.find((c) => c.slug === currentCaseSlug);

  const switchCase = async (slug: string) => {
    if (slug === currentCaseSlug) return;
    setLoadingCase(true);
    try {
      const d = await getLearningCaseDetail(slug);
      setCurrentCaseSlug(slug);
      applyCaseInitial(d.initial_nodes, d.initial_edges);
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCase(false);
    }
  };

  const openLoad = async () => {
    setLoadOpen(true);
    setLoadingList(true);
    try {
      const list = await listGraphSnapshots(currentCaseSlug);
      setSnapshotList(list);
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
      setSnapshotList([]);
    } finally {
      setLoadingList(false);
    }
  };

  const onSave = async () => {
    const name = snapshotName.trim();
    if (!name) {
      message.warning("请填写快照名称");
      return;
    }
    try {
      await saveGraphSnapshot({
        case_slug: currentCaseSlug,
        name,
        nodes,
        edges,
        todos,
      });
      message.success("已保存到数据库");
      setSaveOpen(false);
      setSnapshotName("");
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };

  const onPickSnapshot = async (id: string) => {
    try {
      const snap = await getGraphSnapshot(id);
      if (snap.case_slug !== currentCaseSlug) {
        setCurrentCaseSlug(snap.case_slug);
      }
      hydrateSnapshot(snap.nodes, snap.edges, snap.todos);
      message.success(`已载入「${snap.name}」`);
      setLoadOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="ct-root">
      <Space wrap className="ct-row" size="middle">
        <span className="ct-label">
          <BookOpen size={16} strokeWidth={1.8} aria-hidden />
          学习案例
        </span>
        <Select
          className="ct-select"
          value={currentCaseSlug}
          loading={loadingCase}
          options={cases.map((c) => ({ label: c.title, value: c.slug }))}
          onChange={(v) => void switchCase(String(v))}
          popupMatchSelectWidth={false}
          style={{ minWidth: 220 }}
        />
        <Button className="sketch-btn" icon={<Save size={16} />} onClick={() => setSaveOpen(true)}>
          保存快照
        </Button>
        <Button className="sketch-btn" icon={<Loader size={16} />} onClick={() => void openLoad()}>
          读取快照
        </Button>
      </Space>

      <Modal
        title="保存图谱快照"
        open={saveOpen}
        onOk={() => void onSave()}
        onCancel={() => setSaveOpen(false)}
        okText="保存"
        destroyOnClose
      >
        <Text type="secondary">将当前节点、连线与 TODO 写入 PostgreSQL，便于下次恢复。</Text>
        <Input
          className="ct-snapshot-input sketch-textarea"
          placeholder="为此版本起个名字，例如：期末复习版"
          value={snapshotName}
          onChange={(e) => setSnapshotName(e.target.value)}
          style={{ marginTop: 12 }}
        />
      </Modal>

      <Modal
        title="从数据库读取快照"
        open={loadOpen}
        footer={null}
        onCancel={() => setLoadOpen(false)}
        width={520}
        destroyOnClose
      >
        <Text type="secondary">当前案例：{currentMeta?.title ?? currentCaseSlug}</Text>
        <List
          loading={loadingList}
          dataSource={snapshotList}
          locale={{ emptyText: "暂无快照，可先点击「保存快照」" }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="load" type="link" onClick={() => void onPickSnapshot(item.id)}>
                  载入
                </Button>,
              ]}
            >
              <List.Item.Meta title={item.name} description={`更新于 ${item.updated_at}`} />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}
