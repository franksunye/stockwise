import re
import sys
import os
import unittest
from unittest.mock import patch

# Add project root + backend path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
backend_path = os.path.join(project_root, 'backend')
if backend_path not in sys.path:
    sys.path.append(backend_path)

from backend.engine import ai_service


class _FakeCursor:
    def __init__(self):
        self.executed = []
        self._last_fetch = None

    def execute(self, sql, params=()):
        self.executed.append((sql, params))
        if "SELECT 1 FROM prediction_models" in sql:
            self._last_fetch = (1,)
        else:
            self._last_fetch = None
        return self

    def fetchone(self):
        return self._last_fetch

    def fetchall(self):
        return []


class _FakeConn:
    def __init__(self):
        self.cursor_obj = _FakeCursor()
        self.committed = False
        self.closed = False

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.committed = True

    def close(self):
        self.closed = True


class TestAiServiceV2Storage(unittest.TestCase):
    def test_process_and_store_prediction_writes_v2_only(self):
        fake_conn = _FakeConn()
        ai_result = {
            "signal": "Long",
            "confidence": 0.82,
            "key_levels": {"support": 12.3, "resistance": 13.2},
            "is_llm": False,
        }

        with patch.object(ai_service, "get_connection", return_value=fake_conn), \
             patch.object(ai_service, "get_next_trading_day_str", return_value="2026-02-24"):
            ai_service._process_and_store_prediction("600519", "2026-02-23", ai_result, model="rule-based")

        self.assertTrue(fake_conn.committed)
        self.assertTrue(fake_conn.closed)

        sql_text = "\n".join(sql for sql, _ in fake_conn.cursor_obj.executed)
        self.assertIn("ai_predictions_v2", sql_text)
        self.assertNotRegex(sql_text, re.compile(r"\bai_predictions\b(?!_v2)"))

        # Validate saved query uses normalized model_id 'rule-engine'.
        v2_calls = [
            params for sql, params in fake_conn.cursor_obj.executed
            if "INSERT OR REPLACE INTO ai_predictions_v2" in sql
        ]
        self.assertEqual(len(v2_calls), 1)
        self.assertEqual(v2_calls[0][2], "rule-engine")


if __name__ == "__main__":
    unittest.main()
