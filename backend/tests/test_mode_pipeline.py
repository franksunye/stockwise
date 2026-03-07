import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from backend.analysis.mode_pipeline import (
    DEFENSE_SEMANTIC,
    ENTRY_SEMANTIC,
    WATCH_SEMANTIC,
    ensure_mode_pipeline_schema,
    run_mode_pipeline,
)


def _price_row(symbol, date, open_, high, low, close, change_percent, volume, ma5, ma10, ma20, macd_hist):
    return (symbol, date, open_, high, low, close, change_percent, volume, ma5, ma10, ma20, macd_hist)


def _strong_history(symbol: str):
    rows = []
    for i in range(16):
        day = f"2026-02-{i + 1:02d}"
        rows.append(_price_row(symbol, day, 10.0, 12.0, 8.0, 10.0, 0.5, 100.0, 9.8, 9.7, 9.6, 0.1))
    for i in range(4):
        day = f"2026-02-{17 + i:02d}"
        rows.append(_price_row(symbol, day, 10.0, 10.2, 9.8, 10.0, 0.8, 100.0, 9.9, 9.8, 9.7, 0.1))
    rows.append(_price_row(symbol, "2026-03-06", 10.5, 10.9, 10.0, 10.5, 2.1, 92.0, 10.1, 10.2, 10.1, 0.09))
    rows.append(_price_row(symbol, "2026-03-07", 10.6, 11.0, 10.2, 11.0, 4.7, 118.0, 10.3, 10.2, 10.0, 0.2))
    return rows


def _borderline_history(symbol: str):
    rows = []
    for i in range(16):
        day = f"2026-02-{i + 1:02d}"
        rows.append(_price_row(symbol, day, 10.0, 12.0, 8.0, 10.0, 0.5, 100.0, 9.8, 9.7, 9.6, 0.1))
    for i in range(4):
        day = f"2026-02-{17 + i:02d}"
        rows.append(_price_row(symbol, day, 10.0, 10.2, 9.8, 10.0, 0.8, 100.0, 9.9, 9.8, 9.7, 0.1))
    rows.append(_price_row(symbol, "2026-03-06", 10.55, 10.9, 10.0, 10.55, 2.0, 88.0, 10.1, 10.2, 10.1, 0.12))
    rows.append(_price_row(symbol, "2026-03-07", 10.6, 10.95, 10.3, 10.9, 3.3, 110.0, 10.2, 10.15, 10.0, 0.16))
    return rows


def _risk_off_history(symbol: str):
    rows = []
    for i in range(20):
        day = f"2026-02-{i + 1:02d}"
        rows.append(_price_row(symbol, day, 10.0, 10.6, 9.4, 10.0, 0.5, 100.0, 10.0, 10.0, 10.0, 0.1))
    rows.append(_price_row(symbol, "2026-03-06", 9.8, 10.1, 9.6, 9.7, -0.8, 95.0, 9.9, 10.1, 10.0, 0.05))
    rows.append(_price_row(symbol, "2026-03-07", 9.6, 9.8, 9.2, 9.3, -4.1, 120.0, 9.7, 9.9, 9.95, -0.02))
    return rows


class TestModePipeline(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        self.tmp.close()
        self.db_path = self.tmp.name
        os.environ["DB_SOURCE"] = "local"
        os.environ["DB_PATH"] = self.db_path

        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE ai_predictions_v2 (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                model_id TEXT NOT NULL,
                target_date TEXT NOT NULL,
                signal TEXT,
                confidence REAL,
                layer1_status TEXT,
                layer1_trigger_hit INTEGER DEFAULT 0,
                layer1_risk_off_hit INTEGER DEFAULT 0,
                ai_reasoning TEXT,
                is_primary INTEGER DEFAULT 0,
                mode_id TEXT,
                PRIMARY KEY(symbol, date, model_id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE daily_prices (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                change_percent REAL,
                volume REAL,
                ma5 REAL,
                ma10 REAL,
                ma20 REAL,
                macd_hist REAL,
                PRIMARY KEY(symbol, date)
            )
            """
        )
        cur.execute("CREATE TABLE user_watchlist (user_id TEXT NOT NULL, symbol TEXT NOT NULL)")
        cur.execute("CREATE TABLE users (user_id TEXT PRIMARY KEY, subscription_tier TEXT)")

        cur.executemany(
            """
            INSERT INTO ai_predictions_v2
            (symbol, date, model_id, target_date, signal, confidence, layer1_status, layer1_trigger_hit, layer1_risk_off_hit, ai_reasoning, is_primary, mode_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("000001", "2026-03-06", "rule-engine", "2026-03-07", "Long", 0.82, "TriggeredLong", 1, 0, "strong setup", 1, "balanced_v1"),
                ("000002", "2026-03-06", "rule-engine", "2026-03-07", "Side", 0.44, "Watch", 0, 0, "borderline setup", 1, "balanced_v1"),
                ("000003", "2026-03-06", "rule-engine", "2026-03-07", "Side", 0.61, "RiskOff", 0, 1, "risk off setup", 1, "balanced_v1"),
            ],
        )
        price_rows = _strong_history("000001") + _borderline_history("000002") + _risk_off_history("000003")
        cur.executemany(
            """
            INSERT INTO daily_prices
            (symbol, date, open, high, low, close, change_percent, volume, ma5, ma10, ma20, macd_hist)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            price_rows,
        )
        cur.execute("INSERT INTO users (user_id, subscription_tier) VALUES ('u1', 'pro')")
        cur.executemany(
            "INSERT INTO user_watchlist (user_id, symbol) VALUES (?, ?)",
            [("u1", "000001"), ("u1", "000002"), ("u1", "000003")],
        )
        conn.commit()
        conn.close()

    def tearDown(self):
        try:
            os.remove(self.db_path)
        except OSError:
            pass

    def _run_pipeline(self, mode_id=None):
        with patch("backend.analysis.mode_pipeline.get_connection", side_effect=lambda: sqlite3.connect(self.db_path)):
            return run_mode_pipeline(
                as_of_date="2026-03-06",
                mode_id=mode_id,
                job_id="job-test-1",
                rule_version="mode_sim_v1",
                triggered_by="unittest",
            )

    def test_pipeline_builds_decision_ledger_snapshot(self):
        stats = self._run_pipeline(mode_id="balanced_v1")
        self.assertGreaterEqual(stats["decision_rows"], 3)
        self.assertGreaterEqual(stats["ledger_rows"], 1)
        self.assertGreaterEqual(stats["snapshot_rows"], 1)

        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute(
            "SELECT decision_semantic, job_id, rule_version, triggered_by FROM mode_decision_log WHERE mode_id='balanced_v1' AND symbol='000001'"
        )
        row = cur.fetchone()
        self.assertEqual(row[0], ENTRY_SEMANTIC)
        self.assertEqual(row[1], "job-test-1")
        self.assertEqual(row[2], "mode_sim_v1")
        self.assertEqual(row[3], "unittest")

        cur.execute(
            "SELECT trade_status, pnl_pct FROM mode_simulated_trade_ledger WHERE mode_id='balanced_v1' AND symbol='000001'"
        )
        ledger = cur.fetchone()
        self.assertEqual(ledger[0], "closed")
        self.assertAlmostEqual(ledger[1], (11.0 - 10.5) / 10.5, places=6)
        conn.close()

    def test_schema_ensure_adds_tables(self):
        conn = sqlite3.connect(self.db_path)
        ensure_mode_pipeline_schema(conn)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='mode_decision_log'")
        self.assertIsNotNone(cur.fetchone())
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='mode_simulated_trade_ledger'")
        self.assertIsNotNone(cur.fetchone())
        conn.close()

    def test_user_active_mode_controls_pool_segment(self):
        conn = sqlite3.connect(self.db_path)
        ensure_mode_pipeline_schema(conn)
        cur = conn.cursor()
        cur.execute(
            "INSERT OR REPLACE INTO user_investment_mode (user_id, mode_id, updated_at, updated_by) VALUES (?, ?, ?, 'user')",
            ("u1", "aggressive_v1", "2026-03-06T00:00:00"),
        )
        conn.commit()
        conn.close()

        self._run_pipeline(mode_id="aggressive_v1")
        self._run_pipeline(mode_id="balanced_v1")

        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM mode_performance_snapshot WHERE mode_id='aggressive_v1' AND scope='pool' AND segment_key='user:u1'"
        )
        self.assertGreaterEqual(int(cur.fetchone()[0] or 0), 1)
        cur.execute(
            "SELECT COUNT(*) FROM mode_performance_snapshot WHERE mode_id='balanced_v1' AND scope='pool' AND segment_key='user:u1'"
        )
        self.assertEqual(int(cur.fetchone()[0] or 0), 0)
        conn.close()

    def test_modes_use_distinct_quant_bundles(self):
        self._run_pipeline()
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()

        cur.execute("SELECT decision_semantic FROM mode_decision_log WHERE mode_id='steady_v1' AND symbol='000002'")
        self.assertEqual(cur.fetchone()[0], WATCH_SEMANTIC)

        cur.execute("SELECT decision_semantic FROM mode_decision_log WHERE mode_id='balanced_v1' AND symbol='000002'")
        self.assertEqual(cur.fetchone()[0], ENTRY_SEMANTIC)

        cur.execute("SELECT decision_semantic FROM mode_decision_log WHERE mode_id='aggressive_v1' AND symbol='000002'")
        self.assertEqual(cur.fetchone()[0], ENTRY_SEMANTIC)

        cur.execute("SELECT decision_semantic FROM mode_decision_log WHERE mode_id='observe_only_v1' AND symbol='000001'")
        self.assertEqual(cur.fetchone()[0], WATCH_SEMANTIC)

        cur.execute("SELECT decision_semantic FROM mode_decision_log WHERE mode_id='balanced_v1' AND symbol='000003'")
        self.assertEqual(cur.fetchone()[0], DEFENSE_SEMANTIC)

        cur.execute("SELECT trigger_flags FROM mode_decision_log WHERE mode_id='steady_v1' AND symbol='000002'")
        self.assertIn('"params_bundle": "steady"', cur.fetchone()[0])
        conn.close()

    def test_only_entry_semantics_create_ledger_rows(self):
        self._run_pipeline()
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM mode_simulated_trade_ledger WHERE mode_id='steady_v1'")
        self.assertEqual(int(cur.fetchone()[0] or 0), 0)
        cur.execute("SELECT COUNT(*) FROM mode_simulated_trade_ledger WHERE mode_id='balanced_v1'")
        self.assertEqual(int(cur.fetchone()[0] or 0), 2)
        cur.execute("SELECT COUNT(*) FROM mode_simulated_trade_ledger WHERE mode_id='aggressive_v1'")
        self.assertEqual(int(cur.fetchone()[0] or 0), 2)
        cur.execute("SELECT COUNT(*) FROM mode_simulated_trade_ledger WHERE mode_id='observe_only_v1'")
        self.assertEqual(int(cur.fetchone()[0] or 0), 0)
        conn.close()


if __name__ == "__main__":
    unittest.main()
