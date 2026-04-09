"""单元测试：LLM 返回 JSON 的容错解析。"""
import unittest

from fastapi import HTTPException

from app.services.llm_json import parse_llm_json_object


class ParseLlmJsonObjectTests(unittest.TestCase):
    def test_plain_json_object(self) -> None:
        d = parse_llm_json_object('{"reply":"ok","applyMarkdown":null}')
        self.assertEqual(d["reply"], "ok")
        self.assertIsNone(d.get("applyMarkdown"))

    def test_json_markdown_fence(self) -> None:
        raw = '```json\n{"reply":"fence"}\n```'
        d = parse_llm_json_object(raw)
        self.assertEqual(d["reply"], "fence")

    def test_preamble_then_fence(self) -> None:
        raw = 'Sure, here is the output:\n```json\n{"reply":"pre"}\n```\n'
        d = parse_llm_json_object(raw)
        self.assertEqual(d["reply"], "pre")

    def test_leading_text_before_brace(self) -> None:
        raw = 'Note:\n{"reply":"brace","applyMarkdown":null}'
        d = parse_llm_json_object(raw)
        self.assertEqual(d["reply"], "brace")

    def test_invalid_raises_502(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            parse_llm_json_object("this is not json")
        self.assertEqual(ctx.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
