"""MD 辅助：供模型按需读取库内其他文档（当前文档正文已由前端传入，不从磁盘重复读取）。"""

import logging
from pathlib import Path

from fastapi import HTTPException
from langchain_core.tools import tool

from app.services.md_doc_paths import ensure_inside_md_root

logger = logging.getLogger(__name__)

# 避免单次工具返回过大拖垮上下文
_MAX_CHARS = 240_000

_READ_REFERENCE_MARKDOWN_DESCRIPTION = (
    "读取学习笔记库中「另一篇」Markdown 文档的完整正文，仅作参考（对齐术语、引用段落、合并结构、对照大纲等）。\n"
    "何时调用：用户明确提到其他文件名/路径，或需要从库内其它 .md 取内容时再调用；可多次调用不同路径。\n"
    "何时不要调用：user 消息 JSON 里 filePath 所指的当前文档——其全文已在 currentMarkdown 中，禁止为本路径调用；"
    "也不要在仅需编辑/润色 currentMarkdown、且未涉及其它文件时调用。\n"
    "参数 relative_path：相对文档库根的路径，使用正斜杠，例如 notes/chapter2.md 或 新文档-1775718239382.md。\n"
    "返回：该文件的 UTF-8 全文；若文件过大可能被截断，末尾会有说明；若路径非法或文件不存在，返回错误说明字符串。"
)


def build_md_assist_tools(*, root: Path, current_doc_rel: str) -> list:
    current_norm = current_doc_rel.strip().replace("\\", "/")

    @tool("read_reference_markdown", description=_READ_REFERENCE_MARKDOWN_DESCRIPTION)
    def read_reference_markdown(relative_path: str) -> str:
        """从文档库读取指定 .md 文件的 UTF-8 全文（实现细节见工具 description）。"""
        rel = (relative_path or "").strip().replace("\\", "/")
        if not rel:
            return "错误：relative_path 不能为空。"
        if rel == current_norm:
            return (
                "这是当前正在编辑的文档，正文已在 user 消息 JSON 的 currentMarkdown 中，"
                "请勿重复读取；请直接基于 currentMarkdown 作答。"
            )
        try:
            fp = ensure_inside_md_root(root, rel)
        except HTTPException as e:
            return f"无法访问该路径：{e.detail}"
        except Exception as e:
            logger.warning("read_reference_markdown path rejected: %s", e)
            return f"无法访问该路径：{e!s}"
        if not root.is_dir():
            return "文档库目录不存在或未就绪。"
        if not fp.is_file():
            return f"文件不存在：{rel}"
        try:
            text = fp.read_text(encoding="utf-8")
        except OSError as e:
            return f"读取失败：{e!s}"
        if len(text) > _MAX_CHARS:
            head = text[:_MAX_CHARS]
            return (
                f"{head}\n\n---\n（已截断：文件超过 {_MAX_CHARS} 字符，仅返回前 {_MAX_CHARS} 字符。）"
            )
        return text

    return [read_reference_markdown]
