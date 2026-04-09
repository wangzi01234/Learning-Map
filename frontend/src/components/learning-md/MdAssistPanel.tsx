import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Input, Typography, message } from "antd";
import { FileText, Send } from "react-feather";
import { useShallow } from "zustand/react/shallow";
import { postMdAssist } from "@/api/client";
import { useLearningMdStore } from "@/store/useLearningMdStore";
import "@/components/ChatPanel.css";
import "./MdAssistPanel.css";

const { Text } = Typography;

export type MdChatTurn = { role: "user" | "assistant"; content: string };

function pickApplyMarkdown(res: {
  applyMarkdown?: string | null;
  apply_markdown?: string | null;
}): string | null {
  const a = res.applyMarkdown ?? res.apply_markdown;
  if (a == null || typeof a !== "string") return null;
  const t = a.trim();
  return t.length > 0 ? t : null;
}

export function MdAssistPanel() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<MdChatTurn[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  const { currentPath, draft, setDraft } = useLearningMdStore(
    useShallow((s) => ({
      currentPath: s.currentPath,
      draft: s.draft,
      setDraft: s.setDraft,
    }))
  );

  useEffect(() => {
    setMessages([]);
    setText("");
  }, [currentPath]);

  useLayoutEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const instruction = text.trim();
    if (!instruction) {
      message.warning("请输入想让 AI 如何协助（扩写、润色、补全章节等）");
      return;
    }
    if (!currentPath) {
      message.warning("请先选择一篇文档");
      return;
    }
    setLoading(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await postMdAssist({
        path: currentPath,
        markdown: draft,
        instruction,
        conversation: history,
      });
      const applied = pickApplyMarkdown(res);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: instruction },
        { role: "assistant", content: res.reply },
      ]);
      if (applied) {
        setDraft(applied);
        message.success("已写入当前文档编辑区，请点击「保存」同步到磁盘");
      } else {
        message.success("模型已回复（未返回可写入的全文时，请根据回复自行修改）");
      }
      setText("");
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="map-assist-root sketch-chat cp-root">
      <div className="map-assist-head">
        <FileText size={20} strokeWidth={1.8} />
        <span className="map-assist-title">LLM 辅助</span>
        <Text type="secondary" className="map-assist-hint">
          多轮对话会带上文；返回全文时将写入右侧编辑器，再点工具栏「保存」
        </Text>
      </div>
      <div className="map-assist-thread" ref={threadRef}>
        {messages.length === 0 ? (
          <Text type="secondary" className="map-assist-empty">
            在此输入需求并发送
          </Text>
        ) : (
          messages.map((m, idx) => (
            <div
              key={`${idx}-${m.role}-${m.content.slice(0, 12)}`}
              className={`map-assist-bubble map-assist-bubble--${m.role}`}
            >
              <Text className="map-assist-bubble-text">{m.content}</Text>
            </div>
          ))
        )}
      </div>
      <div className="map-assist-compose cp-compose">
        <div className="map-assist-compose-field cp-compose-field">
          <Input.TextArea
            className="sketch-textarea"
            rows={4}
            autoSize={{ minRows: 4, maxRows: 12 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入本轮需求…（Shift+Enter 换行）"
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
          className="cp-send map-assist-send"
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
