import json
import os
import sqlite3
import tempfile
import unittest

import backend.engine.almanac_generator as ag


class TestAlmanacDegradeGate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fd, cls.db_path = tempfile.mkstemp(prefix="stockwise_almanac_gate_", suffix=".db")
        os.close(fd)
        conn = sqlite3.connect(cls.db_path)
        cur = conn.cursor()
        cur.execute("CREATE TABLE market_holidays (date TEXT PRIMARY KEY)")
        cur.execute(
            """
            CREATE TABLE daily_prices (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                volume REAL,
                PRIMARY KEY(symbol, date)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE market_almanacs (
                target_date TEXT PRIMARY KEY,
                mood_tag TEXT,
                action_strategy TEXT,
                meteorology TEXT,
                market_entropy TEXT,
                sector_currents TEXT,
                ai_insight TEXT,
                generation_trace TEXT,
                created_at TIMESTAMP
            )
            """
        )
        cur.execute("INSERT INTO daily_prices(symbol, date, volume) VALUES(?, ?, ?)", ("sh000001", "2026-03-02", 1000))
        cur.execute("INSERT INTO daily_prices(symbol, date, volume) VALUES(?, ?, ?)", ("00700", "2026-03-02", 1000))
        conn.commit()
        conn.close()

        cls._orig_get_connection = ag.get_connection
        cls._orig_get_facts = ag.get_or_generate_market_facts
        cls._orig_macro = ag.MarketContextProvider.get_macro_context
        cls._orig_flow = ag.MarketContextProvider.get_market_flow_context
        cls._orig_wecom = ag.send_wecom_notification

        def _test_get_connection():
            return sqlite3.connect(cls.db_path)

        def _fake_facts(fact_date: str):
            return {
                "fact_date": fact_date,
                "facts": {
                    "version": "market_facts.v1",
                    "turnover": {"ratio_5d": 1.0},
                    "breadth": {"advancers": 10, "decliners": 10, "ratio": 0.5},
                    "derived": {"vol_type": "flat", "breadth_type": "neutral"},
                    "sector_flow": {
                        "top_inflow": "电子(+1.00亿), 计算机(+0.80亿)",
                        "top_outflow": "煤炭(-0.70亿), 银行(-0.30亿)",
                    },
                },
                "quality": {"gate_pass": False, "flags": ["missing_limit_stats"]},
            }

        def _fake_macro(self, skip_nasdaq=False):
            return {"nasdaq": "N/A", "lineage": {}, "quality": {"score": 0}}

        def _fake_flow(self):
            return {
                "top_inflow_sectors": "电子(+1.00亿), 计算机(+0.80亿)",
                "top_outflow_sectors": "煤炭(-0.70亿), 银行(-0.30亿)",
                "lineage": {"sector_flow": "test"},
                "quality": {"score": 0},
            }

        ag.get_connection = _test_get_connection
        ag.get_or_generate_market_facts = _fake_facts
        ag.MarketContextProvider.get_macro_context = _fake_macro
        ag.MarketContextProvider.get_market_flow_context = _fake_flow
        ag.send_wecom_notification = lambda *args, **kwargs: None

    @classmethod
    def tearDownClass(cls):
        ag.get_connection = cls._orig_get_connection
        ag.get_or_generate_market_facts = cls._orig_get_facts
        ag.MarketContextProvider.get_macro_context = cls._orig_macro
        ag.MarketContextProvider.get_market_flow_context = cls._orig_flow
        ag.send_wecom_notification = cls._orig_wecom
        if os.path.exists(cls.db_path):
            os.remove(cls.db_path)

    def test_generate_almanac_degraded_when_gate_fails(self):
        ok = ag.generate_almanac(target_date="2026-03-03", force_t_plus_1=False)
        self.assertTrue(ok)

        conn = sqlite3.connect(self.db_path)
        try:
            row = conn.execute(
                "SELECT mood_tag, action_strategy, ai_insight, generation_trace FROM market_almanacs WHERE target_date = ?",
                ("2026-03-03",),
            ).fetchone()
        finally:
            conn.close()

        self.assertIsNotNone(row)
        self.assertEqual(row[0], "混沌未明")
        self.assertEqual(row[1], "宜：控制仓位 / 忌：情绪化追单")
        self.assertIn("数据完整性不足", row[2])
        trace = json.loads(row[3])
        self.assertTrue(trace["logic"]["degraded"])
        self.assertFalse(trace["data_quality"]["facts_gate_pass"])


if __name__ == "__main__":
    unittest.main()
