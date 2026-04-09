import { useState } from "react";
import { Button, Checkbox, Input, Space, Typography } from "antd";
import { List, Trash2 } from "react-feather";
import { useAppStore } from "@/store/useAppStore";
import "./TodoPanel.css";

const { Text } = Typography;

export function TodoPanel() {
  const todos = useAppStore((s) => s.todos);
  const toggleTodo = useAppStore((s) => s.toggleTodo);
  const removeTodo = useAppStore((s) => s.removeTodo);
  const [draft, setDraft] = useState("");

  return (
    <div className="tp-root sketch-todo">
      <div className="tp-head">
        <List size={20} strokeWidth={1.8} />
        <span className="tp-title">学习 TODO</span>
        <Text type="secondary" className="tp-count">
          {todos.filter((t) => !t.done).length} 项待完成
        </Text>
      </div>

      <div className="tp-add">
        <Space.Compact style={{ width: "100%" }}>
          <Input
            className="sketch-input"
            placeholder="添加待学事项…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPressEnter={() => {
              const v = draft.trim();
              if (!v) return;
              useAppStore.getState().addTodo({ title: v });
              setDraft("");
            }}
          />
          <Button
            className="sketch-btn"
            onClick={() => {
              const v = draft.trim();
              if (!v) return;
              useAppStore.getState().addTodo({ title: v });
              setDraft("");
            }}
          >
            添加
          </Button>
        </Space.Compact>
      </div>

      <ul className="tp-list">
        {todos.map((t) => (
          <li key={t.id} className="tp-item">
            <label className="tp-row">
              <Checkbox
                className="tp-check"
                checked={t.done}
                onChange={() => toggleTodo(t.id)}
              />
              <span className={t.done ? "tp-text done" : "tp-text"}>
                {t.title}
              </span>
            </label>
            {t.description ? (
              <div className="tp-desc">{t.description}</div>
            ) : null}
            <Button
              type="text"
              danger
              size="small"
              className="tp-del"
              icon={<Trash2 size={16} />}
              onClick={() => removeTodo(t.id)}
              aria-label="删除"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
