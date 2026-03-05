import os
import sys
import unittest


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.engine.parsers import (
    ParseError,
    ParseErrorCode,
    parse_ai_response,
    parse_ai_response_with_diagnostics,
)


def _base_json(summary="简要"):
    return (
        "{"
        f"\"signal\":\"Side\","
        f"\"confidence\":0.5,"
        f"\"summary\":\"{summary}\","
        "\"reasoning_trace\":[],"
        "\"news_analysis\":[],"
        "\"tactics\":{\"holding_profit\":[],\"holding_loss\":[],\"empty\":[]},"
        "\"key_levels\":{\"immediate_support\":[1.0,0.5],\"immediate_resistance\":[2.0,3.0]}"
        "}"
    )


class TestParsersFunnel(unittest.TestCase):
    def test_strict_json_should_parse(self):
        content = _base_json("strict")
        result, diag = parse_ai_response_with_diagnostics(content)
        self.assertEqual(result.signal.value, "Side")
        self.assertEqual(diag.stage, "strict")
        self.assertFalse(diag.used_dirtyjson)

    def test_curly_quotes_and_fullwidth_should_parse_after_normalization(self):
        content = (
            "```json\n"
            "{\n"
            "  “signal”: “Side”，\n"
            "  “confidence”: \"85%\"，\n"
            "  “summary”: “简明”，\n"
            "  \"reasoning_trace\": [],\n"
            "  \"news_analysis\": [],\n"
            "  \"tactics\": {\"holding_profit\":[],\"holding_loss\":[],\"empty\":[]},\n"
            "  \"key_levels\": {\"immediate_support\":[1.0,0.5],\"immediate_resistance\":[2.0,3.0]}\n"
            "}\n"
            "```"
        )
        result, diag = parse_ai_response_with_diagnostics(content)
        self.assertEqual(result.signal.value, "Side")
        self.assertAlmostEqual(result.confidence, 0.85)
        self.assertEqual(diag.stage, "normalized_strict")
        self.assertTrue(diag.normalized)

    def test_truncated_json_should_raise_parse_error_with_code(self):
        content = _base_json("truncated")
        # Cut tail to simulate LLM hard truncation.
        content = content[:-24]

        with self.assertRaises(ParseError) as ctx:
            parse_ai_response(content)

        self.assertEqual(ctx.exception.code, ParseErrorCode.TRUNCATED)
        self.assertIn("Invalid JSON syntax", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
