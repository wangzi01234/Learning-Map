import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Form, Input, Modal, Switch, Typography, message } from "antd";
import { FileText, Send } from "react-feather";
import { useShallow } from "zustand/react/shallow";
import { postMdAssist } from "@/api/client";
import { useLearningMdStore } from "@/store/useLearningMdStore";
import { useMdAssistLlmApiKeySessionStore } from "@/store/useMdAssistLlmApiKeySessionStore";
import { useMdAssistLlmStore } from "@/store/useMdAssistLlmStore";
import type { MdAssistLlmConfig } from "@/api/client";
import "@/components/ChatPanel.css";
import "@/components/ThemeSwitcher.css";
import "./MdAssistPanel.css";

const { Text } = Typography;

export type MdChatTurn = { role: "user" | "assistant"; content: string };

function mergeLlmWithSessionKey(
  base: MdAssistLlmConfig | undefined,
  apiKey: string
): MdAssistLlmConfig | undefined {
  const k = apiKey.trim();
  if (!base && !k) return undefined;
  if (!k) return base;
  return { ...(base ?? {}), api_key: k };
}

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm] = Form.useForm();
  const threadRef = useRef<HTMLDivElement>(null);

  const { currentPath, draft, setDraft } = useLearningMdStore(
    useShallow((s) => ({
      currentPath: s.currentPath,
      draft: s.draft,
      setDraft: s.setDraft,
    }))
  );

  const { stream, setAll, reset, buildLlmPayload } = useMdAssistLlmStore(
    useShallow((s) => ({
      stream: s.stream,
      setAll: s.setAll,
      reset: s.reset,
      buildLlmPayload: s.buildLlmPayload,
    }))
  );

  const openSettings = () => {
    const s = useMdAssistLlmStore.getState();
    const apiKey = useMdAssistLlmApiKeySessionStore.getState().apiKey;
    settingsForm.setFieldsValue({
      model: s.model,
      model_provider: s.model_provider,
      base_url: s.base_url,
      api_key: apiKey,
      temperatureStr: s.temperatureStr,
      stream: s.stream,
      model_kwargs_extra: s.model_kwargs_extra,
    });
    setSettingsOpen(true);
  };

  const applySettings = async () => {
    try {
      const v = await settingsForm.validateFields();
      setAll({
        model: v.model ?? "",
        model_provider: v.model_provider ?? "openai",
        base_url: v.base_url ?? "",
        temperatureStr: v.temperatureStr ?? "",
        stream: Boolean(v.stream),
        model_kwargs_extra: v.model_kwargs_extra ?? "",
      });
      useMdAssistLlmApiKeySessionStore.getState().setApiKey(typeof v.api_key === "string" ? v.api_key : "");
      setSettingsOpen(false);
      message.success("已保存 LLM 设置（API Key 仅本次会话有效）");
    } catch {
      /* 校验失败 */
    }
  };

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
      setMessages((prev) => [
        ...prev,
        { role: "user", content: instruction },
        { role: "assistant", content: "" },
      ]);
      const llm = mergeLlmWithSessionKey(
        buildLlmPayload(),
        useMdAssistLlmApiKeySessionStore.getState().apiKey
      );
      const res = await postMdAssist(
        {
          path: currentPath,
          markdown: draft,
          instruction,
          conversation: history,
          stream,
          ...(llm ? { llm } : {}),
        },
        stream
          ? {
              onDelta: (t) => {
                setMessages((prev) => {
                  if (prev.length === 0) return prev;
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last?.role === "assistant") {
                    copy[copy.length - 1] = { role: "assistant", content: last.content + t };
                  }
                  return copy;
                });
              },
            }
          : undefined
      );
      const applied = pickApplyMarkdown(res);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: res.reply };
        return copy;
      });
      if (applied) {
        setDraft(applied);
        message.success("已写入当前文档编辑区，请点击「保存」同步到磁盘");
      } else {
        message.success("模型已回复（未返回可写入的全文时，请根据回复自行修改）");
      }
      setText("");
    } catch (e) {
      setMessages((prev) => prev.slice(0, -2));
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="map-assist-root sketch-chat cp-root">
      <div className="map-assist-head">
        <div className="map-assist-head-row">
          <div className="map-assist-head-leading">
            <FileText size={20} strokeWidth={1.8} />
            <span className="map-assist-title">LLM 辅助</span>
          </div>
          <Button
            type="text"
            className="theme-switcher-trigger map-assist-settings-trigger"
            aria-label="LLM 设置"
            onClick={openSettings}
          >
            设置
          </Button>
        </div>
        <Text type="secondary" className="map-assist-hint">
          多轮对话会带上文；返回全文时将写入右侧编辑器，再点工具栏「保存」
        </Text>
      </div>

      <Modal
        title="LLM 源与响应模式"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={() => void applySettings()}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        width={480}
        className="map-assist-settings-modal"
      >
        <Text type="secondary" className="map-assist-settings-intro">
          以下为 init_chat_model 的可选覆盖项；留空则使用服务端 .env。API Key
          仅密文显示、只保存在内存中，关闭页面即清除，请求时传给后端、不写浏览器存储。
        </Text>
        <Form
          form={settingsForm}
          layout="vertical"
          className="map-assist-settings-form"
          initialValues={{
            model: "",
            model_provider: "openai",
            base_url: "",
            api_key: "",
            temperatureStr: "",
            stream: true,
            model_kwargs_extra: "",
          }}
        >
          <Form.Item label="model" name="model">
            <Input allowClear placeholder="例：gpt-4o-mini，留空用服务端 OPENAI_MODEL" />
          </Form.Item>
          <Form.Item label="model_provider" name="model_provider">
            <Input allowClear placeholder="默认 openai（需已安装对应 langchain 集成包）" />
          </Form.Item>
          <Form.Item label="base_url" name="base_url">
            <Input allowClear placeholder="兼容网关根路径，留空用服务端 OPENAI_BASE_URL" />
          </Form.Item>
          <Form.Item label="api_key" name="api_key">
            <Input.Password
              allowClear
              autoComplete="off"
              visibilityToggle={false}
              placeholder="留空用服务端 OPENAI_API_KEY"
            />
          </Form.Item>
          <Form.Item label="temperature" name="temperatureStr">
            <Input allowClear placeholder="留空由后端使用默认 0.3" />
          </Form.Item>
          <Form.Item
            label="model_kwargs 额外字段（JSON 对象）"
            name="model_kwargs_extra"
            rules={[
              {
                validator: async (_, v) => {
                  const s = typeof v === "string" ? v.trim() : "";
                  if (!s) return;
                  try {
                    const o = JSON.parse(s) as unknown;
                    if (o === null || typeof o !== "object" || Array.isArray(o)) {
                      throw new Error("须为 JSON 对象");
                    }
                  } catch (e) {
                    throw new Error(e instanceof Error ? e.message : "JSON 格式无效");
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={3} placeholder='例如 {"top_p":0.9}，会与 response_format 合并' />
          </Form.Item>
          <Form.Item label="响应模式" name="stream" valuePropName="checked">
            <Switch checkedChildren="流式 stream" unCheckedChildren="一次性 invoke" />
          </Form.Item>
        </Form>
        <Button
          type="link"
          className="map-assist-settings-reset"
          onClick={() => {
            reset();
            useMdAssistLlmApiKeySessionStore.getState().setApiKey("");
            const s = useMdAssistLlmStore.getState();
            settingsForm.setFieldsValue({
              model: s.model,
              model_provider: s.model_provider,
              base_url: s.base_url,
              api_key: "",
              temperatureStr: s.temperatureStr,
              stream: s.stream,
              model_kwargs_extra: s.model_kwargs_extra,
            });
            message.info("已恢复默认并写入表单，请点「保存」生效或继续修改");
          }}
        >
          恢复默认
        </Button>
      </Modal>
      <div className="map-assist-thread" ref={threadRef}>
        {messages.map((m, idx) => (
          <div
            key={`${idx}-${m.role}-${m.content.slice(0, 12)}`}
            className={`map-assist-bubble map-assist-bubble--${m.role}`}
          >
            <Text className="map-assist-bubble-text">{m.content}</Text>
          </div>
        ))}
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
