import logging
import os
from typing import Optional

from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)


def normalize_openai_base_url(raw: Optional[str]) -> Optional[str]:
    """
    OPENAI_BASE_URL 填服务商给的 API 根路径即可（如 https://host/.../v3），
    不要在末尾写 /chat/completions。
    若误写成 .../chat/completions，此处会去掉末尾重复段。
    """
    if not raw or not str(raw).strip():
        return None
    u = str(raw).strip().rstrip("/")
    suffix = "/chat/completions"
    if u.lower().endswith(suffix):
        u = u[: -len(suffix)].rstrip("/")
    return u or None


def get_chat_llm(*, temperature: float) -> ChatOpenAI:
    settings = get_settings()
    api_key = (settings.openai_api_key or os.getenv("OPENAI_API_KEY", "")).strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="未配置 OPENAI_API_KEY，请在环境变量或 .env 中设置。",
        )
    base_url = normalize_openai_base_url(settings.openai_base_url or os.getenv("OPENAI_BASE_URL"))
    model = settings.openai_model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    return ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=temperature,
        model_kwargs={"response_format": {"type": "json_object"}},
    )


def invoke_json_object(llm: ChatOpenAI, *, system: str, user: str) -> str:
    try:
        msg = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
    except Exception as e:
        logger.exception("LangChain ChatOpenAI invoke failed")
        raise HTTPException(
            status_code=502,
            detail=(
                "调用语言模型失败，请检查网络、API Key、OPENAI_BASE_URL（勿重复写 /chat/completions）"
                f"与模型名称。详情：{e!s}"
            ),
        ) from e
    raw = msg.content
    if isinstance(raw, list):
        raw = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part) for part in raw
        )
    if not raw or not str(raw).strip():
        raise HTTPException(status_code=502, detail="模型返回为空。")
    return str(raw).strip()
