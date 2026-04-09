# 知识脉络

交互式 Web 应用：以知识图谱形式展示可自定义主题的学习脉络，支持知识点卡片、TODO 清单，以及通过 OpenAI 兼容 API 动态扩展节点与关系。

## 目录结构

- `backend/`：FastAPI，提供 `POST /api/extend`（LLM 结构化扩展）
- `frontend/`：React + TypeScript + Vite + pnpm，图谱（G6）、Zustand 持久化、Ant Design 主题定制

## 环境要求

- Python 3.10+
- Node.js 18+ 与 [pnpm](https://pnpm.io/)

## 后端运行

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
# 编辑 .env：填写 OPENAI_API_KEY；可选 OPENAI_BASE_URL、OPENAI_MODEL

uvicorn main:app --reload --host 127.0.0.1 --port 3131
```

健康检查：<http://127.0.0.1:3131/health>

## 前端运行

```bash
cd frontend
pnpm install
pnpm dev
```

默认开发地址：<http://127.0.0.1:3130>（`vite.config.ts` 中 `server.host` 为 `127.0.0.1`、`server.port` 为 `3130`）

开发环境下，Vite 已将 `/api` 代理到 `http://127.0.0.1:3131`（见 `frontend/vite.config.ts`），因此无需单独配置 CORS 即可联调。

### 生产构建与预览

```bash
cd frontend
pnpm build
pnpm preview
```

若前后端不同域部署，请在前端环境变量中设置 API 根地址（例如 `https://api.example.com`），并确保后端 CORS 允许该来源：

```bash
# frontend/.env.production 示例
VITE_API_BASE=https://your-api-host
```

## 功能摘要

- **图谱**：G6 + dagre 布局，圆角矩形节点（浅色填充、虚线描边）、曲线边与箭头
- **卡片**：Markdown + KaTeX + 代码高亮；「加入 TODO」「AI 推荐待学」「添加关系」
- **TODO**：localStorage 持久化（Zustand persist）
- **LLM**：`/api/extend` 接收 `prompt` 与 `context`（现有节点 id、边三元组），返回 `newNodes` / `newEdges` / `newTodos` JSON

## 待实现

- **多格式笔记导入**：支持从 Word、PDF、Markdown、HTML 导入为笔记文档
- **笔记与流程图互通**：笔记文档与流程图（图谱）之间的相互生成与同步转化
- **Agent 与上下文**：调优 Agent 编排流程，增强对上下文的理解与利用

## 环境变量（后端）

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | 必填，OpenAI 或兼容服务的 API Key |
| `OPENAI_BASE_URL` | 可选，如 `https://api.openai.com/v1` 或自建兼容网关 |
| `OPENAI_MODEL` | 可选，默认 `gpt-4o-mini` |
| `LANGSMITH_TRACING` | 可选，设为 `true` 时向 LangSmith 上报追踪（需配合 `LANGSMITH_API_KEY`） |
| `LANGSMITH_API_KEY` | 可选，LangSmith API Key |
| `LANGSMITH_PROJECT` | 可选，追踪所属项目名（默认 `default`） |
| `LANGSMITH_WORKSPACE_ID` | 可选，多 workspace 时指定工作区 |

未配置 `OPENAI_API_KEY` 时，`/api/extend` 返回 503 与明确错误信息。
