import { ConfigProvider, Layout, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { GitBranch } from "react-feather";
import { AddRelationModal } from "@/components/AddRelationModal";
import { AppModeSwitcher } from "@/components/AppModeSwitcher";
import { MdMapConvertBar } from "@/components/MdMapConvertBar";
import { CaseBootstrap } from "@/components/CaseBootstrap";
import { CaseToolbar } from "@/components/CaseToolbar";
import { ChatPanel } from "@/components/ChatPanel";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { LearningMdLayout } from "@/components/learning-md/LearningMdLayout";
import { LearningMdWorkspace } from "@/components/learning-md/LearningMdWorkspace";
import { LearningMdToolbar } from "@/components/learning-md/LearningMdToolbar";
import { NodeCard } from "@/components/NodeCard";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { TodoPanel } from "@/components/TodoPanel";
import { getAntdThemeConfig } from "@/theme/antdTheme";
import { useUiThemeStore } from "@/theme/uiThemeStore";
import { useAppStore } from "@/store/useAppStore";
import { useViewModeStore } from "@/store/useViewModeStore";
import "./App.css";
import "@/components/AppModeSwitcher.css";

const { Content } = Layout;
const { Title, Text } = Typography;

/** 网站级一句话说明（与具体学习案例无关） */
const SITE_TAGLINE =
  "可交互知识脉络：浏览图谱、整理待学，对话式 AI 扩展节点与关系。";

const SITE_TAGLINE_MD =
  "左侧多轮 LLM 辅助（可折叠），右侧 Markdown 编辑与预览；保存后写入本地目录。";

function readPopout(): boolean {
  return new URLSearchParams(window.location.search).get("popout") === "1";
}

export default function App() {
  const uiTheme = useUiThemeStore((s) => s.uiTheme);
  const antdTheme = useMemo(() => getAntdThemeConfig(uiTheme), [uiTheme]);

  const viewMode = useViewModeStore((s) => s.viewMode);
  const setViewMode = useViewModeStore((s) => s.setViewMode);
  const [popout, setPopout] = useState(readPopout);

  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const nodes = useAppStore((s) => s.nodes);
  const selected = nodes.find((n) => n.id === selectedNodeId);
  const [relOpen, setRelOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-ui-theme", uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    document.title = viewMode === "learning-md" ? "Learning MD" : "Learning Map";
  }, [viewMode]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setPopout(q.get("popout") === "1");
    if (q.get("popout") === "1") {
      setViewMode("learning-md");
      return;
    }
    const v = q.get("view");
    if (v === "learning-md" || v === "map") {
      setViewMode(v);
    }
  }, [setViewMode]);

  if (popout) {
    return (
      <ConfigProvider theme={antdTheme}>
        <CaseBootstrap />
        <Layout className="app-shell app-shell--popout">
          <Content className="app-popout-inner">
            <header className="app-popout-header">
              <Title level={5} className="app-popout-title">
                Learning MD · 独立窗口
              </Title>
              <div className="app-popout-toolbar">
                <LearningMdToolbar variant="popout" />
              </div>
              <ThemeSwitcher />
            </header>
            <div className="app-popout-doc">
              <LearningMdLayout showPopoutButton={false} />
            </div>
          </Content>
        </Layout>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={antdTheme}>
      <CaseBootstrap />
      <Layout className="app-shell">
        <Content
          className={
            viewMode === "learning-md" ? "app-grid-six app-grid-learning-md" : "app-grid-six"
          }
        >
          <header className="app-grid-cell app-grid-cell--title-bar" aria-label="站点标题与工具栏">
            <div className="app-title-bar-left">
              <div className="app-header-brand-block">
                <div className="app-header-brand-top">
                  <div className="app-brand">
                    <GitBranch size={28} strokeWidth={1.75} className="app-brand-icon" />
                    <Title level={4} className="app-title">
                      {viewMode === "learning-md" ? "Learning MD" : "Learning Map"}
                    </Title>
                  </div>
                  <div className="app-header-mode-switch-wrap">
                    <AppModeSwitcher />
                    <MdMapConvertBar />
                  </div>
                </div>
                <Text type="secondary" className="app-site-tagline">
                  {viewMode === "learning-md" ? SITE_TAGLINE_MD : SITE_TAGLINE}
                </Text>
              </div>
            </div>
            <div className="app-title-bar-right">
              <div className="app-header-toolbar-wrap">
                <div className="app-header-toolbar-main">
                  {viewMode === "map" ? <CaseToolbar /> : <LearningMdToolbar />}
                </div>
                <ThemeSwitcher />
              </div>
            </div>
          </header>
          {viewMode === "map" ? (
            <>
              <section className="app-grid-cell app-grid-cell--graph" aria-label="知识图谱">
                <KnowledgeGraph />
              </section>
              <section className="app-grid-cell app-grid-cell--node" aria-label="知识点说明">
                <NodeCard node={selected} onAddRelation={() => setRelOpen(true)} />
              </section>
              <section className="app-grid-cell app-grid-cell--chat" aria-label="LLM 扩展">
                <ChatPanel />
              </section>
              <section className="app-grid-cell app-grid-cell--todo" aria-label="学习 TODO">
                <TodoPanel />
              </section>
            </>
          ) : (
            <section className="app-grid-cell app-grid-cell--md-workspace" aria-label="Learning MD 工作区">
              <LearningMdWorkspace />
            </section>
          )}
        </Content>
      </Layout>
      <AddRelationModal
        open={relOpen}
        sourceId={selectedNodeId}
        onClose={() => setRelOpen(false)}
      />
    </ConfigProvider>
  );
}
