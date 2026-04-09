import { useState } from "react";
import { Button, Space, Tag, Typography, Image, message } from "antd";
import { BookOpen, Link as LinkIcon, MessageCircle, PlusSquare, Zap } from "react-feather";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useShallow } from "zustand/react/shallow";
import { postExtend } from "@/api/client";
import type { GraphNode } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import "katex/dist/katex.min.css";
import { NodeExplanationChatModal } from "@/components/NodeExplanationChatModal";
import "./NodeCard.css";

const { Link: ALink } = Typography;

interface Props {
  node: GraphNode | undefined;
  onAddRelation: () => void;
}

export function NodeCard({ node, onAddRelation }: Props) {
  const [recLoading, setRecLoading] = useState(false);
  const [explainChatOpen, setExplainChatOpen] = useState(false);
  const addTodo = useAppStore((s) => s.addTodo);
  const { nodes, edges, applyExtendResult, currentCaseSlug } = useAppStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      applyExtendResult: s.applyExtendResult,
      currentCaseSlug: s.currentCaseSlug,
    }))
  );

  const recommendTodos = async () => {
    if (!node) return;
    setRecLoading(true);
    try {
      const existingNodes = nodes.map((n) => n.id);
      const existingEdges: [string, string, string][] = edges.map((e) => [
        e.source,
        e.target,
        e.relation,
      ]);
      const res = await postExtend({
        prompt: `用户正在浏览知识点「${node.name}」（节点 id=${node.id}）。请根据该知识点生成 2～3 条「待学 TODO」，优先放在 newTodos 中；若确有必要可补充少量 newNodes/newEdges，否则可为空数组。`,
        case_slug: currentCaseSlug,
        context: { existingNodes, existingEdges },
      });
      applyExtendResult(res);
      message.success("已加入推荐待学（并可能补充相关节点）");
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRecLoading(false);
    }
  };

  if (!node) {
    return (
      <div className="nc-empty sketch-card">
        <BookOpen size={36} strokeWidth={1.5} />
        <p>点击图谱中的节点查看知识点卡片</p>
      </div>
    );
  }

  const d = node.details;

  return (
    <div className="nc-root sketch-card">
      <div className="nc-header">
        <h2 className="nc-title">{node.name}</h2>
        <Space wrap>
          <Tag className="sketch-tag">{node.year || "—"}</Tag>
          <Tag className="sketch-tag sketch-tag-accent">{node.category}</Tag>
        </Space>
      </div>

      <div className="nc-section">
        <h3 className="nc-h3">一句话</h3>
        <p className="nc-lead">{node.description}</p>
      </div>

      <div className="nc-section">
        <h3 className="nc-h3">通俗解释</h3>
        <div className="nc-md">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {d.explanation || "_暂无_"}
          </ReactMarkdown>
        </div>
        <div className="nc-explain-chat">
          <Button
            type="default"
            className="sketch-btn"
            icon={<MessageCircle size={16} />}
            onClick={() => setExplainChatOpen(true)}
          >
            AI 聊天（探讨通俗解释）
          </Button>
        </div>
      </div>

      {d.formula ? (
        <div className="nc-section">
          <h3 className="nc-h3">公式</h3>
          <div className="nc-md nc-formula">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {`$$${d.formula}$$`}
            </ReactMarkdown>
          </div>
        </div>
      ) : null}

      {d.animation ? (
        <div className="nc-section nc-muted">
          <h3 className="nc-h3">动画 / 演示</h3>
          <p>{d.animation}</p>
        </div>
      ) : null}

      {d.images && d.images.length > 0 ? (
        <div className="nc-section">
          <h3 className="nc-h3">图示</h3>
          <Space direction="vertical" style={{ width: "100%" }}>
            {d.images.map((src) => (
              <Image
                key={src}
                src={src}
                alt="占位图示"
                className="nc-img"
                preview
              />
            ))}
          </Space>
        </div>
      ) : null}

      {d.code ? (
        <div className="nc-section">
          <h3 className="nc-h3">代码</h3>
          <SyntaxHighlighter
            language="python"
            style={oneLight}
            className="nc-code"
            showLineNumbers
          >
            {d.code.trim()}
          </SyntaxHighlighter>
        </div>
      ) : null}

      {d.links && d.links.length > 0 ? (
        <div className="nc-section">
          <h3 className="nc-h3">
            <LinkIcon size={16} className="nc-inline-icon" /> 外部链接
          </h3>
          <ul className="nc-links">
            {d.links.map((l) => (
              <li key={l.url}>
                <ALink href={l.url} target="_blank" rel="noreferrer">
                  {l.name}
                </ALink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <NodeExplanationChatModal
        open={explainChatOpen}
        node={node}
        onClose={() => setExplainChatOpen(false)}
      />

      <div className="nc-actions">
        <Button
          type="primary"
          className="sketch-btn-primary"
          icon={<PlusSquare size={18} />}
          onClick={() =>
            addTodo({
              title: `学习：${node.name}`,
              description: node.description,
              relatedNodeId: node.id,
            })
          }
        >
          加入 TODO
        </Button>
        <Button
          className="sketch-btn"
          icon={<Zap size={18} />}
          loading={recLoading}
          onClick={() => void recommendTodos()}
        >
          AI 推荐待学
        </Button>
        <Button className="sketch-btn" onClick={onAddRelation}>
          添加关系
        </Button>
      </div>
    </div>
  );
}
