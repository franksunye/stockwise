import os
import sys
import unittest
from unittest.mock import patch


project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
backend_path = os.path.join(project_root, "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)

from backend.engine import ai_service


class TestAiServiceGuardrailModes(unittest.TestCase):
    def test_warn_mode_keeps_directional_signal(self):
        ai_result = {"signal": "Long", "confidence": 0.60, "summary": "test"}
        with patch.dict(os.environ, {"AI_CIRCUIT_MODE": "warn", "AI_DIRECTIONAL_CONFIDENCE_THRESHOLD": "0.75"}, clear=False):
            out = ai_service._apply_directional_guardrail(dict(ai_result), "600519")
        self.assertEqual(out["signal"], "Long")
        self.assertEqual(out["confidence"], 0.60)

    def test_force_side_mode_downgrades_low_confidence_directional_signal(self):
        ai_result = {"signal": "Short", "confidence": 0.60, "summary": "test"}
        with patch.dict(os.environ, {"AI_CIRCUIT_MODE": "force_side", "AI_DIRECTIONAL_CONFIDENCE_THRESHOLD": "0.75"}, clear=False):
            out = ai_service._apply_directional_guardrail(dict(ai_result), "600519")
        self.assertEqual(out["signal"], "Side")
        self.assertEqual(out["confidence"], 0.5)
        self.assertIn("系统风控", out.get("summary", ""))

    def test_off_mode_bypasses_guardrail(self):
        ai_result = {"signal": "Short", "confidence": 0.20, "summary": "test"}
        with patch.dict(os.environ, {"AI_CIRCUIT_MODE": "off", "AI_DIRECTIONAL_CONFIDENCE_THRESHOLD": "0.75"}, clear=False):
            out = ai_service._apply_directional_guardrail(dict(ai_result), "600519")
        self.assertEqual(out["signal"], "Short")
        self.assertEqual(out["confidence"], 0.20)


if __name__ == "__main__":
    unittest.main()
