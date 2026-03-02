import os
import sys
import unittest

import pandas as pd

# Add project root + backend path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
backend_path = os.path.join(project_root, "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)

from backend.sync.prices import _normalize_period_ohlcv, _is_period_interval_sane
from backend.engine.prompts import _aggregate_daily_to_period_bars, _is_period_history_sane


class TestPeriodNormalization(unittest.TestCase):
    def test_weekly_normalization_from_daily_rows(self):
        df = pd.DataFrame(
            [
                # Week 1
                {"date": "2026-02-09", "open": 10, "high": 11, "low": 9, "close": 10.2, "volume": 100, "change_percent": 1},
                {"date": "2026-02-10", "open": 10.3, "high": 11.2, "low": 10, "close": 10.8, "volume": 110, "change_percent": 2},
                {"date": "2026-02-11", "open": 10.7, "high": 11.4, "low": 10.6, "close": 11.0, "volume": 120, "change_percent": 1},
                {"date": "2026-02-12", "open": 10.9, "high": 11.1, "low": 10.5, "close": 10.7, "volume": 130, "change_percent": -2},
                {"date": "2026-02-13", "open": 10.8, "high": 11.3, "low": 10.7, "close": 11.2, "volume": 140, "change_percent": 5},
                # Week 2
                {"date": "2026-02-16", "open": 11.1, "high": 11.5, "low": 10.9, "close": 11.0, "volume": 150, "change_percent": -1},
                {"date": "2026-02-17", "open": 11.0, "high": 11.2, "low": 10.8, "close": 10.9, "volume": 160, "change_percent": -1},
                {"date": "2026-02-18", "open": 10.9, "high": 11.4, "low": 10.7, "close": 11.3, "volume": 170, "change_percent": 4},
                {"date": "2026-02-19", "open": 11.3, "high": 11.6, "low": 11.1, "close": 11.4, "volume": 180, "change_percent": 1},
                {"date": "2026-02-20", "open": 11.4, "high": 11.8, "low": 11.2, "close": 11.7, "volume": 190, "change_percent": 3},
            ]
        )

        weekly = _normalize_period_ohlcv(df, "weekly")
        self.assertEqual(len(weekly), 2)
        self.assertEqual(list(weekly["date"]), ["2026-02-13", "2026-02-20"])
        self.assertAlmostEqual(float(weekly.iloc[0]["open"]), 10.0, places=6)
        self.assertAlmostEqual(float(weekly.iloc[0]["close"]), 11.2, places=6)
        self.assertAlmostEqual(float(weekly.iloc[0]["high"]), 11.4, places=6)
        self.assertAlmostEqual(float(weekly.iloc[0]["low"]), 9.0, places=6)
        self.assertAlmostEqual(float(weekly.iloc[0]["volume"]), 600.0, places=6)
        self.assertTrue(_is_period_interval_sane(weekly, "weekly"))

    def test_monthly_normalization_from_daily_rows(self):
        df = pd.DataFrame(
            [
                {"date": "2026-01-29", "open": 10, "high": 10.5, "low": 9.8, "close": 10.2, "volume": 100, "change_percent": 0},
                {"date": "2026-01-30", "open": 10.2, "high": 10.7, "low": 10.1, "close": 10.6, "volume": 120, "change_percent": 0},
                {"date": "2026-02-03", "open": 10.6, "high": 11.0, "low": 10.4, "close": 10.8, "volume": 130, "change_percent": 0},
                {"date": "2026-02-27", "open": 10.9, "high": 11.3, "low": 10.7, "close": 11.1, "volume": 140, "change_percent": 0},
            ]
        )
        monthly = _normalize_period_ohlcv(df, "monthly")
        self.assertEqual(len(monthly), 2)
        self.assertEqual(list(monthly["date"]), ["2026-01-30", "2026-02-27"])
        self.assertTrue(_is_period_interval_sane(monthly, "monthly"))


class TestPromptPeriodFallback(unittest.TestCase):
    def test_detects_daily_leakage_history(self):
        leaked_weekly = [
            {"date": "2026-02-25"},
            {"date": "2026-02-24"},
            {"date": "2026-02-23"},
            {"date": "2026-02-20"},
        ]
        leaked_monthly = [
            {"date": "2026-02-25"},
            {"date": "2026-02-24"},
            {"date": "2026-02-23"},
        ]
        self.assertFalse(_is_period_history_sane(leaked_weekly, "weekly"))
        self.assertFalse(_is_period_history_sane(leaked_monthly, "monthly"))

    def test_aggregate_daily_to_weekly_in_prompt(self):
        daily_rows = []
        start = pd.Timestamp("2025-12-29")
        price = 10.0
        for i in range(60):
            d = start + pd.Timedelta(days=i)
            if d.weekday() >= 5:  # skip weekend
                continue
            price += 0.1
            daily_rows.append(
                {
                    "date": d.strftime("%Y-%m-%d"),
                    "open": price - 0.2,
                    "high": price + 0.3,
                    "low": price - 0.4,
                    "close": price,
                    "volume": 1000 + i * 10,
                }
            )

        weekly = _aggregate_daily_to_period_bars(daily_rows, "weekly")
        self.assertGreaterEqual(len(weekly), 8)
        self.assertIn("ma20", weekly[0])
        self.assertIn("rsi", weekly[0])
        self.assertTrue(_is_period_history_sane(weekly[:12], "weekly"))


if __name__ == "__main__":
    unittest.main()
