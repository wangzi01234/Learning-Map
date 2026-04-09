import json
import logging
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.llm import get_chat_llm, invoke_json_object
from app.services.llm_json import parse_llm_json_object
from app.services.prompts import build_md_assist_system_prompt

logger = logging.getLogger(__name__)

router = APIRouter(tags=["md-docs"])


def _resolve_md_root() -> Path:
    settings = get_settings()
    raw = (settings.md_docs_root or "").strip()
    if raw:
        root = Path(raw).expanduser()
    else:
        # md_docs.py → routes → api → app → backend
        root = Path(__file__).resolve().parents[3] / "docs_md"
    try:
        root = root.resolve()
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"无法解析 MD_DOCS_ROOT：{e!s}") from e
    return root


def _ensure_inside(root: Path, rel: str) -> Path:
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


class MdFileItem(BaseModel):
    path: str
    title: str


class MdReadResponse(BaseModel):
    path: str
    content: str


class MdWriteBody(BaseModel):
    path: str = Field(..., description="相对根目录的路径，如 notes/chapter1.md")
    content: str


class MdAssistTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class MdAssistBody(BaseModel):
    path: str
    markdown: str
    instruction: str
    conversation: list[MdAssistTurn] = Field(default_factory=list)


class MdAssistResponse(BaseModel):
    reply: str
    applyMarkdown: Optional[str] = None


@router.get("/api/md/files", response_model=list[MdFileItem])
def list_md_files() -> list[MdFileItem]:
    root = _resolve_md_root()
    if not root.is_dir():
        raise HTTPException(
            status_code=503,
            detail=f"MD 文档目录不存在：{root}。请在 backend/.env 设置 MD_DOCS_ROOT 或创建该目录。",
        )
    items: list[MdFileItem] = []
    for p in sorted(root.rglob("*.md")):
        rel = p.relative_to(root)
        rel_s = rel.as_posix()
        try:
            text = p.read_text(encoding="utf-8")
        except OSError as e:
            logger.warning("skip unreadable md %s: %s", p, e)
            continue
        title = rel_s
        for line in text.splitlines():
            s = line.strip()
            if s.startswith("#"):
                title = s.lstrip("#").strip() or title
                break
        items.append(MdFileItem(path=rel_s, title=title))
    return items


@router.get("/api/md/doc", response_model=MdReadResponse)
def read_md_doc(path: str) -> MdReadResponse:
    root = _resolve_md_root()
    if not root.is_dir():
        raise HTTPException(status_code=503, detail="MD 文档目录未就绪。")
    fp = _ensure_inside(root, path)
    if not fp.is_file():
        raise HTTPException(status_code=404, detail="文件不存在。")
    try:
        content = fp.read_text(encoding="utf-8")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"读取失败：{e!s}") from e
    return MdReadResponse(path=path.strip().replace("\\", "/"), content=content)


@router.put("/api/md/doc", response_model=MdReadResponse)
def write_md_doc(body: MdWriteBody) -> MdReadResponse:
    root = _resolve_md_root()
    root.mkdir(parents=True, exist_ok=True)
    fp = _ensure_inside(root, body.path)
    try:
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(body.content, encoding="utf-8", newline="\n")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"写入失败：{e!s}") from e
    return MdReadResponse(path=body.path.strip().replace("\\", "/"), content=body.content)


@router.post("/api/md/assist", response_model=MdAssistResponse)
def md_assist(body: MdAssistBody) -> MdAssistResponse:
    instruction = (body.instruction or "").strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="instruction 不能为空。")
    root = _resolve_md_root()
    _ensure_inside(root, body.path)

    try:
        llm = get_chat_llm(temperature=0.3)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("LangChain init failed")
        raise HTTPException(status_code=500, detail=f"初始化语言模型失败：{e!s}") from e

    system = build_md_assist_system_prompt()
    conv = list(body.conversation or [])
    if len(conv) > 48:
        conv = conv[-48:]
    user_payload = json.dumps(
        {
            "filePath": body.path.strip().replace("\\", "/"),
            "instruction": instruction,
            "currentMarkdown": body.markdown or "",
            "priorConversation": [t.model_dump() for t in conv],
        },
        ensure_ascii=False,
    )
    try:
        raw = invoke_json_object(llm, system=system, user=user_payload)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("md-assist invoke failed")
        raise HTTPException(status_code=502, detail=f"调用语言模型失败：{e!s}") from e

    data = parse_llm_json_object(raw)

    reply = str(data.get("reply", "")).strip() or "（无回复）"
    apply_raw = data.get("applyMarkdown")
    if apply_raw is None:
        apply_raw = data.get("apply_markdown")
    apply_markdown: Optional[str]
    if apply_raw is None or (isinstance(apply_raw, str) and not apply_raw.strip()):
        apply_markdown = None
    else:
        apply_markdown = str(apply_raw).strip()

    return MdAssistResponse(reply=reply, applyMarkdown=apply_markdown)
