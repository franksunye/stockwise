import os
import sqlite3
import tempfile
import unittest

import pandas as pd

import backend.engine.market_facts_service as mfs


class TestMarketFactsService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fd, cls.db_path = tempfile.mkstemp(prefix="stockwise_market_facts_", suffix=".db")
        os.close(fd)

        cls._orig_get_connection = mfs.get_connection
        cls._orig_spot = mfs.ak.stock_zh_a_spot_em
        cls._orig_zt = mfs.ak.stock_zt_pool_em
        cls._orig_dt = mfs.ak.stock_zt_pool_dtgc_em
        cls._orig_zb = mfs.ak.stock_zt_pool_zbgc_em
        cls._orig_idx = mfs.ak.stock_zh_index_daily_em
        cls._orig_flow = mfs.MarketContextProvider.get_market_flow_context

        def _test_get_connection():
            return sqlite3.connect(cls.db_path)

        mfs.get_connection = _test_get_connection

        def _fake_spot():
            return pd.DataFrame(
                [
                    {"成交额": 1_000_000_000, "涨跌幅": 1.2},
                    {"成交额": 2_000_000_000, "涨跌幅": -0.8},
                    {"成交额": 1_500_000_000, "涨跌幅": 0.5},
                    {"成交额": 500_000_000, "涨跌幅": 2.1},
                ]
            )

        def _fake_zt_pool(date):
            return pd.DataFrame([{"code": "A"}, {"code": "B"}, {"code": "C"}])

        def _fake_dt_pool(date):
            return pd.DataFrame([{"code": "X"}])

        def _fake_zb_pool(date):
            return pd.DataFrame([{"code": "Z1"}, {"code": "Z2"}])

        def _fake_index(symbol):
            base = 3000.0 if symbol == "sh000001" else (10000.0 if symbol == "sz399001" else 2000.0)
            closes = [base + i * 5 for i in range(30)]
            return pd.DataFrame({"close": closes})

        def _fake_flow(self):
            return {
                "northbound_net_inflow": "涨2000/跌1000 (偏多)",
                "northbound_breadth": {"win_ratio": 0.62, "sentiment": "偏多"},
                "top_inflow_sectors": "电子(+12.30亿), 计算机(+8.20亿), 汽车(+4.10亿)",
                "top_outflow_sectors": "煤炭(-3.10亿), 银行(-1.60亿)",
                "lineage": {"sector_flow": "test"},
            }

        mfs.ak.stock_zh_a_spot_em = _fake_spot
        mfs.ak.stock_zt_pool_em = _fake_zt_pool
        mfs.ak.stock_zt_pool_dtgc_em = _fake_dt_pool
        mfs.ak.stock_zt_pool_zbgc_em = _fake_zb_pool
        mfs.ak.stock_zh_index_daily_em = _fake_index
        mfs.MarketContextProvider.get_market_flow_context = _fake_flow

    @classmethod
    def tearDownClass(cls):
        mfs.get_connection = cls._orig_get_connection
        mfs.ak.stock_zh_a_spot_em = cls._orig_spot
        mfs.ak.stock_zt_pool_em = cls._orig_zt
        mfs.ak.stock_zt_pool_dtgc_em = cls._orig_dt
        mfs.ak.stock_zt_pool_zbgc_em = cls._orig_zb
        mfs.ak.stock_zh_index_daily_em = cls._orig_idx
        mfs.MarketContextProvider.get_market_flow_context = cls._orig_flow
        if os.path.exists(cls.db_path):
            os.remove(cls.db_path)

    def test_generate_market_facts_gate_pass(self):
        res = mfs.generate_market_facts("2026-03-03")
        self.assertEqual(res["facts"]["version"], "market_facts.v1")
        self.assertTrue(res["quality"]["gate_pass"])
        self.assertEqual(res["facts"]["turnover"]["status"], "ok")
        self.assertEqual(res["facts"]["breadth"]["status"], "ok")
        self.assertEqual(res["facts"]["limit_stats"]["status"], "ok")
        self.assertEqual(res["facts"]["core_indices"]["status"], "ok")
        self.assertEqual(res["facts"]["northbound"]["status"], "ok")
        self.assertEqual(res["facts"]["sector_flow"]["status"], "ok")

    def test_get_or_generate_market_facts_returns_existing(self):
        first = mfs.generate_market_facts("2026-03-04")
        second = mfs.get_or_generate_market_facts("2026-03-04")
        self.assertEqual(first["fact_date"], second["fact_date"])
        self.assertEqual(second["facts"]["fact_date"], "2026-03-04")

    def test_get_or_generate_fallback_to_latest_when_generation_fails(self):
        _ = mfs.generate_market_facts("2026-03-01")
        latest_before = mfs.get_latest_market_facts_on_or_before("2026-03-06")
        self.assertIsNotNone(latest_before)
        expected_date = latest_before["fact_date"]
        original_generate = mfs.generate_market_facts

        def _boom(fact_date: str):
            raise RuntimeError("upstream unavailable")

        mfs.generate_market_facts = _boom
        try:
            got = mfs.get_or_generate_market_facts("2026-03-06")
        finally:
            mfs.generate_market_facts = original_generate

        self.assertEqual(got["fact_date"], expected_date)
        self.assertFalse(got["quality"]["gate_pass"])
        self.assertIn("stale_fallback_used", got["quality"]["flags"])
        self.assertEqual(got["quality"]["fallback_fact_date"], expected_date)


if __name__ == "__main__":
    unittest.main()
