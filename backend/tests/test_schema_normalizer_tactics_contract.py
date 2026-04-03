import unittest

from backend.engine.schema_normalizer import normalize_ai_response


class TestSchemaNormalizerTacticsContract(unittest.TestCase):
    def test_missing_tactics_are_backfilled_to_two_per_scenario(self):
        data = {"signal": "Watch", "confidence": 0.5}
        out = normalize_ai_response(data)

        self.assertIn("tactics", out)
        for category in ["holding_profit", "holding_loss", "empty"]:
            self.assertEqual(len(out["tactics"][category]), 2, category)
            for item in out["tactics"][category]:
                self.assertIn("priority", item)
                self.assertIn("action", item)
                self.assertIn("trigger", item)
                self.assertIn("reason", item)
                self.assertIn("target_price", item)
                self.assertIn("stop_advance_price", item)
                self.assertIn("stop_loss_price", item)
                self.assertIn("buy_zone_price", item)

    def test_duplicate_and_priority_are_normalized(self):
        data = {
            "signal": "TriggeredLong",
            "confidence": 0.8,
            "tactics": {
                "holding_profit": [
                    {"priority": "P3", "action": "观察", "trigger": "不破位", "reason": "a"},
                    {"priority": "P1", "action": "观察", "trigger": "不破位", "reason": "b"},
                ],
                "holding_loss": [],
                "empty": [],
            },
        }
        out = normalize_ai_response(data)
        hp = out["tactics"]["holding_profit"]

        self.assertEqual(len(hp), 2)
        # After normalization: dedupe + fill + sort should place P1 first.
        self.assertEqual(hp[0]["priority"], "P1")
        self.assertNotEqual(
            (hp[0]["action"], hp[0]["trigger"]),
            (hp[1]["action"], hp[1]["trigger"]),
        )

    def test_buy_zone_range_and_target_price_semantics(self):
        data = {
            "signal": "Watch",
            "confidence": 0.6,
            "tactics": {
                "holding_profit": [
                    {
                        "priority": "P1",
                        "action": "持有",
                        "trigger": "不跌破",
                        "reason": "趋势",
                        "target_price": ["10.5", "11.2"],
                    },
                    {
                        "priority": "P2",
                        "action": "止盈",
                        "trigger": "接近压力",
                        "reason": "保护",
                    },
                ],
                "holding_loss": [
                    {
                        "priority": "P1",
                        "action": "止损",
                        "trigger": "破位",
                        "reason": "风控",
                        "stop_loss_price": "9.8",
                    },
                    {
                        "priority": "P2",
                        "action": "减仓",
                        "trigger": "反弹乏力",
                        "reason": "降风险",
                    },
                ],
                "empty": [
                    {
                        "priority": "P1",
                        "action": "等待",
                        "trigger": "回踩企稳",
                        "reason": "确认",
                        "buy_zone_price": [12.3, 11.9],
                    },
                    {
                        "priority": "P2",
                        "action": "跟随",
                        "trigger": "突破站稳",
                        "reason": "右侧",
                    },
                ],
            },
        }
        out = normalize_ai_response(data)

        self.assertEqual(out["tactics"]["holding_profit"][0]["target_price"], [10.5, 11.2])
        self.assertEqual(out["tactics"]["empty"][0]["buy_zone_price"], [11.9, 12.3])

    def test_key_levels_derive_second_level_and_meta(self):
        data = {
            "signal": "RiskOff",
            "confidence": 0.6,
            "key_levels": {
                "immediate_support": [100],
                "immediate_resistance": [110],
                "strong_support": [98, 99.5],
                "strong_resistance": [111, 113],
                "breakout_confirmation_level": 111.5,
            },
        }
        out = normalize_ai_response(data)
        kl = out["key_levels"]

        self.assertEqual(len(kl["immediate_support"]), 2)
        self.assertEqual(len(kl["immediate_resistance"]), 2)
        self.assertGreater(kl["immediate_support"][0], kl["immediate_support"][1])
        self.assertLess(kl["immediate_resistance"][0], kl["immediate_resistance"][1])
        self.assertEqual(out["key_levels_meta"]["immediate_support_source"], "derived")
        self.assertEqual(out["key_levels_meta"]["immediate_resistance_source"], "derived")

    def test_key_levels_fallback_when_no_candidates(self):
        data = {
            "signal": "NoSetup",
            "confidence": 0.4,
            "key_levels": {
                "immediate_support": [100],
                "immediate_resistance": [120],
            },
        }
        out = normalize_ai_response(data)
        kl = out["key_levels"]

        self.assertEqual(len(kl["immediate_support"]), 2)
        self.assertEqual(len(kl["immediate_resistance"]), 2)
        self.assertAlmostEqual(kl["immediate_support"][1], round(100 * 0.985, 4))
        self.assertAlmostEqual(kl["immediate_resistance"][1], round(120 * 1.015, 4))
        self.assertEqual(out["key_levels_meta"]["immediate_support_source"], "fallback")
        self.assertEqual(out["key_levels_meta"]["immediate_resistance_source"], "fallback")

    def test_canonical_signal_is_preserved(self):
        data = {"signal": "RiskOff", "confidence": 0.7}
        out = normalize_ai_response(data)
        self.assertEqual(out["signal"], "RiskOff")

    def test_en_locale_uses_english_default_tactics(self):
        data = {"signal": "Watch", "confidence": 0.5}
        out = normalize_ai_response(data, content_locale="en")
        hp = out["tactics"]["holding_profit"]
        self.assertIn("Price stays above support", hp[0]["trigger"])
        self.assertIn("maintain discipline", hp[0]["reason"])
        self.assertNotIn("不跌破", hp[0]["trigger"])

    def test_en_locale_remaps_chinese_boilerplate_tactics(self):
        data = {
            "signal": "RiskOff",
            "confidence": 0.5,
            "tactics": {
                "holding_profit": [
                    {
                        "priority": "P1",
                        "action": "持仓观察",
                        "trigger": "不跌破一防位",
                        "reason": "趋势未被破坏，先守纪律。",
                    },
                    {
                        "priority": "P2",
                        "action": "分批止盈预案",
                        "trigger": "接近一攻位且动能放缓",
                        "reason": "锁定波段利润，避免冲高回落。",
                    },
                ],
                "holding_loss": [],
                "empty": [],
            },
        }
        out = normalize_ai_response(data, content_locale="en")
        p1 = out["tactics"]["holding_profit"][0]
        self.assertEqual(p1["trigger"], "Price stays above support")
        self.assertEqual(p1["reason"], "Trend intact, maintain discipline.")


if __name__ == "__main__":
    unittest.main()
