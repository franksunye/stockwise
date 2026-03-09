import json
import os
import re
import sys
import unittest

import requests
import pytest


root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(root_dir)
sys.path.append(os.path.join(root_dir, "backend"))

from backend.engine.prompts import prepare_stock_analysis_prompt


pytestmark = pytest.mark.network


class TestParseManualNetwork(unittest.TestCase):
    @unittest.skipUnless(
        os.getenv("RUN_NETWORK_TESTS") == "1",
        "Manual network parse check. Set RUN_NETWORK_TESTS=1 to enable.",
    )
    def test_parse_remote_completion_response(self):
        system_prompt, user_prompt = prepare_stock_analysis_prompt("00700")

        api_key = os.getenv("LLM_API_KEY")
        self.assertTrue(api_key, "LLM_API_KEY is required for manual network parse check")

        base_url = os.getenv("LLM_BASE_URL", "http://127.0.0.1:8045/v1")
        model = os.getenv("TEST_PARSE_MODEL", "gpt-3.5-turbo")

        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": 4096,
                "temperature": 0.5,
            },
            timeout=120,
        )
        response.raise_for_status()
        result = response.json()
        content = result["choices"][0]["message"]["content"]

        parsed = None
        try:
            parsed = json.loads(content)
        except Exception:
            content_clean = re.sub(r"^```json\s*", "", content, flags=re.MULTILINE)
            content_clean = re.sub(r"^```\s*", "", content_clean, flags=re.MULTILINE)
            content_clean = re.sub(r"```$", "", content_clean, flags=re.MULTILINE)
            try:
                parsed = json.loads(content_clean)
            except Exception:
                balance = 0
                start = content.find("{")
                if start != -1:
                    for idx in range(start, len(content)):
                        if content[idx] == "{":
                            balance += 1
                        elif content[idx] == "}":
                            balance -= 1
                            if balance == 0:
                                parsed = json.loads(content[start : idx + 1])
                                break

        self.assertIsInstance(parsed, dict)
        self.assertIn("signal", parsed)
        self.assertIn("confidence", parsed)


if __name__ == "__main__":
    unittest.main()
