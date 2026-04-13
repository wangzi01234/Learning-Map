import json
import logging
import os
from collections.abc import Callable, Iterator
from typing import Any, Optional

from fastapi import HTTPException
from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

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


def get_chat_llm(
    *,
    temperature: float,
    model: Optional[str] = None,
    model_provider: Optional[str] = None,
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    model_kwargs_extra: Optional[dict[str, Any]] = None,
    json_response: bool = True,
) -> BaseChatModel:
    """
    构造 Chat模型（init_chat_model）。未传的参数沿用服务端 .env / Settings。
    json_response=False用于需要工具调用等场景（与 response_format=json_object 互斥）。
    """
    settings = get_settings()
    api_key_eff = (api_key or "").strip() or (settings.openai_api_key or os.getenv("OPENAI_API_KEY", "")).strip()
    if not api_key_eff:
        raise HTTPException(
            status_code=503,
            detail="未配置 OPENAI_API_KEY，请在环境变量或 .env 中设置，或在请求中传入 llm.api_key。",
        )
    base_raw = (base_url or "").strip() or (settings.openai_base_url or os.getenv("OPENAI_BASE_URL") or "")
    base_url_eff = normalize_openai_base_url(base_raw) if base_raw else None
    model_eff = (model or "").strip() or (settings.openai_model or os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
    provider_eff = (model_provider or "").strip() or "openai"
    mk: dict[str, Any] = dict(model_kwargs_extra or {})
    if json_response:
        mk["response_format"] = {"type": "json_object"}
    kwargs: dict[str, Any] = {
        "model_provider": provider_eff,
        "temperature": temperature,
        "api_key": api_key_eff,
        "model_kwargs": mk,
    }
    if base_url_eff:
        kwargs["base_url"] = base_url_eff
    return init_chat_model(model_eff, **kwargs)


def message_chunk_text(chunk: BaseMessage) -> str:
    """从 stream 产生的消息块中提取可展示的文本增量。"""
    raw = getattr(chunk, "content", None)
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        return "".join(
            part.get("text", "") if isinstance(part, dict) else str(part) for part in raw
        )
    return str(raw or "")


def stream_llm_text(llm: BaseChatModel, *, system: str, user: str) -> Iterator[str]:
    """同步流式输出模型文本片段（拼接后应为完整 JSON 字符串）。"""
    try:
        for chunk in llm.stream([SystemMessage(content=system), HumanMessage(content=user)]):
            piece = message_chunk_text(chunk)
            if piece:
                yield piece
    except Exception as e:
        logger.exception("LangChain chat model stream failed")
        raise HTTPException(
            status_code=502,
            detail=(
                "调用语言模型失败，请检查网络、API Key、OPENAI_BASE_URL（勿重复写 /chat/completions）"
                f"与模型名称。详情：{e!s}"
            ),
        ) from e


def ndjson_llm_stream(
    llm: BaseChatModel,
    *,
    system: str,
    user: str,
    finalize: Callable[[str], dict[str, Any]],
) -> Iterator[str]:
    """
    以 NDJSON 行输出流：delta 行为文本增量，最后一行 type=done 带 payload；
    出错时输出一行 type=error 并结束。
    """
    full = ""
    try:
        for piece in stream_llm_text(llm, system=system, user=user):
            full += piece
            yield json.dumps({"type": "delta", "text": piece}, ensure_ascii=False) + "\n"
    except HTTPException as e:
        yield json.dumps({"type": "error", "detail": str(e.detail)}, ensure_ascii=False) + "\n"
        return
    except Exception as e:
        logger.exception("ndjson_llm_stream transport failed")
        yield json.dumps({"type": "error", "detail": str(e)}, ensure_ascii=False) + "\n"
        return

    if not full.strip():
        yield json.dumps({"type": "error", "detail": "模型返回为空。"}, ensure_ascii=False) + "\n"
        return

    try:
        payload = finalize(full)
    except HTTPException as e:
        yield json.dumps({"type": "error", "detail": str(e.detail)}, ensure_ascii=False) + "\n"
        return
    except Exception as e:
        logger.exception("ndjson_llm_stream finalize failed")
        yield json.dumps({"type": "error", "detail": str(e)}, ensure_ascii=False) + "\n"
        return

    yield json.dumps({"type": "done", "payload": payload}, ensure_ascii=False) + "\n"


def invoke_llm_json_text(llm: BaseChatModel, *, system: str, user: str) -> str:
    """非流式一次调用，返回完整文本（此处约定为 JSON 字符串）。"""
    try:
        msg = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
    except Exception as e:
        logger.exception("LangChain chat model invoke failed")
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
