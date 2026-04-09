"""
解析 LLM 返回的 JSON 对象：兼容 ```json 围栏、前文说明、以及从首个 `{` 起的 raw_decode。
"""
from __future__ import annotations

import json
import re
from typing import Any

from fastapi import HTTPException


def _strip_code_fences(s: str) -> str:
    """去掉可选的 markdown 代码块围栏，保留内部正文。"""
    s = s.strip()
    m = re.search(r"```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```", s, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m2 = re.match(r"```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```\s*$", s, re.IGNORECASE)
    if m2:
        return m2.group(1).strip()
    return s


def _try_decode_object(s: str) -> dict[str, Any] | None:
    """尝试将字符串解析为 JSON object（含从首个 `{` 起 raw_decode，避免围栏外噪声）。"""
    s = s.strip()
    if not s:
        return None
    try:
        o = json.loads(s)
        if isinstance(o, dict):
            return o
    except json.JSONDecodeError:
        pass
    i = s.find("{")
    if i < 0:
        return None
    try:
        dec = json.JSONDecoder()
        o, _ = dec.raw_decode(s, i)
        if isinstance(o, dict):
            return o
    except json.JSONDecodeError:
        return None
    return None


def parse_llm_json_object(raw: str) -> dict[str, Any]:
    """
    将模型输出解析为 dict。失败时抛出 HTTP 502。
    """
    text = str(raw or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="模型返回为空。")

    candidates: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add(label: str, s: str) -> None:
        s = s.strip()
        if not s or s in seen:
            return
        seen.add(s)
        candidates.append((label, s))

    add("direct", text)
    fenced = _strip_code_fences(text)
    if fenced != text:
        add("strip_fence", fenced)
    fi = text.find("{")
    if fi >= 0:
        add("from_first_brace", text[fi:])
        ff = _strip_code_fences(text[fi:])
        if ff != text[fi:]:
            add("fence_on_tail", ff)

    last_err: str | None = None
    for _label, cand in candidates:
        got = _try_decode_object(cand)
        if got is not None:
            return got
        try:
            json.loads(cand)
        except json.JSONDecodeError as e:
            last_err = str(e)

    raise HTTPException(
        status_code=502,
        detail=f"模型返回非合法 JSON：{last_err or '无法解析为 JSON 对象'}",
    )
