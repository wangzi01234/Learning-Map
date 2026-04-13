"""MD 辅助：带工具调用的多轮对话，直至模型输出最终 JSON。"""

import json
import logging
from collections.abc import Callable, Iterator
from typing import Any

from fastapi import HTTPException
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool

from app.services.llm import message_chunk_text

logger = logging.getLogger(__name__)

_MAX_TOOL_ROUNDS = 10


def _tool_calls_list(ai: AIMessage) -> list[dict[str, Any]]:
    raw = getattr(ai, "tool_calls", None) or []
    out: list[dict[str, Any]] = []
    for tc in raw:
        if isinstance(tc, dict):
            out.append(tc)
        else:
            name = getattr(tc, "name", None) or ""
            tid = getattr(tc, "id", None) or ""
            args = getattr(tc, "args", None)
            if args is None and hasattr(tc, "get"):
                args = tc.get("args")
            out.append({"name": name, "args": args or {}, "id": tid})
    return out


def _normalize_args(args: Any) -> dict[str, Any]:
    if args is None:
        return {}
    if isinstance(args, dict):
        return args
    if isinstance(args, str):
        import json

        try:
            parsed = json.loads(args)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def run_md_assist_with_tools(
    *,
    llm: BaseChatModel,
    tools: list[BaseTool],
    system: str,
    user_payload: str,
) -> str:
    """
    绑定工具并循环调用，直到某次模型回复不再包含 tool_calls；
    最后一次回复的正文应为符合系统提示的 JSON 字符串。
    """
    if not tools:
        raise HTTPException(status_code=500, detail="未配置 MD 辅助工具。")
    bound = llm.bind_tools(tools)
    messages: list[BaseMessage] = [
        SystemMessage(content=system),
        HumanMessage(content=user_payload),
    ]
    tool_by_name = {t.name: t for t in tools}

    last_ai: AIMessage | None = None
    for round_i in range(_MAX_TOOL_ROUNDS):
        try:
            ai = bound.invoke(messages)
        except Exception as e:
            logger.exception("md assist tool loop invoke failed")
            raise HTTPException(
                status_code=502,
                detail=f"调用语言模型失败：{e!s}",
            ) from e
        if not isinstance(ai, AIMessage):
            raise HTTPException(status_code=502, detail="模型返回类型异常。")
        last_ai = ai
        messages.append(ai)
        calls = _tool_calls_list(ai)
        if not calls:
            break
        for tc in calls:
            name = str(tc.get("name") or "")
            tid = str(tc.get("id") or "") or f"call_{round_i}"
            args = _normalize_args(tc.get("args"))
            tool_fn = tool_by_name.get(name)
            if tool_fn is None:
                out = f"未知工具：{name}"
            else:
                try:
                    out = tool_fn.invoke(args)
                except Exception as e:
                    logger.warning("tool %s failed: %s", name, e)
                    out = f"工具执行失败：{e!s}"
            messages.append(ToolMessage(content=str(out), tool_call_id=tid))
    else:
        raise HTTPException(status_code=502, detail="工具调用轮次过多，请简化请求。")

    if last_ai is None:
        raise HTTPException(status_code=502, detail="模型无有效回复。")
    text = message_chunk_text(last_ai).strip()
    if not text:
        raise HTTPException(status_code=502, detail="模型返回为空。")
    return text


def ndjson_stream_from_full_text(
    *,
    full: str,
    finalize: Callable[[str], dict[str, Any]],
) -> Iterator[str]:
    """将已生成的完整 JSON 文本按块输出为 NDJSON 流（与 ndjson_llm_stream 前端协议一致）。"""
    chunk_size = 128
    try:
        for i in range(0, len(full), chunk_size):
            piece = full[i : i + chunk_size]
            yield json.dumps({"type": "delta", "text": piece}, ensure_ascii=False) + "\n"
        payload = finalize(full)
        yield json.dumps({"type": "done", "payload": payload}, ensure_ascii=False) + "\n"
    except HTTPException as e:
        yield json.dumps({"type": "error", "detail": str(e.detail)}, ensure_ascii=False) + "\n"
    except Exception as e:
        logger.exception("ndjson_stream_from_full_text failed")
        yield json.dumps({"type": "error", "detail": str(e)}, ensure_ascii=False) + "\n"
