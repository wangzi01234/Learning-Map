import { useState } from "react";
import { Button, Input, message, Typography } from "antd";
import { MessageCircle, Send } from "react-feather";
import { useShallow } from "zustand/react/shallow";
import { postExtend } from "@/api/client";
import { useAppStore } from "@/store/useAppStore";
import "./ChatPanel.css";

const { Text } = Typography;

export function ChatPanel() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");
  const { nodes, edges, applyExtendResult, currentCaseSlug } = useAppStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      applyExtendResult: s.applyExtendResult,
      currentCaseSlug: s.currentCaseSlug,
    }))
  );

  const send = async () => {
    const prompt = text.trim();
    if (!prompt) {
      message.warning("请输入内容");
      return;
    }
    setLoading(true);
    setStreamPreview("");
    try {
      const existingNodes = nodes.map((n) => n.id);
      const existingEdges: [string, string, string][] = edges.map((e) => [
        e.source,
        e.target,
        e.relation,
      ]);
      const res = await postExtend(
        {
          prompt,
          case_slug: currentCaseSlug,
          context: { existingNodes, existingEdges },
        },
        { onDelta: (t) => setStreamPreview((s) => s + t) }
      );
      applyExtendResult(res);
      message.success("已根据模型结果更新图谱与 TODO");
      setText("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      message.error(msg);
    } finally {
      setLoading(false);
      setStreamPreview("");
    }
  };

  return (
    <div className="cp-root sketch-chat">
      <div className="cp-head">
        <MessageCircle size={20} strokeWidth={1.8} />
        <span className="cp-title">LLM 扩展图谱</span>
        <Text type="secondary" className="cp-hint">
          结合上方所选学习案例，描述你想补充的概念或问题；模型会返回结构化节点与关系
        </Text>
      </div>
      {loading && streamPreview ? (
        <pre className="cp-stream-preview" aria-live="polite">
          {streamPreview}
        </pre>
      ) : null}
      <div className="cp-compose">
        <div className="cp-compose-field">
          <Input.TextArea
            className="sketch-textarea"
            rows={1}
            autoSize={{ minRows: 1, maxRows: 4 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如：「补充与当前案例相关的关键概念，并说明它与已有节点的关系」"
            disabled={loading}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
        </div>
        <Button
          type="default"
          className="cp-send"
          icon={<Send size={18} />}
          loading={loading}
          onClick={() => void send()}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
