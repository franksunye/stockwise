import unittest

from backend.sync.hk_short import _parse_hkex_daily_report


class TestHKShortParser(unittest.TestCase):
    def test_parse_variable_width_codes_and_column_order(self):
        sample = """
        Short Selling Turnover (Main Board) up to day close today
        SHORTSELL REPORT   TRADING DATE : 03 MAR 2026 (TUESDAY)

                                           Turnover
          CODE   NAME OF STOCK               (SH)            ($)

              1  CKH HOLDINGS           2,496,500    156,458,850
            700  TENCENT                5,563,300  2,718,274,440
           8030  FENGYINHE                  2,000         12,980
        """

        trade_date, df = _parse_hkex_daily_report(sample, "MAIN")
        self.assertEqual(trade_date, "2026-03-03")
        self.assertEqual(len(df), 3)

        row_00001 = df[df["symbol"] == "00001"].iloc[0]
        self.assertEqual(float(row_00001["short_volume"]), 2496500.0)
        self.assertEqual(float(row_00001["short_turnover"]), 156458850.0)

        row_00700 = df[df["symbol"] == "00700"].iloc[0]
        self.assertEqual(float(row_00700["short_volume"]), 5563300.0)
        self.assertEqual(float(row_00700["short_turnover"]), 2718274440.0)


if __name__ == "__main__":
    unittest.main()
