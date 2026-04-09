import { useEffect, useRef, useState } from "react";
import { Button, Input, Modal, Space, Typography, message } from "antd";
import { MessageCircle, Send } from "react-feather";
import type { ExplainChatMessage } from "@/api/client";
import { postExplainChat } from "@/api/client";
import type { GraphNode } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import "./NodeExplanationChatModal.css";

const { Text, Paragraph } = Typography;

interface Props {
  open: boolean;
  node: GraphNode;
  onClose: () => void;
}

export function NodeExplanationChatModal({ open, node, onClose }: Props) {
  const updateNodeDetails = useAppStore((s) => s.updateNodeDetails);
  const currentCaseSlug = useAppStore((s) => s.currentCaseSlug);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ExplainChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingApply, setPendingApply] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setInput("");
    setPendingApply(null);
  }, [open, node.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text) {
      message.warning("请输入内容");
      return;
    }
    setPendingApply(null);
    const userMsg: ExplainChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await postExplainChat({
        nodeId: node.id,
        nodeName: node.name,
        currentExplanation: node.details.explanation ?? "",
        messages: nextMessages,
        case_slug: currentCaseSlug,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      if (res.applyExplanation != null && res.applyExplanation.trim() !== "") {
        setPendingApply(res.applyExplanation.trim());
      } else {
        setPendingApply(null);
      }
    } catch (e) {
      setMessages((prev) => prev.slice(0, -1));
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const applyPending = () => {
    if (!pendingApply) return;
    updateNodeDetails(node.id, { explanation: pendingApply });
    message.success("已更新该节点的通俗解释");
    setPendingApply(null);
  };

  return (
    <Modal
      title={
        <span className="necm-title">
          <MessageCircle size={18} strokeWidth={1.8} />
          与 AI 探讨「通俗解释」
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
      className="necm-modal"
    >
      <Text type="secondary" className="necm-hint">
        围绕「{node.name}」的解释提问或要求增删改；若模型给出可定稿全文，可点击下方「采用为通俗解释」写入卡片。
      </Text>
      <div className="necm-thread">
        {messages.length === 0 ? (
          <Paragraph type="secondary" className="necm-empty">
            例如：「把第二段缩短」「加一个类比」「删掉关于 XXX 的句子」
          </Paragraph>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={m.role === "user" ? "necm-bubble necm-bubble--user" : "necm-bubble necm-bubble--ai"}
            >
              {m.content}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {pendingApply ? (
        <div className="necm-apply-bar">
          <Text type="secondary">本回复包含可写入卡片的完整通俗解释</Text>
          <Space wrap>
            <Button type="primary" className="sketch-btn-primary" onClick={applyPending}>
              采用为通俗解释
            </Button>
            <Button className="sketch-btn" onClick={() => setPendingApply(null)}>
              暂不采用
            </Button>
          </Space>
        </div>
      ) : null}

      <div className="necm-input-row">
        <Input.TextArea
          className="sketch-textarea"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入你的疑问或修改要求…"
          disabled={loading}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button
          type="primary"
          className="necm-send sketch-btn-primary"
          icon={<Send size={18} />}
          loading={loading}
          onClick={() => void send()}
        >
          发送
        </Button>
      </div>
    </Modal>
  );
}
