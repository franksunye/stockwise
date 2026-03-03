import os
import sqlite3
import tempfile
import unittest

import pandas as pd

import backend.context.provider as provider_module
from backend.context.provider import MarketContextProvider


class TestHKShortContextProvider(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fd, cls.db_path = tempfile.mkstemp(prefix="stockwise_hk_short_", suffix=".db")
        os.close(fd)

        conn = sqlite3.connect(cls.db_path)
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE hk_short_selling_daily (
                symbol TEXT NOT NULL,
                trade_date TEXT NOT NULL,
                market TEXT NOT NULL,
                short_volume REAL,
                short_turnover REAL,
                total_volume REAL,
                total_turnover REAL,
                short_volume_ratio REAL,
                short_turnover_ratio REAL,
                source TEXT NOT NULL,
                quality_flag TEXT,
                PRIMARY KEY (symbol, trade_date, source)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE hk_short_interest_weekly (
                symbol TEXT NOT NULL,
                report_week TEXT NOT NULL,
                short_interest_shares REAL,
                short_interest_market_value REAL,
                source TEXT NOT NULL,
                quality_flag TEXT,
                PRIMARY KEY (symbol, report_week, source)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE hk_short_eligible_list (
                snapshot_date TEXT NOT NULL,
                symbol TEXT NOT NULL,
                is_eligible INTEGER NOT NULL DEFAULT 1,
                source TEXT NOT NULL,
                PRIMARY KEY (snapshot_date, symbol, source)
            )
            """
        )
        cur.execute(
            """
            INSERT INTO hk_short_selling_daily
            (symbol, trade_date, market, short_volume, short_turnover, total_volume, total_turnover, short_volume_ratio, short_turnover_ratio, source, quality_flag)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("00700", "2026-03-02", "MAIN", 1000000, 120000000, 6000000, 600000000, 0.1667, 0.2, "TEST", "OK"),
        )
        cur.execute(
            """
            INSERT INTO hk_short_interest_weekly
            (symbol, report_week, short_interest_shares, short_interest_market_value, source, quality_flag)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("00700", "2026-02-27", 20000000, 6400000000, "TEST", "OK"),
        )
        cur.execute(
            """
            INSERT INTO hk_short_eligible_list
            (snapshot_date, symbol, is_eligible, source)
            VALUES (?, ?, ?, ?)
            """,
            ("2026-03-02", "00700", 1, "TEST"),
        )
        conn.commit()
        conn.close()

        cls._orig_get_connection = provider_module.get_connection
        cls._orig_stock_flow = provider_module.ak.stock_individual_fund_flow

        def _test_get_connection():
            return sqlite3.connect(cls.db_path)

        provider_module.get_connection = _test_get_connection

        def _fake_stock_individual_fund_flow(stock, market):
            return pd.DataFrame(
                [
                    {"日期": "2026-03-01", "主力净流入-净额": 10000000},
                    {"日期": "2026-03-02", "主力净流入-净额": 12000000},
                ]
            )

        provider_module.ak.stock_individual_fund_flow = _fake_stock_individual_fund_flow

    @classmethod
    def tearDownClass(cls):
        provider_module.get_connection = cls._orig_get_connection
        provider_module.ak.stock_individual_fund_flow = cls._orig_stock_flow
        if os.path.exists(cls.db_path):
            os.remove(cls.db_path)

    def setUp(self):
        self.provider = MarketContextProvider()
        self.provider._cache["stock_flow"] = {}

    def test_hk_stock_flow_uses_short_context(self):
        data = self.provider.get_stock_flow_context("00700")
        self.assertTrue(data["short_selling_context"]["has_data"])
        self.assertEqual(data["short_selling_context"]["eligible"], True)
        self.assertAlmostEqual(data["short_selling_context"]["daily"]["short_turnover_ratio"], 0.2, places=4)
        self.assertIn("做空成交比", data["summary"])

    def test_hk_stock_flow_no_data_degrades_gracefully(self):
        data = self.provider.get_stock_flow_context("09988")
        self.assertFalse(data["short_selling_context"]["has_data"])
        self.assertEqual(data["interpretation"], "待同步")

    def test_non_hk_stock_flow_stays_original_path(self):
        data = self.provider.get_stock_flow_context("600519")
        self.assertIn("主力资金", data["summary"])
        self.assertNotIn("short_selling_context", data)


if __name__ == "__main__":
    unittest.main(verbosity=2)
