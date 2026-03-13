import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from backend.engine.validator import verify_all_pending


class TestValidatorSemantics(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        self.tmp.close()
        self.db_path = self.tmp.name

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
                validation_status TEXT DEFAULT 'Pending',
                actual_change REAL,
                validation_data TEXT,
                max_perf_in_window REAL,
                updated_at TEXT,
                PRIMARY KEY(symbol, date, model_id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE daily_prices (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                change_percent REAL,
                close REAL,
                PRIMARY KEY(symbol, date)
            )
            """
        )
        cur.executemany(
            """
            INSERT INTO ai_predictions_v2(symbol, date, model_id, target_date, signal, confidence, layer1_status, validation_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("000001", "2026-03-03", "rule-engine", "2026-03-04", "Watch", 0.8, "Watch", "Pending"),
                ("000002", "2026-03-03", "rule-engine", "2026-03-04", "NoSetup", 0.6, "NoSetup", "Pending"),
                ("000003", "2026-03-03", "legacy-model", "2026-03-04", "Side", 0.5, None, "Pending"),
            ],
        )
        cur.executemany(
            "INSERT INTO daily_prices(symbol, date, change_percent, close) VALUES (?, ?, ?, ?)",
            [
                ("000001", "2026-03-04", 0.3, 10.0),
                ("000001", "2026-03-05", 0.8, 10.1),
                ("000001", "2026-03-06", 1.1, 10.2),
                ("000002", "2026-03-04", 0.2, 20.0),
                ("000002", "2026-03-05", -0.4, 19.9),
                ("000002", "2026-03-06", 0.1, 19.95),
                ("000003", "2026-03-04", 0.2, 30.0),
                ("000003", "2026-03-05", -0.2, 29.9),
                ("000003", "2026-03-06", 0.1, 29.95),
            ],
        )
        conn.commit()
        conn.close()

    def tearDown(self):
        import os

        try:
            os.remove(self.db_path)
        except OSError:
            pass

    def _run(self):
        def _next_trading_day(date_str, market=None):
            return (datetime.strptime(date_str, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")

        with patch("backend.engine.validator.get_connection", side_effect=lambda: sqlite3.connect(self.db_path)):
            with patch("backend.engine.validator.get_market_from_symbol", return_value="CN"):
                with patch("backend.engine.validator.is_trading_day", return_value=True):
                    with patch("backend.engine.validator.get_next_trading_day_str", side_effect=_next_trading_day):
                        return verify_all_pending(force=True, target_date="2026-03-04")

    def test_watch_uses_canonical_delayed_breakout_rule(self):
        self._run()
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT validation_status, validation_data FROM ai_predictions_v2 WHERE symbol = '000001'")
        status, raw = cur.fetchone()
        payload = json.loads(raw)
        self.assertEqual(status, "Correct")
        self.assertEqual(payload["effective_signal"], "Watch")
        self.assertEqual(payload["signal_family"], "canonical")
        self.assertEqual(payload["semantic_verdict"], "Validated")
        self.assertEqual(payload["reason_code"], "watch_delayed_breakout")
        conn.close()

    def test_nosetup_stays_validated_in_noise_band(self):
        self._run()
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT validation_status, validation_data FROM ai_predictions_v2 WHERE symbol = '000002'")
        status, raw = cur.fetchone()
        payload = json.loads(raw)
        self.assertEqual(status, "Correct")
        self.assertEqual(payload["effective_signal"], "NoSetup")
        self.assertEqual(payload["semantic_verdict"], "Validated")
        self.assertEqual(payload["reason_code"], "nosetup_true_neutral")
        conn.close()

    def test_legacy_side_keeps_legacy_path(self):
        self._run()
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT validation_status, validation_data FROM ai_predictions_v2 WHERE symbol = '000003'")
        status, raw = cur.fetchone()
        payload = json.loads(raw)
        self.assertEqual(status, "Correct")
        self.assertEqual(payload["effective_signal"], "Side")
        self.assertEqual(payload["signal_family"], "legacy")
        self.assertEqual(payload["reason_code"], "legacy_side_neutral")
        conn.close()
