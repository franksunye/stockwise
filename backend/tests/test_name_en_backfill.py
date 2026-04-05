"""Unit tests for Yahoo/Tushare ticker mapping and Yahoo name pick (no network)."""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "backend"))

from name_en_backfill import pick_yahoo_name_en, symbol_to_yahoo_ticker


class TestSymbolToYahoo(unittest.TestCase):
    def test_hk_normalizes_width(self):
        self.assertEqual(symbol_to_yahoo_ticker("00700", "HK"), "0700.HK")
        self.assertEqual(symbol_to_yahoo_ticker("09988", "HK"), "9988.HK")

    def test_cn_sse_sz_bj(self):
        self.assertEqual(symbol_to_yahoo_ticker("600519", "CN"), "600519.SS")
        self.assertEqual(symbol_to_yahoo_ticker("000001", "CN"), "000001.SZ")
        self.assertEqual(symbol_to_yahoo_ticker("300750", "CN"), "300750.SZ")
        self.assertEqual(symbol_to_yahoo_ticker("920000", "CN"), "920000.BJ")
        self.assertEqual(symbol_to_yahoo_ticker("430047", "CN"), "430047.BJ")

    def test_invalid(self):
        self.assertIsNone(symbol_to_yahoo_ticker("", "HK"))
        self.assertIsNone(symbol_to_yahoo_ticker("abc", "CN"))


class TestPickYahooNameEn(unittest.TestCase):
    def test_prefers_long_then_short(self):
        cn = "贵州茅台"
        self.assertEqual(
            pick_yahoo_name_en(
                cn,
                {"longName": "Kweichow Moutai Co., Ltd.", "shortName": "KWEICHOW MOUTAI"},
            ),
            "Kweichow Moutai Co., Ltd.",
        )

    def test_rejects_cjk(self):
        self.assertIsNone(pick_yahoo_name_en("测试", {"longName": "中文全称股份有限公司"}))


if __name__ == "__main__":
    unittest.main()
