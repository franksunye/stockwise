import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

import pandas as pd

import backend.database as database_module
import backend.sync.prices as prices_module
import database as legacy_database_module


class TestPeriodSyncStrategy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fd, cls.db_path = tempfile.mkstemp(prefix="stockwise_period_sync_", suffix=".db")
        os.close(fd)

        cls._orig_db_get_connection = database_module.get_connection
        cls._orig_legacy_db_get_connection = legacy_database_module.get_connection
        cls._orig_prices_get_connection = prices_module.get_connection

        def _test_get_connection(*args, **kwargs):
            return sqlite3.connect(cls.db_path)

        database_module.get_connection = _test_get_connection
        legacy_database_module.get_connection = _test_get_connection
        prices_module.get_connection = _test_get_connection
        database_module.init_db()

    @classmethod
    def tearDownClass(cls):
        database_module.get_connection = cls._orig_db_get_connection
        legacy_database_module.get_connection = cls._orig_legacy_db_get_connection
        prices_module.get_connection = cls._orig_prices_get_connection
        if os.path.exists(cls.db_path):
            os.remove(cls.db_path)

    def setUp(self):
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM daily_prices")
            cursor.execute("DELETE FROM weekly_prices")
            cursor.execute("DELETE FROM monthly_prices")
            conn.commit()
        finally:
            conn.close()

    def _read_rows(self, table_name: str):
        conn = sqlite3.connect(self.db_path)
        try:
            return pd.read_sql_query(
                f"SELECT symbol, date, open, high, low, close, volume FROM {table_name} ORDER BY date",
                conn,
            )
        finally:
            conn.close()

    def test_weekly_sync_uses_daily_source_and_writes_aggregated_bars(self):
        calls = []
        raw_daily = pd.DataFrame(
            [
                {"日期": "2026-02-09", "开盘": 10.0, "最高": 11.0, "最低": 9.0, "收盘": 10.2, "成交量": 100, "涨跌幅": 1.0},
                {"日期": "2026-02-10", "开盘": 10.3, "最高": 11.2, "最低": 10.0, "收盘": 10.8, "成交量": 110, "涨跌幅": 2.0},
                {"日期": "2026-02-11", "开盘": 10.7, "最高": 11.4, "最低": 10.6, "收盘": 11.0, "成交量": 120, "涨跌幅": 1.0},
                {"日期": "2026-02-12", "开盘": 10.9, "最高": 11.1, "最低": 10.5, "收盘": 10.7, "成交量": 130, "涨跌幅": -2.0},
                {"日期": "2026-02-13", "开盘": 10.8, "最高": 11.3, "最低": 10.7, "收盘": 11.2, "成交量": 140, "涨跌幅": 5.0},
                {"日期": "2026-02-16", "开盘": 11.1, "最高": 11.5, "最低": 10.9, "收盘": 11.0, "成交量": 150, "涨跌幅": -1.0},
                {"日期": "2026-02-17", "开盘": 11.0, "最高": 11.2, "最低": 10.8, "收盘": 10.9, "成交量": 160, "涨跌幅": -1.0},
                {"日期": "2026-02-18", "开盘": 10.9, "最高": 11.4, "最低": 10.7, "收盘": 11.3, "成交量": 170, "涨跌幅": 4.0},
                {"日期": "2026-02-19", "开盘": 11.3, "最高": 11.6, "最低": 11.1, "收盘": 11.4, "成交量": 180, "涨跌幅": 1.0},
                {"日期": "2026-02-20", "开盘": 11.4, "最高": 11.8, "最低": 11.2, "收盘": 11.7, "成交量": 190, "涨跌幅": 3.0},
            ]
        )

        def _fake_fetch(symbol, period="daily", start_date=None, is_realtime=False):
            calls.append({"symbol": symbol, "period": period, "start_date": start_date, "is_realtime": is_realtime})
            return raw_daily.copy()

        with patch.object(prices_module, "fetch_stock_data", side_effect=_fake_fetch), \
             patch.object(prices_module, "get_last_date", return_value=None):
            ok = prices_module.process_stock_period("600519", period="weekly")

        self.assertTrue(ok)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["period"], "daily")

        rows = self._read_rows("weekly_prices")
        self.assertEqual(len(rows), 2)
        self.assertEqual(list(rows["date"]), ["2026-02-13", "2026-02-20"])
        self.assertAlmostEqual(float(rows.iloc[0]["open"]), 10.0, places=2)
        self.assertAlmostEqual(float(rows.iloc[0]["high"]), 11.4, places=2)
        self.assertAlmostEqual(float(rows.iloc[0]["low"]), 9.0, places=2)
        self.assertAlmostEqual(float(rows.iloc[0]["close"]), 11.2, places=2)
        self.assertEqual(int(rows.iloc[0]["volume"]), 600)

    def test_monthly_sync_uses_daily_source_and_writes_aggregated_bars(self):
        calls = []
        raw_daily = pd.DataFrame(
            [
                {"日期": "2026-01-29", "开盘": 10.0, "最高": 10.5, "最低": 9.8, "收盘": 10.2, "成交量": 100, "涨跌幅": 0.0},
                {"日期": "2026-01-30", "开盘": 10.2, "最高": 10.7, "最低": 10.1, "收盘": 10.6, "成交量": 120, "涨跌幅": 0.0},
                {"日期": "2026-02-03", "开盘": 10.6, "最高": 11.0, "最低": 10.4, "收盘": 10.8, "成交量": 130, "涨跌幅": 0.0},
                {"日期": "2026-02-27", "开盘": 10.9, "最高": 11.3, "最低": 10.7, "收盘": 11.1, "成交量": 140, "涨跌幅": 0.0},
            ]
        )

        def _fake_fetch(symbol, period="daily", start_date=None, is_realtime=False):
            calls.append({"symbol": symbol, "period": period, "start_date": start_date, "is_realtime": is_realtime})
            return raw_daily.copy()

        with patch.object(prices_module, "fetch_stock_data", side_effect=_fake_fetch), \
             patch.object(prices_module, "get_last_date", return_value=None):
            ok = prices_module.process_stock_period("600519", period="monthly")

        self.assertTrue(ok)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["period"], "daily")

        rows = self._read_rows("monthly_prices")
        self.assertEqual(len(rows), 2)
        self.assertEqual(list(rows["date"]), ["2026-01-30", "2026-02-27"])
        self.assertAlmostEqual(float(rows.iloc[0]["open"]), 10.0, places=2)
        self.assertAlmostEqual(float(rows.iloc[0]["high"]), 10.7, places=2)
        self.assertAlmostEqual(float(rows.iloc[0]["low"]), 9.8, places=2)
        self.assertAlmostEqual(float(rows.iloc[0]["close"]), 10.6, places=2)
        self.assertEqual(int(rows.iloc[0]["volume"]), 220)


if __name__ == "__main__":
    unittest.main(verbosity=2)
