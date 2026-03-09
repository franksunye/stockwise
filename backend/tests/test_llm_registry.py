import os
import sys
import unittest


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.engine.llm_registry import LLMRegistry


class TestLLMRegistry(unittest.TestCase):
    def test_active_models_exist_for_core_roles(self):
        for role in ["prediction", "brief_free", "brief_pro"]:
            with self.subTest(role=role):
                active_ids = LLMRegistry.get_active_model_ids(role)
                self.assertGreater(len(active_ids), 0)

    def test_model_info_contains_display_name(self):
        for role in ["prediction", "brief_free", "brief_pro"]:
            with self.subTest(role=role):
                info = LLMRegistry.get_model_info(role)
                self.assertTrue(info.get("display_name"))

    def test_get_client_returns_configured_client(self):
        for role in ["prediction", "brief_free", "brief_pro"]:
            with self.subTest(role=role):
                client = LLMRegistry.get_client(role)
                self.assertTrue(getattr(client, "provider", None))
                self.assertTrue(getattr(client, "model", None))


if __name__ == "__main__":
    unittest.main()
