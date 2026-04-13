import json
import logging
from typing import Any, Literal, Optional, Union

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.llm import get_chat_llm
from app.services.llm_json import parse_llm_json_object
from app.services.md_assist_agent import ndjson_stream_from_full_text, run_md_assist_with_tools
from app.services.md_assist_tools import build_md_assist_tools
from app.services.md_doc_paths import ensure_inside_md_root, resolve_md_docs_root
from app.services.prompts import build_md_assist_system_prompt

logger = logging.getLogger(__name__)

router = APIRouter(tags=["md-docs"])


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


class MdAssistLlmOverrides(BaseModel):
    """覆盖 init_chat_model 相关参数；未填字段沿用服务端环境变量。"""

    model: Optional[str] = None
    model_provider: Optional[str] = None
    temperature: Optional[float] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_kwargs_extra: Optional[dict[str, Any]] = None


class MdAssistBody(BaseModel):
    path: str
    markdown: str
    instruction: str
    conversation: list[MdAssistTurn] = Field(default_factory=list)
    llm: Optional[MdAssistLlmOverrides] = None
    stream: bool = True


class MdAssistResponse(BaseModel):
    reply: str
    applyMarkdown: Optional[str] = None


@router.get("/api/md/files", response_model=list[MdFileItem])
def list_md_files() -> list[MdFileItem]:
    root = resolve_md_docs_root()
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
    root = resolve_md_docs_root()
    if not root.is_dir():
        raise HTTPException(status_code=503, detail="MD 文档目录未就绪。")
    fp = ensure_inside_md_root(root, path)
    if not fp.is_file():
        raise HTTPException(status_code=404, detail="文件不存在。")
    try:
        content = fp.read_text(encoding="utf-8")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"读取失败：{e!s}") from e
    return MdReadResponse(path=path.strip().replace("\\", "/"), content=content)


@router.put("/api/md/doc", response_model=MdReadResponse)
def write_md_doc(body: MdWriteBody) -> MdReadResponse:
    root = resolve_md_docs_root()
    root.mkdir(parents=True, exist_ok=True)
    fp = ensure_inside_md_root(root, body.path)
    try:
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(body.content, encoding="utf-8", newline="\n")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"写入失败：{e!s}") from e
    return MdReadResponse(path=body.path.strip().replace("\\", "/"), content=body.content)


@router.post("/api/md/assist", response_model=None)
def md_assist(body: MdAssistBody) -> Union[StreamingResponse, MdAssistResponse]:
    instruction = (body.instruction or "").strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="instruction 不能为空。")
    root = resolve_md_docs_root()
    ensure_inside_md_root(root, body.path)

    ov = body.llm
    temp = 0.3 if (ov is None or ov.temperature is None) else float(ov.temperature)
    try:
        llm = get_chat_llm(
            temperature=temp,
            model=ov.model if ov else None,
            model_provider=ov.model_provider if ov else None,
            base_url=ov.base_url if ov else None,
            api_key=ov.api_key if ov else None,
            model_kwargs_extra=ov.model_kwargs_extra if ov else None,
            json_response=False,
        )
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

    def finalize(raw: str) -> dict[str, Any]:
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
        return MdAssistResponse(reply=reply, applyMarkdown=apply_markdown).model_dump()

    tools = build_md_assist_tools(
        root=root,
        current_doc_rel=body.path.strip().replace("\\", "/"),
    )

    try:
        raw = run_md_assist_with_tools(
            llm=llm,
            tools=tools,
            system=system,
            user_payload=user_payload,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("md-assist tool run failed")
        raise HTTPException(status_code=502, detail=f"调用语言模型失败：{e!s}") from e

    if body.stream:
        gen = ndjson_stream_from_full_text(full=raw, finalize=finalize)
        return StreamingResponse(gen, media_type="application/x-ndjson; charset=utf-8")

    try:
        payload = finalize(raw)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("md-assist parse failed")
        raise HTTPException(status_code=502, detail=f"解析模型结果失败：{e!s}") from e
    return MdAssistResponse(**payload)
