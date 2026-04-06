import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "backend"))

from utils import get_market
from trading_calendar import get_market_from_symbol


class TestMarketDetectionUS(unittest.TestCase):
    def test_utils_get_market_fallback(self):
        self.assertEqual(get_market("00700"), "HK")
        self.assertEqual(get_market("600519"), "CN")
        self.assertEqual(get_market("sh000001"), "CN")
        self.assertEqual(get_market("AAPL"), "US")
        self.assertEqual(get_market("BRK-B"), "US")

    def test_calendar_get_market_from_symbol(self):
        self.assertEqual(get_market_from_symbol("00700"), "HK")
        self.assertEqual(get_market_from_symbol("300750"), "CN")
        self.assertEqual(get_market_from_symbol("sz399001"), "CN")
        self.assertEqual(get_market_from_symbol("MSFT"), "US")


if __name__ == "__main__":
    unittest.main()
