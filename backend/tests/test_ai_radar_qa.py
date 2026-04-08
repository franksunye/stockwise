
import sys
import os
import time
import json
import sqlite3
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime

# Setup project paths
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)

# Mocked/Target imports
from backend.sync.intraday_monitor import IntradayMonitor
from backend.notification_service import NotificationManager
from backend.notification_templates import NotificationTemplates

class TestAiRadarQA(unittest.TestCase):
    
    def setUp(self):
        """Reset the Singleton and alert history for clean tests."""
        IntradayMonitor._instance = None
        self.radar = IntradayMonitor()
        # Mock the notification manager to avoid real HTTP/DB calls
        self.radar.notif_manager = MagicMock(spec=NotificationManager)
        self.radar.alert_history = {}
        
    def test_logic_resonance_bullish(self):
        """Scenario: Bullish prediction + price breakout = Resonance."""
        symbol = "00700.HK"
        strategy = {
            "signal": "TriggeredLong",
            "weight": 1,
            "pressure": 400.0,
            "support": 380.0
        }
        self.radar.watch_list[symbol] = strategy
        
        # Test: Price is below resistance (Normal)
        self.radar.check(symbol, 395.0, 1.2)
        self.radar.notif_manager.broadcast_price_alert.assert_not_called()
        
        # Test: Price breaks resistance (Resonance)
        self.radar.check(symbol, 405.0, 3.5)
        
        # Check if broadcast was called (Wait for thread or mock Thread)
        # For simplicity in this test, we verify _trigger_alert was called with 'resonance'
        # Since _trigger_alert calls broadcast in a thread, we'll verify the alert_history
        today = datetime.now().strftime("%Y%m%d")
        dedup_key = f"{symbol}_resonance_{today}"
        self.assertIn(dedup_key, self.radar.alert_history)

    def test_logic_deviation_bullish(self):
        """Scenario: Bullish prediction + price breakdown = Deviation."""
        symbol = "700.HK"
        strategy = {
            "signal": "TriggeredLong",
            "weight": 1,
            "pressure": 400.0,
            "support": 380.0
        }
        self.radar.watch_list[symbol] = strategy
        
        # Test: Price drops below support (Deviation)
        self.radar.check(symbol, 375.0, -2.5)
        
        today = datetime.now().strftime("%Y%m%d")
        dedup_key = f"{symbol}_deviation_{today}"
        self.assertIn(dedup_key, self.radar.alert_history)

    def test_logic_resonance_bearish(self):
        """Scenario: Bearish prediction + further breakdown = Resonance(Downwards)."""
        symbol = "9988.HK"
        strategy = {
            "signal": "RiskOff",
            "weight": -1,
            "pressure": 85.0,
            "support": 75.0
        }
        self.radar.watch_list[symbol] = strategy
        
        # Test: Price drops below bearish support (Confirmed Trend)
        self.radar.check(symbol, 74.0, -1.2)
        
        today = datetime.now().strftime("%Y%m%d")
        dedup_key = f"{symbol}_resonance_{today}"
        self.assertIn(dedup_key, self.radar.alert_history)

    @patch("backend.sync.intraday_monitor.threading.Thread")
    def test_bearish_resonance_message_uses_support_break(self, mock_thread):
        """Bearish resonance should say breakdown of support, not pressure breakout."""
        symbol = "300059"
        strategy = {
            "signal": "RiskOff",
            "weight": -1,
            "pressure": 20.08,
            "support": 20.08,
        }
        self.radar.watch_list[symbol] = strategy

        # Execute threaded send inline for deterministic assertion.
        def _inline_thread(*args, **kwargs):
            target = kwargs.get("target")
            t_args = kwargs.get("args", ())
            class _T:
                def start(self_nonlocal):
                    target(*t_args)
            return _T()
        mock_thread.side_effect = _inline_thread

        self.radar.check(symbol, 18.45, -3.2)
        self.assertTrue(self.radar.notif_manager.broadcast_price_alert.called)

        _, call_args, _ = self.radar.notif_manager.broadcast_price_alert.mock_calls[0]
        context = call_args[2]
        self.assertIn("跌破了关键支撑位", context.get("strategy_tip", ""))
        self.assertNotIn("突破了关键压力点", context.get("strategy_tip", ""))

    def test_radar_silence_on_watch(self):
        """Scenario: 'Watch' or 'Side' signals should not trigger radar alerts (Noise reduction)."""
        symbol = "BABA"
        strategy = {
            "signal": "Watch",
            "weight": 0,
            "pressure": 100.0,
            "support": 80.0
        }
        self.radar.watch_list[symbol] = strategy
        
        # Test: Price breaks extremes but signal is 'Watch'
        self.radar.check(symbol, 105.0, 5.0)
        self.radar.check(symbol, 75.0, -5.0)
        
        self.assertEqual(len(self.radar.alert_history), 0, "Watch signals should remain silent on radar.")

    def test_template_payload_accuracy(self):
        """Verify that ai_radar_alert template produces correct JSON payload."""
        nt = NotificationTemplates()
        
        title, body = nt.render(
            "ai_radar_alert",
            tier="pro",
            stock_names="腾讯控股",
            current_price="405.20",
            resonance_type="逻辑共振",
            strategy_tip="突破了关键压力点 400.00"
        )
        
        # Check if resonance logic is in text
        self.assertIn("共振", title)
        self.assertIn("405.20", body)
        self.assertIn("400.00", body)
        
        title_dev, body_dev = nt.render(
            "ai_radar_alert",
            tier="pro",
            stock_names="腾讯控股",
            current_price="375.00",
            resonance_type="剧本背离",
            strategy_tip="回撤并跌破了止损支撑线 380.00"
        )
        # Check if deviation logic is in text
        self.assertIn("背离", title_dev)
        self.assertIn("375.00", body_dev)
        self.assertIn("380.00", body_dev)

    @patch('backend.sync.intraday_monitor.get_connection')
    def test_load_rules_query_shape(self, mock_get_conn):
        """Verify that load_rules queries the right table with correct filters."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        
        # Mock DB response
        mock_cursor.fetchall.return_value = [
            ("700.HK", "TriggeredLong", 0.9, 350.0, 400.0, "Reason text", "2024-05-01")
        ]
        
        self.radar.load_rules()
        
        # Assertions
        # 1. Check if signal_weight was used to parse Signal
        self.assertEqual(self.radar.watch_list["700.HK"]["weight"], 1) # TriggeredLong weight
        # 2. Check if query contains version 2 table and primary filter
        args, _ = mock_cursor.execute.call_args
        sql = args[0].lower()
        self.assertIn("ai_predictions_v2", sql)
        self.assertIn("is_primary = 1", sql)

if __name__ == "__main__":
    unittest.main()
