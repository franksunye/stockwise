
import sys
import os
import unittest
import json
from unittest.mock import MagicMock, patch
from datetime import datetime

# Setup project paths
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)

from backend.notification_templates import NotificationTemplates
from backend.notification_service import NotificationManager

class TestNotificationMasterQA(unittest.TestCase):
    """
    System-wide Quality Assurance for all enabled notifications in StockWise.
    Covers template integrity, business logic triggers, and preference compliance.
    """

    def setUp(self):
        self.nt = NotificationTemplates()
        self.mock_conn = MagicMock()
        self.nm = NotificationManager(conn=self.mock_conn, dry_run=True)

    # --- T1: Template Walk (Integrity) ---

    def test_all_templates_renderable(self):
        """Verify that every template in TEMPLATES can be rendered without KeyError."""
        
        # Comprehensive mock data covering all known placeholders
        mock_data = {
            "push_hook": "📈 AAPL & TSLA bullish",
            "symbol": "700.HK",
            "symbols": "700.HK, 9988.HK",
            "old_signal": "Watch",
            "new_signal": "TriggeredLong",
            "confidence_pct": 88,
            "count": 3,
            "sentiment_tag": "偏多",
            "stock_names": "腾讯控股, 阿里巴巴",
            "peak_gain": 5.2,
            "market_name": "HK股市",
            "action_count": 2,
            "emoji": "🚀",
            "change_pct": 2.5,
            "price": "405.00",
            "current_price": "405.00",
            "volume_formatted": "1.2B",
            "resonance_type": "逻辑共振",
            "strategy_tip": "突破压力位，关注波动。",
            "mood_tag": "宜进取",
            "strategy": "做多",
            "insight_snippet": "主力资金流入明显",
            "stocks": "腾讯控股",
            "etc": "等",
            "task_title": "Daily AI Sync",
            "status": "✅ SUCCESS",
            "total": 100,
            "success": 98,
            "ai": 90,
            "rule": 8,
            "failed": 2,
            "duration": 12.5,
            "stock_name": "腾讯控股"
        }

        results = {"passed": 0, "failed": 0, "errors": []}

        for ntype, data in self.nt.TEMPLATES.items():
            for tier in data.keys():
                for lang in data[tier].keys():
                    try:
                        title, body = self.nt.render(ntype, tier=tier, lang=lang, **mock_data)
                        
                        # Basic safety checks
                        self.assertIsInstance(title, str)
                        self.assertIsInstance(body, str)
                        
                        # Check for residual placeholders (e.g. "{xxx}")
                        if "{" in title or "}" in title or "{" in body or "}" in body:
                            results["errors"].append(f"Residual placeholder in '{ntype}' ({tier}/{lang})")
                            results["failed"] += 1
                        else:
                            results["passed"] += 1
                            
                    except Exception as e:
                        results["errors"].append(f"Render FAILED for '{ntype}' ({tier}/{lang}): {e}")
                        results["failed"] += 1

        print(f"\n📊 Template Walk Results: {results['passed']} Passed, {results['failed']} Failed")
        for err in results["errors"]:
            print(f"  ❌ {err}")
            
        self.assertEqual(results["failed"], 0, "Some templates failed rendering or had residual placeholders.")

    # --- T2: Business Logic (Service Triggers) ---

    def test_preference_interception(self):
        """Verify that NotificationManager correctly honors user toggles."""
        user_id = "test_user_123"
        
        # Mock settings: disabled 'daily_brief'
        mock_settings = {
            "enabled": True,
            "types": {
                "daily_brief": {"enabled": False},
                "signal_flip": {"enabled": True}
            }
        }
        
        # Set up mock DB response for preference check
        mock_cursor = self.mock_conn.cursor()
        mock_cursor.fetchone.return_value = (json.dumps(mock_settings),)
        
        # We need dry_run=False but mock the push function to test the routing
        self.nm.dry_run = False
        
        with patch('backend.notification_service.send_push_notification', return_value=True):
            # 1. Try sending disabled type
            payload_disabled = {"type": "daily_brief", "title": "T", "body": "B", "url": "/u", "related_symbols": []}
            res = self.nm._send_notification(user_id, payload_disabled)
            self.assertFalse(res, "Notification should be blocked by preference.")
            
            # 2. Try sending enabled type
            payload_enabled = {"type": "signal_flip", "title": "T", "body": "B", "url": "/u", "related_symbols": []}
            res = self.nm._send_notification(user_id, payload_enabled)
            self.assertTrue(res, "Notification should be allowed by preference.")

    def test_aggregation_and_priority(self):
        """Verify that higher priority notifications (Almanac/Morning Call) displace lower ones."""
        user_id = "u1"
        
        # Mix of events with different implied priorities
        events = [
            {"type": "daily_brief", "push_hook": "Recap"},
            {"type": "morning_call", "sentiment_tag": "Bullish", "stock_names": "S1"},
            {"type": "prediction_updated_alert", "market_name": "HK", "action_count": 5}
        ]
        
        # Aggregate with Pro tier
        payload = self.nm._aggregate_notifications(user_id, events, user_tier="pro")
        
        # Priority Check: Morning Call should win over Daily Brief/Updates
        self.assertEqual(payload["type"], "morning_call", "Morning Call should have higher priority in aggregation.")
        self.assertIn("简报", payload["title"])

    # --- T3: Intraday Radar Logic Verification ---

    def test_radar_resonance_logic(self):
        """Deep check on the new Radar Resonance logic."""
        from backend.sync.intraday_monitor import IntradayMonitor
        
        # Reset and mock Radar
        IntradayMonitor._instance = None
        radar = IntradayMonitor()
        radar.notif_manager = MagicMock()
        
        # Mock a bullish strategy
        radar.watch_list = {
            "700.HK": {
                "signal": "TriggeredLong",
                "weight": 1,
                "pressure": 350.0,
                "support": 330.0
            }
        }
        
        # Cross Resistance -> Resonance
        radar.check("700.HK", 355.0, 2.0)
        
        # Verify trigger
        today = datetime.now().strftime("%Y%m%d")
        dedup_key = f"700.HK_resonance_{today}"
        self.assertIn(dedup_key, radar.alert_history)

if __name__ == "__main__":
    unittest.main()
