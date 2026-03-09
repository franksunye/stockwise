import unittest

from backend.engine.runner import select_primary_prediction


class PrimarySelectionTest(unittest.TestCase):
    def test_prefers_high_confidence_model_over_higher_priority_low_confidence(self):
        predictions = [
            {"model_id": "deepseek-v3", "confidence": 0.44},
            {"model_id": "rule-engine", "confidence": 0.88},
        ]
        model_priorities = {"deepseek-v3": 100, "rule-engine": 50}
        selected = select_primary_prediction(
            predictions,
            model_priorities,
            existing_primary_model_id=None,
            existing_priority=-1,
            primary_promotion_blocked=False,
            confidence_threshold=0.6,
        )
        self.assertEqual(selected, "rule-engine")

    def test_falls_back_to_highest_priority_when_none_meet_threshold(self):
        predictions = [
            {"model_id": "deepseek-v3", "confidence": 0.44},
            {"model_id": "hunyuan-lite", "confidence": 0.50},
        ]
        model_priorities = {"deepseek-v3": 100, "hunyuan-lite": 85}
        selected = select_primary_prediction(
            predictions,
            model_priorities,
            existing_primary_model_id=None,
            existing_priority=-1,
            primary_promotion_blocked=False,
            confidence_threshold=0.6,
        )
        self.assertEqual(selected, "deepseek-v3")

    def test_returns_none_when_promotion_blocked(self):
        predictions = [{"model_id": "rule-engine", "confidence": 0.88}]
        model_priorities = {"rule-engine": 50}
        selected = select_primary_prediction(
            predictions,
            model_priorities,
            existing_primary_model_id=None,
            existing_priority=-1,
            primary_promotion_blocked=True,
            confidence_threshold=0.6,
        )
        self.assertIsNone(selected)


if __name__ == "__main__":
    unittest.main()
