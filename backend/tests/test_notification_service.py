"""
Unit tests for NotificationManager.
Part of Phase 2: NotificationManager Core.
"""
import sys
import os
import unittest
import json
from unittest.mock import MagicMock, patch

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from notification_service import NotificationManager
from notification_templates import NotificationTemplates


class TestNotificationService(unittest.TestCase):
    """Verify NotificationManager logic and behavior."""

    def setUp(self):
        # We use dry_run to avoid actual API calls
        # We'll use a mock connection to verify SQL calls
        self.mock_conn = MagicMock()
        self.manager = NotificationManager(conn=self.mock_conn, dry_run=True)

    def test_no_flip_when_signal_unchanged(self):
        """Should NOT trigger notification if signal remains the same."""
        user_id = "user1"
        symbol = "AAPL"
        
        # Manually seed cache
        self.manager.signal_cache = {
            user_id: {
                symbol: {"signal": "Long", "confidence": 0.8}
            }
        }
        
        event = self.manager.check_signal_flip(user_id, symbol, "Long", 0.85)
        
        self.assertIsNone(event)
        self.assertEqual(len(self.manager.queued_notifications), 0)
        self.assertEqual(self.manager.stats["processed"], 1)
        self.assertEqual(self.manager.stats["flips_detected"], 0)

    def test_flip_detected_on_signal_change(self):
        """Should trigger notification if signal changes from Side to Long."""
        user_id = "user1"
        symbol = "AAPL"
        
        self.manager.signal_cache = {
            user_id: {
                symbol: {"signal": "Side", "confidence": 0.5}
            }
        }
        
        event = self.manager.check_signal_flip(user_id, symbol, "Long", 0.9)
        
        self.assertIsNotNone(event)
        self.assertEqual(event["old_signal"], "Side")
        self.assertEqual(event["new_signal"], "Long")
        self.assertEqual(len(self.manager.queued_notifications[user_id]), 1)
        self.assertEqual(self.manager.stats["flips_detected"], 1)

    def test_aggregation_single_flip(self):
        """Verify content for a single stock flip."""
        user_id = "user1"
        events = [
            {"type": "signal_flip", "symbol": "AAPL", "old_signal": "Side", "new_signal": "Long", "confidence": 0.9}
        ]
        
        payload = self.manager._aggregate_notifications(
            user_id,
            events,
            user_profile={"tier": "free", "locale": "zh"},
        )
        
        self.assertIn("AAPL", payload["title"])
        self.assertIn("[Side]", payload["body"])
        self.assertIn("[Long]", payload["body"])
        self.assertEqual(payload["related_symbols"], ["AAPL"])

    def test_aggregation_multiple_flips(self):
        """Verify batch aggregation for multiple stock flips."""
        user_id = "user1"
        events = [
            {"type": "signal_flip", "symbol": "AAPL", "old_signal": "Side", "new_signal": "Long", "confidence": 0.9},
            {"type": "signal_flip", "symbol": "TSLA", "old_signal": "Long", "new_signal": "Short", "confidence": 0.8}
        ]
        
        payload = self.manager._aggregate_notifications(
            user_id,
            events,
            user_profile={"tier": "free", "locale": "zh"},
        )
        
        self.assertIn("2 只", payload["title"])
        self.assertIn("AAPL, TSLA", payload["body"])
        self.assertEqual(set(payload["related_symbols"]), {"AAPL", "TSLA"})

    def test_aggregation_multiple_flips_prefers_stock_names_in_body(self):
        """Batch signal-flip body should use stock names, not raw codes."""
        user_id = "user1"
        events = [
            {"type": "signal_flip", "symbol": "600519", "old_signal": "Neutral", "new_signal": "Bullish", "confidence": 0.9},
            {"type": "signal_flip", "symbol": "300750", "old_signal": "Neutral", "new_signal": "Bullish", "confidence": 0.8}
        ]

        with patch.object(self.manager, '_resolve_stock_display_names', return_value=["贵州茅台", "宁德时代"]):
            payload = self.manager._aggregate_notifications(
                user_id,
                events,
                user_profile={"tier": "free", "locale": "zh"},
            )

        self.assertIn("贵州茅台, 宁德时代", payload["body"])

    def test_price_update_template_title_prefers_name_without_symbol_code(self):
        """Price update title should prioritize stock name readability."""
        title, body = NotificationTemplates.render(
            "price_update",
            tier="free",
            lang="zh",
            stock_name="腾讯控股",
            symbol="0700.HK",
            emoji="📈",
            change_pct="+1.23",
            price=512.3,
            volume_formatted="1.2M",
        )
        self.assertEqual(title, "腾讯控股 📈 +1.23%")
        self.assertNotIn("0700.HK", title)
        self.assertIn("最新:", body)

    def test_price_update_template_formats_english_price_without_float_tail(self):
        """English price notifications should not expose raw float precision noise."""
        title, body = NotificationTemplates.render(
            "price_update",
            tier="free",
            lang="en",
            stock_name="Tencent",
            symbol="0700.HK",
            emoji="📈",
            change_pct="+1.23",
            price=512.3000000000001,
            volume_formatted="1.2M",
        )
        self.assertEqual(title, "Tencent 📈 +1.23%")
        self.assertIn("Last: 512.3", body)
        self.assertNotIn("512.3000000000001", body)

    def test_aggregation_daily_brief_variant(self):
        """Daily brief variants should be aggregated and rendered."""
        user_id = "user1"
        events = [
            {"type": "daily_brief_bullish", "push_hook": "📈 测试股票出现上行动能", "url": "/dashboard?brief=true"}
        ]

        payload = self.manager._aggregate_notifications(user_id, events, user_tier="pro")
        self.assertIsNotNone(payload)
        self.assertEqual(payload["type"], "daily_brief_bullish")
        self.assertIn("机会", payload["title"])
        self.assertIn("上行动能", payload["body"])

    def test_log_to_db_called(self):
        """Verify that analytics logging hits the database."""
        payload = {
            "title": "Test", "body": "Body", "url": "/test", 
            "type": "test_type", "related_symbols": ["ABC"]
        }
        
        self.manager._log_to_db("test_id", "user1", payload)
        
        # Check cursor execution
        cursor = self.mock_conn.cursor()
        cursor.execute.assert_called()
        args, _ = cursor.execute.call_args
        self.assertIn("INSERT INTO notification_logs", args[0])
        self.assertIn("test_id", args[1])

    def test_persist_signal_states(self):
        """Verify batch persistence of state updates."""
        self.manager.pending_state_updates = [
            {"user_id": "u1", "symbol": "S1", "signal": "Long", "confidence": 0.9},
            {"user_id": "u2", "symbol": "S2", "signal": "Short", "confidence": 0.7}
        ]
        
        self.manager._persist_signal_states()
        
        cursor = self.mock_conn.cursor()
        self.assertEqual(cursor.execute.call_count, 2)
        args, _ = cursor.execute.call_args
        self.assertIn("INSERT OR REPLACE INTO signal_states", args[0])

    def test_preference_mapping_daily_brief_variant(self):
        """daily_brief variants should follow daily_brief preference key."""
        settings = {
            "enabled": True,
            "types": {
                "daily_brief": {"enabled": False}
            }
        }
        cursor = self.mock_conn.cursor()
        cursor.fetchone.return_value = (json.dumps(settings),)

        allowed = self.manager._check_user_preference("user1", "daily_brief_bearish")
        self.assertFalse(allowed)

    def test_signal_alias_compatibility(self):
        """Legacy signal names (Side/Long/Short) should still trigger flip logic."""
        user_id = "user1"
        symbol = "AAPL"
        self.manager.signal_cache = {
            user_id: {
                symbol: {"signal": "Side", "confidence": 0.5}
            }
        }

        event = self.manager.check_signal_flip(user_id, symbol, "Long", 0.88)
        self.assertIsNotNone(event)
        self.assertEqual(event["new_signal"], "Long")

    def test_flush_workflow(self):
        """Verify end-to-end flush logic."""
        user_id = "user1"
        self.manager.queued_notifications = {
            user_id: [{"type": "signal_flip", "symbol": "AAPL", "old_signal": "Side", "new_signal": "Long", "confidence": 0.9}]
        }
        self.manager.pending_state_updates = [{"user_id": user_id, "symbol": "AAPL", "signal": "Long", "confidence": 0.9}]
        
        with patch('notification_service.send_push_notification') as mock_push:
            sent_count = self.manager.flush()
            
            self.assertEqual(sent_count, 1)
            self.assertEqual(len(self.manager.queued_notifications), 0)
            self.assertEqual(len(self.manager.pending_state_updates), 0)
            # NotificationManager calls send_push_notification internally unless dry_run (set in constructor)
            # Wait, in this test setup dry_run=True, so it shouldn't call mock_push
            mock_push.assert_not_called()

    def test_send_notification_should_fail_when_push_not_delivered(self):
        """Push API returning False must not be treated as a successful delivery."""
        manager = NotificationManager(conn=self.mock_conn, dry_run=False)
        with patch.object(manager, '_check_user_preference', return_value=True), \
             patch('notification_service.send_push_notification', return_value=False), \
             patch.object(manager, '_log_to_db') as mock_log:
            ok = manager._send_notification("user1", {
                "title": "测试",
                "body": "内容",
                "url": "/dashboard",
                "type": "daily_brief",
                "related_symbols": []
            })

        self.assertFalse(ok)
        mock_log.assert_not_called()

    def test_send_notification_should_skip_when_user_disabled_type(self):
        """Disabled user preferences must skip delivery and logging."""
        manager = NotificationManager(conn=self.mock_conn, dry_run=False)
        with patch.object(manager, '_check_user_preference', return_value=False), \
             patch('notification_service.send_push_notification') as mock_push, \
             patch.object(manager, '_log_to_db') as mock_log:
            ok = manager._send_notification("user1", {
                "title": "测试",
                "body": "内容",
                "url": "/dashboard",
                "type": "daily_brief",
                "related_symbols": []
            })

        self.assertFalse(ok)
        self.assertEqual(manager.stats["skipped_by_preference"], 1)
        mock_push.assert_not_called()
        mock_log.assert_not_called()

    def test_ai_radar_alert_preference_mapping(self):
        """盘中结构雷达 should follow its own ai_radar_alert preference key."""
        settings = {
            "enabled": True,
            "types": {
                "ai_radar_alert": {"enabled": False},
                "price_update": {"enabled": True},
            },
        }
        cursor = self.mock_conn.cursor()
        cursor.fetchone.return_value = (json.dumps(settings),)

        self.assertFalse(self.manager._check_user_preference("user1", "ai_radar_alert"))
        self.assertTrue(self.manager._check_user_preference("user1", "price_update"))

    def test_radar_cooldown_uses_notification_logs_for_same_day_symbol(self):
        """Existing ai_radar_alert log for the same user/symbol/day should suppress duplicates."""
        cursor = self.mock_conn.cursor.return_value
        cursor.fetchall.return_value = [(json.dumps(["700.HK"]),)]

        self.assertTrue(self.manager._has_radar_alert_cooldown("user1", "700.HK"))
        self.assertFalse(self.manager._has_radar_alert_cooldown("user1", "9988.HK"))

    def test_broadcast_ai_radar_blocks_free_users(self):
        """Free users should not receive paid-only ai_radar_alert broadcasts."""
        cursor = self.mock_conn.cursor.return_value
        cursor.fetchall.return_value = [("user_free",)]
        manager = NotificationManager(conn=self.mock_conn, dry_run=False)

        with patch('notification_service.get_connection', return_value=self.mock_conn), \
             patch.object(manager, '_has_push_subscription', return_value=True), \
             patch.object(manager, '_get_user_profile', return_value={"tier": "free", "locale": "cn"}), \
             patch.object(manager, '_check_user_preference', return_value=True), \
             patch('notification_service.send_push_notification') as mock_push:
            manager.broadcast_price_alert("700.HK", "ai_radar_alert", {
                "stock_names": "700.HK",
                "current_price": "400.00",
                "resonance_type": "逻辑共振",
                "strategy_tip": "突破关键压力位",
                "url": "/dashboard?symbol=700.HK",
            }, tag="ai_radar_alert")

        mock_push.assert_not_called()

    def test_advanced_notification_tiers_are_explicitly_paid(self):
        """go/plus/pro/alpha are paid tiers for advanced alerts; free or unknown tiers are blocked."""
        manager = NotificationManager(conn=self.mock_conn, dry_run=False)

        for tier in ("go", "plus", "pro", "alpha", "premium"):
            self.assertFalse(
                manager._is_advanced_notification_blocked("user1", "ai_radar_alert", tier=tier),
                f"{tier} should receive paid radar alerts",
            )

        for tier in ("free", "trial", "", None):
            self.assertTrue(
                manager._is_advanced_notification_blocked("user1", "ai_radar_alert", tier=tier),
                f"{tier} should not receive paid radar alerts",
            )

    def test_broadcast_ai_radar_respects_daily_cooldown(self):
        """Pro users should not receive duplicate ai_radar_alert when log cooldown is active."""
        cursor = self.mock_conn.cursor.return_value
        cursor.fetchall.return_value = [("user_pro",)]
        manager = NotificationManager(conn=self.mock_conn, dry_run=False)

        with patch('notification_service.get_connection', return_value=self.mock_conn), \
             patch.object(manager, '_has_push_subscription', return_value=True), \
             patch.object(manager, '_get_user_profile', return_value={"tier": "pro", "locale": "cn"}), \
             patch.object(manager, '_check_user_preference', return_value=True), \
             patch.object(manager, '_has_radar_alert_cooldown', return_value=True), \
             patch('notification_service.send_push_notification') as mock_push:
            manager.broadcast_price_alert("700.HK", "ai_radar_alert", {
                "stock_names": "700.HK",
                "current_price": "400.00",
                "resonance_type": "逻辑共振",
                "strategy_tip": "突破关键压力位",
                "url": "/dashboard?symbol=700.HK",
            }, tag="ai_radar_alert")

        mock_push.assert_not_called()

    def test_broadcast_price_update_not_blocked_by_advanced_guard(self):
        """Regular price_update should remain available to free users when enabled."""
        cursor = self.mock_conn.cursor.return_value
        cursor.fetchall.return_value = [("user_free",)]
        manager = NotificationManager(conn=self.mock_conn, dry_run=False)

        with patch('notification_service.get_connection', return_value=self.mock_conn), \
             patch.object(manager, '_has_push_subscription', return_value=True), \
             patch.object(manager, '_get_user_profile', return_value={"tier": "free", "locale": "cn"}), \
             patch.object(manager, '_check_user_preference', return_value=True), \
             patch('notification_service.send_push_notification', return_value=True) as mock_push:
            manager.broadcast_price_alert("700.HK", "price_update", {
                "stock_name": "腾讯控股",
                "symbol": "700.HK",
                "emoji": "📈",
                "change_pct": "+1.20",
                "price": 400.0,
                "volume_formatted": "1.2M",
                "url": "/dashboard/stock/700.HK",
            }, tag="price_update")

        mock_push.assert_called_once()

    def test_send_notification_should_append_tracking_id_before_logging(self):
        """Successful sends should append nid to URL before logging."""
        manager = NotificationManager(conn=self.mock_conn, dry_run=False)
        with patch.object(manager, '_check_user_preference', return_value=True), \
             patch('notification_service.send_push_notification', return_value=True), \
             patch.object(manager, '_log_to_db') as mock_log:
            ok = manager._send_notification("user1", {
                "title": "测试",
                "body": "内容",
                "url": "/dashboard?brief=true",
                "type": "daily_brief",
                "related_symbols": []
            })

        self.assertTrue(ok)
        logged_payload = mock_log.call_args.args[2]
        self.assertIn("nid=", logged_payload["url"])
        self.assertIn("brief=true", logged_payload["url"])


if __name__ == "__main__":
    unittest.main()
