---
name: pre-commit-git-check
description: >-
  Runs a repository hygiene checklist before git commit or push — API keys and tokens,
  .gitignore coverage, build artifacts, temporary or test junk files, and Cursor-local
  paths. Use when the user prepares to commit or push, asks for a pre-commit check,
  security sweep of the working tree, or “提交前检查”.
---

# Git 提交前检查（Learning-Map）

在用户即将 `git commit` / `git push` 或明确要求「提交前检查」时，按下列顺序执行；**用工具自行扫描**，不要只给出口头建议。

## 1. 密钥与 Token

- 在仓库内检索常见泄露形态（示例模式，按需调整）：`sk-[a-zA-Z0-9]{10,}`、`ghp_[A-Za-z0-9_]+`、`AIza[0-9A-Za-z_-]{30,}`、`BEGIN PRIVATE KEY`、裸 `Bearer` 后接长串。
- 确认 **`.env` 未被跟踪**：`git ls-files` / `git check-ignore -v`；真实密钥只放在本地 `.env`（已在 `.gitignore`）。
- **`.env.example`** 仅允许占位符；若发现疑似真实 Key、生产库密码，必须提醒轮换并改示例文案。
- 代码中的 `api_key` 字段名、环境变量名不算泄露；重点是有无**字面量**赋值。

## 2. `.gitignore` 与误提交

- 对照 `.gitignore`：**`__pycache__`/`*.pyc`、`frontend/dist/`、`node_modules/`、`*.tsbuildinfo`、`backend/docs_md/`** 等不应出现在 `git ls-files` 中。
- 确认未对忽略路径使用 `git add -f` 除非用户明确需要。
- 本项目 **仅** `.cursor/skills/` 意图入库；`.cursor` 下其余路径应被忽略。

## 3. 临时文件与噪音

- 查找 `*.tmp`、`*.bak`、`*~`、错误命名的副本；`**/test_*.py`** 若为正式单测（如 `backend/tests/`）应**保留**，勿当垃圾删除。
- 根目录或 `tmp/`、`temp/` 中是否有人为遗留的一次性脚本（按用户意图决定是否删除）。

## 4. 输出给用户

用简洁中文汇总：

- **密钥**：有无风险、涉及哪些路径。
- **忽略规则**：是否会被误提交、有无建议补全的 glob（如 `*.pem`，按需）。
- **临时文件**：列出路径与处理建议（删 / 保留 / 加入 ignore）。
- 若一切正常，明确写「当前工作区未发现明显问题」。

## 5. 边界

- 不代替「历史提交」中的密钥审计；若用户怀疑曾提交过密钥，提醒 **轮换密钥** 并考虑 `git filter-repo` 等历史清理（本 skill 不展开操作除非用户要求）。
- 扫描范围以**当前仓库工作区**为主；用户主目录下 `.cursor/projects/` 等不在仓库内则无需写入报告。
