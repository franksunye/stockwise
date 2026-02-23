import re
import sys
import os
import unittest

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.backfill import _build_missing_predictions_query


class TestBackfillV2Query(unittest.TestCase):
    def test_query_without_model_filter_uses_v2(self):
        query, prefix_params = _build_missing_predictions_query(3, model_filter=None)

        self.assertIn("ai_predictions_v2", query)
        self.assertEqual(prefix_params, [])
        self.assertEqual(query.count("?"), 3)
        self.assertNotRegex(query, re.compile(r"\bai_predictions\b(?!_v2)"))

    def test_query_with_model_filter_uses_v2_and_model_dimension(self):
        query, prefix_params = _build_missing_predictions_query(2, model_filter="deepseek-v3")

        self.assertIn("ai_predictions_v2", query)
        self.assertIn("ap.model_id = ?", query)
        self.assertEqual(prefix_params, ["deepseek-v3"])
        self.assertEqual(query.count("?"), 3)  # 1 model + 2 symbols
        self.assertNotRegex(query, re.compile(r"\bai_predictions\b(?!_v2)"))


if __name__ == "__main__":
    unittest.main()
