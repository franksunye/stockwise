import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from backend.analysis.mode_pipeline import run_mode_pipeline, ensure_mode_pipeline_schema


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
                close REAL,
                PRIMARY KEY(symbol, date)
            )
            """
        )
        cur.execute("CREATE TABLE user_watchlist (user_id TEXT NOT NULL, symbol TEXT NOT NULL)")
        cur.execute("CREATE TABLE users (user_id TEXT PRIMARY KEY, subscription_tier TEXT)")

        cur.execute(
            """
            INSERT INTO ai_predictions_v2
            (symbol, date, model_id, target_date, signal, confidence, layer1_status, layer1_trigger_hit, layer1_risk_off_hit, ai_reasoning, is_primary, mode_id)
            VALUES ('000001', '2026-03-06', 'rule-engine', '2026-03-07', 'Long', 0.8, 'TriggeredLong', 1, 0, 'test reasoning', 1, 'balanced_v1')
            """
        )
        cur.execute("INSERT INTO daily_prices (symbol, date, close) VALUES ('000001', '2026-03-06', 10.0)")
        cur.execute("INSERT INTO daily_prices (symbol, date, close) VALUES ('000001', '2026-03-07', 10.5)")
        cur.execute("INSERT INTO users (user_id, subscription_tier) VALUES ('u1', 'pro')")
        cur.execute("INSERT INTO user_watchlist (user_id, symbol) VALUES ('u1', '000001')")
        conn.commit()
        conn.close()

    def tearDown(self):
        try:
            os.remove(self.db_path)
        except OSError:
            pass

    def test_pipeline_builds_decision_ledger_snapshot(self):
        with patch("backend.analysis.mode_pipeline.get_connection", return_value=sqlite3.connect(self.db_path)):
            stats = run_mode_pipeline(
                as_of_date="2026-03-06",
                mode_id="balanced_v1",
                job_id="job-test-1",
                rule_version="mode_sim_v1",
                triggered_by="unittest",
            )
        self.assertGreaterEqual(stats["decision_rows"], 1)
        self.assertGreaterEqual(stats["ledger_rows"], 1)
        self.assertGreaterEqual(stats["snapshot_rows"], 1)

        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT decision_semantic, job_id, rule_version, triggered_by FROM mode_decision_log WHERE mode_id='balanced_v1' AND symbol='000001'")
        row = cur.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "建议进场")
        self.assertEqual(row[1], "job-test-1")
        self.assertEqual(row[2], "mode_sim_v1")
        self.assertEqual(row[3], "unittest")

        cur.execute("SELECT trade_status, pnl_pct, job_id, triggered_by FROM mode_simulated_trade_ledger WHERE mode_id='balanced_v1' AND symbol='000001'")
        ledger = cur.fetchone()
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger[0], "closed")
        self.assertAlmostEqual(ledger[1], 0.05, places=6)
        self.assertEqual(ledger[2], "job-test-1")
        self.assertEqual(ledger[3], "unittest")

        cur.execute(
            """
            SELECT scope, horizon, sample_size, job_id, rule_version, triggered_by
            FROM mode_performance_snapshot
            WHERE mode_id='balanced_v1' AND as_of_date='2026-03-06'
            """
        )
        snapshots = cur.fetchall()
        self.assertTrue(any(s[0] == "universal" for s in snapshots))
        self.assertTrue(any(s[0] == "pool" for s in snapshots))
        self.assertTrue(all(s[3] == "job-test-1" for s in snapshots))
        self.assertTrue(all(s[4] == "mode_sim_v1" for s in snapshots))
        self.assertTrue(all(s[5] == "unittest" for s in snapshots))
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

        with patch("backend.analysis.mode_pipeline.get_connection", side_effect=lambda: sqlite3.connect(self.db_path)):
            run_mode_pipeline(as_of_date="2026-03-06", mode_id="aggressive_v1")
            run_mode_pipeline(as_of_date="2026-03-06", mode_id="balanced_v1")

        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT COUNT(*) FROM mode_performance_snapshot
            WHERE mode_id='aggressive_v1' AND scope='pool' AND segment_key='user:u1'
            """
        )
        aggressive_count = int(cur.fetchone()[0] or 0)
        self.assertGreaterEqual(aggressive_count, 1)

        cur.execute(
            """
            SELECT COUNT(*) FROM mode_performance_snapshot
            WHERE mode_id='balanced_v1' AND scope='pool' AND segment_key='user:u1'
            """
        )
        balanced_count = int(cur.fetchone()[0] or 0)
        self.assertEqual(balanced_count, 0)
        conn.close()


if __name__ == "__main__":
    unittest.main()
