import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models import LearningCase
from app.schemas.graph import ExtendRequest, ExtendResponse
from app.services.extend_parse import parse_extend_response
from app.services.llm import get_chat_llm, invoke_json_object
from app.services.prompts import build_extend_system_prompt

logger = logging.getLogger(__name__)

router = APIRouter(tags=["extend"])


@router.post("/api/extend", response_model=ExtendResponse)
def extend_graph(body: ExtendRequest, db: Session = Depends(get_db)) -> ExtendResponse:
    case = db.execute(
        select(LearningCase).where(LearningCase.slug == body.case_slug)
    ).scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail=f"未找到学习案例：{body.case_slug}")

    try:
        llm = get_chat_llm(temperature=0.4)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("LangChain init failed")
        raise HTTPException(status_code=500, detail=f"初始化语言模型失败：{e!s}") from e

    system = build_extend_system_prompt(case)
    ctx = body.context.model_dump()
    user_content = json.dumps(
        {
            "prompt": body.prompt,
            "existingNodes": ctx.get("existingNodes", []),
            "existingEdges": ctx.get("existingEdges", []),
        },
        ensure_ascii=False,
    )

    try:
        raw = invoke_json_object(llm, system=system, user=user_content)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("extend invoke failed")
        raise HTTPException(status_code=502, detail=f"调用语言模型失败：{e!s}") from e

    return parse_extend_response(raw)
