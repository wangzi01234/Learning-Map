import logging
from typing import Any

from fastapi import HTTPException

from app.services.llm_json import parse_llm_json_object
from app.schemas.graph import (
    ExtendResponse,
    NewEdge,
    NewNode,
    NewTodo,
    NodeDetails,
)

logger = logging.getLogger(__name__)


def parse_extend_response(raw: str) -> ExtendResponse:
    data = parse_llm_json_object(raw)

    try:
        new_nodes_raw = data.get("newNodes") or []
        new_edges_raw = data.get("newEdges") or []
        new_todos_raw = data.get("newTodos") or []

        seen: set[str] = set()
        new_nodes: list[NewNode] = []
        for item in new_nodes_raw:
            if not isinstance(item, dict):
                continue
            nid = str(item.get("id", "")).strip()
            if not nid or nid in seen:
                continue
            seen.add(nid)
            details = item.get("details") or {}
            if not isinstance(details, dict):
                details = {}
            new_nodes.append(
                NewNode(
                    id=nid,
                    name=str(item.get("name", nid)),
                    year=int(item.get("year") or 0),
                    category=str(item.get("category", "")),
                    description=str(item.get("description", "")),
                    details=NodeDetails(
                        explanation=str(details.get("explanation", "")),
                        formula=details.get("formula"),
                        animation=details.get("animation"),
                        images=list(details.get("images") or []),
                        code=details.get("code"),
                        links=list(details.get("links") or []),
                    ),
                )
            )

        new_edges: list[NewEdge] = []
        for item in new_edges_raw:
            if not isinstance(item, dict):
                continue
            new_edges.append(
                NewEdge(
                    source=str(item.get("source", "")),
                    target=str(item.get("target", "")),
                    relation=str(item.get("relation", "")),
                    label=item.get("label"),
                )
            )

        new_todos: list[NewTodo] = []
        for item in new_todos_raw:
            if not isinstance(item, dict):
                continue
            new_todos.append(
                NewTodo(
                    title=str(item.get("title", "")),
                    description=item.get("description"),
                    relatedNodeId=item.get("relatedNodeId"),
                )
            )

        return ExtendResponse(newNodes=new_nodes, newEdges=new_edges, newTodos=new_todos)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Parse extend response failed")
        raise HTTPException(status_code=502, detail=f"解析模型结果失败：{e!s}") from e
