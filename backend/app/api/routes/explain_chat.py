import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models import LearningCase
from app.schemas.graph import ExplainChatRequest, ExplainChatResponse
from app.services.llm import get_chat_llm, invoke_json_object
from app.services.llm_json import parse_llm_json_object
from app.services.prompts import build_explain_chat_system_prompt

logger = logging.getLogger(__name__)

router = APIRouter(tags=["explain-chat"])


def _build_explain_chat_user_payload(body: ExplainChatRequest) -> str:
    return json.dumps(
        {
            "nodeId": body.nodeId,
            "nodeName": body.nodeName,
            "currentExplanationMarkdown": body.currentExplanation or "",
            "conversation": [{"role": m.role, "content": m.content} for m in body.messages],
        },
        ensure_ascii=False,
    )


@router.post("/api/explain-chat", response_model=ExplainChatResponse)
def explain_chat(body: ExplainChatRequest, db: Session = Depends(get_db)) -> ExplainChatResponse:
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages 不能为空。")
    last = body.messages[-1]
    if last.role != "user":
        raise HTTPException(status_code=400, detail="最后一条消息必须是 user。")

    case = db.execute(
        select(LearningCase).where(LearningCase.slug == body.case_slug)
    ).scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail=f"未找到学习案例：{body.case_slug}")

    try:
        llm = get_chat_llm(temperature=0.35)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("LangChain init failed")
        raise HTTPException(status_code=500, detail=f"初始化语言模型失败：{e!s}") from e

    system = build_explain_chat_system_prompt(case)
    user_payload = _build_explain_chat_user_payload(body)

    try:
        raw = invoke_json_object(llm, system=system, user=user_payload)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("explain-chat invoke failed")
        raise HTTPException(status_code=502, detail=f"调用语言模型失败：{e!s}") from e

    data = parse_llm_json_object(raw)

    reply = str(data.get("reply", "")).strip() or "（无回复）"
    apply_raw = data.get("applyExplanation")
    apply_explanation: Optional[str]
    if apply_raw is None or (isinstance(apply_raw, str) and not apply_raw.strip()):
        apply_explanation = None
    else:
        apply_explanation = str(apply_raw).strip()

    return ExplainChatResponse(reply=reply, applyExplanation=apply_explanation)
