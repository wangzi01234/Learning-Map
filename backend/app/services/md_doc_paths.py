"""MD 文档库根路径解析与相对路径校验（供路由与 LLM 工具共用）。"""

from pathlib import Path

from fastapi import HTTPException

from app.config import get_settings


def resolve_md_docs_root() -> Path:
    settings = get_settings()
    raw = (settings.md_docs_root or "").strip()
    if raw:
        root = Path(raw).expanduser()
    else:
        # md_doc_paths.py → services → app → backend
        root = Path(__file__).resolve().parents[2] / "docs_md"
    try:
        root = root.resolve()
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"无法解析 MD_DOCS_ROOT：{e!s}") from e
    return root


def ensure_inside_md_root(root: Path, rel: str) -> Path:
    rel = rel.strip().replace("\\", "/")
    if not rel or rel.startswith("..") or "/../" in f"/{rel}/":
        raise HTTPException(status_code=400, detail="非法路径。")
    candidate = (root / rel).resolve()
    try:
        root_res = root.resolve()
    except OSError:
        root_res = root
    if not str(candidate).startswith(str(root_res)) or candidate.suffix.lower() != ".md":
        raise HTTPException(status_code=400, detail="仅允许访问根目录下的 .md 文件。")
    return candidate
