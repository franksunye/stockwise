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
        f"\"signal\":\"Watch\","
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
        self.assertEqual(result.signal.value, "Watch")
        self.assertEqual(diag.stage, "strict")
        self.assertFalse(diag.used_dirtyjson)

    def test_curly_quotes_and_fullwidth_should_parse_after_normalization(self):
        content = (
            "```json\n"
            "{\n"
            "  “signal”: “RiskOff”，\n"
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
        self.assertEqual(result.signal.value, "RiskOff")
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

    def test_missing_tactic_reason_should_still_parse(self):
        content = (
            "{"
            "\"signal\":\"NoSetup\","
            "\"confidence\":0.42,"
            "\"summary\":\"观望\","
            "\"reasoning_trace\":[],"
            "\"news_analysis\":[],"
            "\"tactics\":{"
            "\"holding_profit\":[{\"priority\":\"P1\",\"action\":\"观察\",\"trigger\":\"不破位\",\"target_price\":80}],"
            "\"holding_loss\":[{\"priority\":\"P1\",\"action\":\"止损\",\"trigger\":\"跌破纪律位\",\"stop_loss_price\":75.5}],"
            "\"empty\":[{\"priority\":\"P1\",\"action\":\"等待\",\"trigger\":\"确认后再看\",\"buy_zone_price\":74.0}]"
            "},"
            "\"key_levels\":{\"immediate_support\":[74,72],\"immediate_resistance\":[79,82]}"
            "}"
        )
        result = parse_ai_response(content)
        self.assertEqual(result.signal.value, "NoSetup")
        self.assertEqual(result.tactics.holding_profit[0].reason, "")
        self.assertEqual(result.tactics.holding_loss[0].reason, "")

    def test_missing_reasoning_trace_conclusion_should_still_parse(self):
        content = (
            "{"
            "\"signal\":\"Watch\","
            "\"confidence\":0.61,"
            "\"summary\":\"震荡\","
            "\"reasoning_trace\":[{\"step\":\"趋势\",\"data\":\"区间震荡\"}],"
            "\"news_analysis\":[],"
            "\"tactics\":{\"holding_profit\":[],\"holding_loss\":[],\"empty\":[]},"
            "\"key_levels\":{\"immediate_support\":[10,9.6],\"immediate_resistance\":[10.8,11.2]}"
            "}"
        )
        result = parse_ai_response(content)
        self.assertEqual(result.signal.value, "Watch")
        self.assertEqual(result.reasoning_trace[0].conclusion, "")

    def test_missing_tactic_trigger_should_still_parse(self):
        content = (
            "{"
            "\"signal\":\"Watch\","
            "\"confidence\":0.55,"
            "\"summary\":\"等待\","
            "\"reasoning_trace\":[],"
            "\"news_analysis\":[],"
            "\"tactics\":{"
            "\"holding_profit\":[{\"priority\":\"P1\",\"action\":\"观察\",\"reason\":\"趋势未坏\"}],"
            "\"holding_loss\":[{\"priority\":\"P1\",\"action\":\"止损\",\"reason\":\"先控回撤\"}],"
            "\"empty\":[{\"priority\":\"P1\",\"action\":\"等待\",\"reason\":\"等确认\"}]"
            "},"
            "\"key_levels\":{\"immediate_support\":[10,9.6],\"immediate_resistance\":[10.8,11.2]}"
            "}"
        )
        result = parse_ai_response(content)
        self.assertEqual(result.signal.value, "Watch")
        self.assertEqual(result.tactics.holding_profit[0].trigger, "")


if __name__ == "__main__":
    unittest.main()
