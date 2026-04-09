import { Form, Modal, Select, message } from "antd";
import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

const RELATIONS = ["启发", "衍生", "解决", "先修", "改进", "替代", "相关"];

interface Props {
  open: boolean;
  sourceId: string | null;
  onClose: () => void;
}

export function AddRelationModal({ open, sourceId, onClose }: Props) {
  const [form] = Form.useForm<{ target: string; relation: string }>();
  const nodes = useAppStore((s) => s.nodes);
  const addEdgeManual = useAppStore((s) => s.addEdgeManual);

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const source = nodes.find((n) => n.id === sourceId);
  const targets = nodes.filter((n) => n.id !== sourceId);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      if (!sourceId) return;
      if (v.target === sourceId) {
        message.warning("请选择不同的目标节点");
        return;
      }
      addEdgeManual(sourceId, v.target, v.relation, v.relation);
      message.success("已添加关系");
      onClose();
    } catch {
      /* validate */
    }
  };

  return (
    <Modal
      title="添加关系"
      open={open}
      onOk={() => void submit()}
      onCancel={onClose}
      okText="确认"
      cancelText="取消"
      destroyOnClose
      className="sketch-modal"
    >
      <p style={{ marginBottom: 12, fontFamily: '"Nunito", sans-serif' }}>
        从「{source?.name ?? "—"}」连接到：
      </p>
      <Form form={form} layout="vertical">
        <Form.Item
          name="target"
          label="目标节点"
          rules={[{ required: true, message: "请选择目标节点" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="选择已有节点"
            options={targets.map((n) => ({
              value: n.id,
              label: `${n.name} (${n.year})`,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="relation"
          label="关系类型"
          initialValue={RELATIONS[0]}
          rules={[{ required: true, message: "请选择关系" }]}
        >
          <Select
            options={RELATIONS.map((r) => ({ value: r, label: r }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
