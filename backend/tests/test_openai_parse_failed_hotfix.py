import asyncio
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.engine.models.openai import OpenAIAdapter


class DummyTracker:
    def __init__(self):
        self._current_trace = SimpleNamespace(retry_count=0)

    def start_trace(self, **kwargs):
        return None

    def set_prompts(self, *args, **kwargs):
        return None

    def set_tokens(self, *args, **kwargs):
        return None

    def set_response(self, *args, **kwargs):
        return None

    def set_status(self, *args, **kwargs):
        return None

    def end_trace(self):
        return None


class TestOpenAIParseFailedHotfix(unittest.TestCase):
    def setUp(self):
        self._old_key = os.environ.get("DEEPSEEK_API_KEY")
        os.environ["DEEPSEEK_API_KEY"] = "unit-test-key"

    def tearDown(self):
        if self._old_key is None:
            os.environ.pop("DEEPSEEK_API_KEY", None)
        else:
            os.environ["DEEPSEEK_API_KEY"] = self._old_key

    def test_parse_failed_should_notify_admin_and_stop_retry(self):
        adapter = OpenAIAdapter("deepseek-v3", {"model": "deepseek-chat"})

        adapter.client.chat = MagicMock(
            return_value=(
                '{"signal":"Side","confidence":0.5,"summary":"x"}',
                {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
            )
        )
        adapter.client._parse_json_response = MagicMock(return_value=None)

        with patch("backend.engine.models.openai.get_tracker", return_value=DummyTracker()), \
             patch("backend.engine.prompts.prepare_stock_analysis_prompt", return_value=("sys", "user", "vtest")), \
             patch("backend.utils.send_wecom_notification") as notify_mock, \
             patch("backend.config.ADMIN_MOBILES", ["13800000000"]):
            result = asyncio.run(adapter.predict("00700", "2026-03-05", {"k": "v"}))

        self.assertIsNotNone(result)
        self.assertEqual(result.get("validation_status"), "Error")
        self.assertIn("JSON Parsing failed completely", result.get("reasoning", ""))

        # Key assertion: parse_failed path must stop retrying immediately.
        self.assertEqual(adapter.client.chat.call_count, 1)
        self.assertEqual(adapter.client._parse_json_response.call_count, 1)

        # Key assertion: admin notification is sent.
        notify_mock.assert_called_once()
        call_args, call_kwargs = notify_mock.call_args
        self.assertIn("LLM 解析失败告警", call_args[0])
        self.assertEqual(call_kwargs.get("mentioned_mobile_list"), ["13800000000"])


if __name__ == "__main__":
    unittest.main()
