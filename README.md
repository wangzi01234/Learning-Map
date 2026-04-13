# 知识脉络

交互式 Web 应用：以知识图谱展示可自定义主题的学习脉络，支持知识点卡片、TODO 清单、图谱快照，以及通过 OpenAI 兼容 API 扩展节点与关系；并提供 **Learning MD** 模式（本地 Markdown 编辑、LLM 辅助、与图谱互转）。

## 目录结构

- `backend/`：FastAPI（案例与快照、图谱扩展、MD 文档库、LLM 接口等）
- `frontend/`：React + TypeScript + Vite + pnpm（G6 图谱、Zustand、Ant Design）
- `.cursor/skills/`：可选的 Cursor Agent Skill（如提交前检查说明），**会随仓库提交**；`.cursor` 下其余文件默认忽略

## 环境要求

- Python 3.10+
- Node.js 18+ 与 [pnpm](https://pnpm.io/)
- PostgreSQL（学习案例与图谱快照；本地开发见 `.env.example` 中 `DATABASE_URL`）

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
# 编辑 .env：填写 OPENAI_API_KEY；可选 OPENAI_BASE_URL、OPENAI_MODEL、DATABASE_URL、MD_DOCS_ROOT

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

### Learning Map（图谱模式）

- **图谱**：G6 + dagre 布局，圆角矩形节点、曲线边与箭头
- **卡片**：Markdown + KaTeX + 代码高亮；「加入 TODO」「AI 推荐待学」「添加关系」
- **TODO**：Zustand + localStorage 持久化
- **快照**：`POST/GET /api/graph/snapshots` 将当前图谱（节点、边、TODO）存入数据库并可恢复
- **LLM**：`POST /api/extend` 按 `prompt` 与现有 `context` 返回 `newNodes` / `newEdges` / `newTodos`；`POST /api/explain-chat` 多轮优化节点「通俗解释」

### Learning MD（文档模式）

- **文档库**：`GET/PUT /api/md/doc`、`GET /api/md/files`，默认写入 `backend/docs_md`（可通过 `MD_DOCS_ROOT` 覆盖；该目录已在 `.gitignore` 中排除，个人笔记不入库）
- **LLM 辅助**：`POST /api/md/assist`（支持工具读取参考 Markdown、流式 NDJSON）
- **与图谱互转**：标题栏在 Map / MD 切换下方可使用 **MD → Map**（LLM 结构化全文 → 写入快照并跳转图谱）、**Map → MD**（LLM 根据当前图谱生成笔记 → 写入 `.md` 并跳转编辑器）；接口为 `POST /api/convert/md-to-map`、`POST /api/convert/map-to-md`

### 提交前检查（Cursor）

- 仓库内 Skill：`.cursor/skills/pre-commit-git-check/SKILL.md` — 在 Cursor 中可在提交前让 Agent 按该清单做密钥、忽略规则与临时文件检查

## 待实现

- **多格式笔记导入**：从 Word、PDF、HTML 等导入为可编辑 Markdown（当前仅原生 MD 文件）
- **Agent 与上下文**：在已有 MD 辅助 Agent 基础上，继续调优编排、长上下文与跨文档一致性

## 环境变量（后端）

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | 必填（除非请求体显式传入兼容字段），OpenAI 或兼容服务的 API Key |
| `OPENAI_BASE_URL` | 可选，如 `https://api.openai.com/v1` 或自建兼容网关 |
| `OPENAI_MODEL` | 可选，默认 `gpt-4o-mini` |
| `DATABASE_URL` | PostgreSQL 连接串（SQLAlchemy），见 `.env.example` |
| `MD_DOCS_ROOT` | 可选，Markdown 文档根目录；不填则使用 `backend/docs_md` |
| `LANGSMITH_TRACING` | 可选，设为 `true` 时向 LangSmith 上报追踪（需配合 `LANGSMITH_API_KEY`） |
| `LANGSMITH_API_KEY` | 可选，LangSmith API Key |
| `LANGSMITH_PROJECT` | 可选，追踪所属项目名（默认 `default`） |
| `LANGSMITH_WORKSPACE_ID` | 可选，多 workspace 时指定工作区 |

未配置 `OPENAI_API_KEY` 时，依赖该密钥的接口会返回 503 与明确错误信息。
