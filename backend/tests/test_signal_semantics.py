import os
import sys
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.engine.signal_semantics import (
    canonical_signal_from_layer1,
    is_legacy_signal_inertia,
    normalize_signal_value,
    signal_to_cn_label,
    signal_weight,
    to_legacy_signal,
)


class TestSignalSemantics(unittest.TestCase):
    def test_normalize_canonical_and_legacy_values(self):
        self.assertEqual(normalize_signal_value("TriggeredLong"), "TriggeredLong")
        self.assertEqual(normalize_signal_value("riskoff"), "RiskOff")
        self.assertEqual(normalize_signal_value("SignalEnum.WATCH"), "Watch")
        self.assertEqual(normalize_signal_value("Long"), "Long")

    def test_legacy_projection(self):
        self.assertEqual(to_legacy_signal("TriggeredLong"), "Long")
        self.assertEqual(to_legacy_signal("Watch"), "Side")
        self.assertEqual(to_legacy_signal("RiskOff"), "Side")

    def test_canonical_signal_from_layer1(self):
        self.assertEqual(canonical_signal_from_layer1("TriggeredLong"), "TriggeredLong")
        self.assertEqual(canonical_signal_from_layer1("Watch"), "Watch")
        self.assertEqual(canonical_signal_from_layer1("unknown"), "NoSetup")

    def test_cn_label_and_weight(self):
        self.assertEqual(signal_to_cn_label("NoSetup"), "无机会")
        self.assertEqual(signal_weight("TriggeredLong"), 1)
        self.assertEqual(signal_weight("RiskOff"), -1)
        self.assertEqual(signal_weight("Watch"), 0)

    def test_legacy_signal_inertia_detection(self):
        self.assertTrue(is_legacy_signal_inertia("Side", "NoSetup"))
        self.assertTrue(is_legacy_signal_inertia("Side", "RiskOff"))
        self.assertTrue(is_legacy_signal_inertia("Long", "TriggeredLong"))
        self.assertFalse(is_legacy_signal_inertia("Watch", "Watch"))
        self.assertFalse(is_legacy_signal_inertia("NoSetup", "NoSetup"))


if __name__ == "__main__":
    unittest.main()
