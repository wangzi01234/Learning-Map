import json
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models import GraphSnapshot, LearningCase
from app.schemas.graph import GraphSnapshotOut
from app.services.extend_parse import parse_full_graph_from_llm
from app.services.llm import get_chat_llm, invoke_llm_json_text
from app.services.llm_json import parse_llm_json_object
from app.services.md_doc_paths import ensure_inside_md_root, resolve_md_docs_root
from app.services.prompts import build_map_to_md_system_prompt, build_md_to_map_system_prompt

logger = logging.getLogger(__name__)

router = APIRouter(tags=["convert"])


def _iso(dt: datetime | None) -> str:
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


class MdToMapBody(BaseModel):
    case_slug: str
    markdown: str
    snapshot_name: str | None = None


class MapToMdBody(BaseModel):
    case_slug: str
    nodes: list[dict[str, object]] = Field(default_factory=list)
    edges: list[dict[str, object]] = Field(default_factory=list)
    todos: list[dict[str, object]] = Field(default_factory=list)
    path: str | None = None


class MapToMdOut(BaseModel):
    path: str
    content: str


@router.post("/api/convert/md-to-map", response_model=GraphSnapshotOut)
def convert_md_to_map(body: MdToMapBody, db: Session = Depends(get_db)) -> GraphSnapshotOut:
    case = db.execute(
        select(LearningCase).where(LearningCase.slug == body.case_slug)
    ).scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail=f"未找到学习案例：{body.case_slug}")

    markdown = (body.markdown or "").strip()
    if not markdown:
        raise HTTPException(status_code=400, detail="markdown 不能为空。")

    try:
        llm = get_chat_llm(temperature=0.35)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("LangChain init failed")
        raise HTTPException(status_code=500, detail=f"初始化语言模型失败：{e!s}") from e

    system = build_md_to_map_system_prompt(case)
    user_content = json.dumps({"markdown": markdown}, ensure_ascii=False)

    try:
        raw = invoke_llm_json_text(llm, system=system, user=user_content)
        nodes, edges, todos = parse_full_graph_from_llm(raw)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("md-to-map LLM failed")
        raise HTTPException(status_code=502, detail=f"转换失败：{e!s}") from e

    name = (body.snapshot_name or "").strip()
    if not name:
        name = f"从 MD 转换 · {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC"

    row = GraphSnapshot(
        case_id=case.id,
        name=name,
        nodes_json=nodes,
        edges_json=edges,
        todos_json=todos,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return GraphSnapshotOut(
        id=str(row.id),
        case_slug=case.slug,
        name=row.name,
        nodes=row.nodes_json,
        edges=row.edges_json,
        todos=row.todos_json,
        created_at=_iso(row.created_at),
        updated_at=_iso(row.updated_at),
    )


@router.post("/api/convert/map-to-md", response_model=MapToMdOut)
def convert_map_to_md(body: MapToMdBody, db: Session = Depends(get_db)) -> MapToMdOut:
    case = db.execute(
        select(LearningCase).where(LearningCase.slug == body.case_slug)
    ).scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail=f"未找到学习案例：{body.case_slug}")

    if not body.nodes:
        raise HTTPException(status_code=400, detail="nodes 不能为空，请先构建或加载图谱。")

    try:
        llm = get_chat_llm(temperature=0.35)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("LangChain init failed")
        raise HTTPException(status_code=500, detail=f"初始化语言模型失败：{e!s}") from e

    system = build_map_to_md_system_prompt(case)
    user_content = json.dumps(
        {
            "nodes": body.nodes,
            "edges": body.edges,
            "todos": body.todos,
        },
        ensure_ascii=False,
    )

    try:
        raw = invoke_llm_json_text(llm, system=system, user=user_content)
        data = parse_llm_json_object(raw)
        md = str(data.get("markdown", "")).strip()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("map-to-md LLM failed")
        raise HTTPException(status_code=502, detail=f"转换失败：{e!s}") from e

    if not md:
        raise HTTPException(status_code=502, detail="模型未返回 markdown 正文。")

    root = resolve_md_docs_root()
    root.mkdir(parents=True, exist_ok=True)

    rel = (body.path or "").strip().replace("\\", "/")
    if not rel:
        rel = f"图谱笔记-{int(time.time() * 1000)}.md"
    fp = ensure_inside_md_root(root, rel)
    try:
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(md, encoding="utf-8", newline="\n")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"写入失败：{e!s}") from e

    return MapToMdOut(path=rel, content=md)
