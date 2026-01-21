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
        
        payload = self.manager._aggregate_notifications(user_id, events)
        
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
        
        payload = self.manager._aggregate_notifications(user_id, events)
        
        self.assertIn("2 只", payload["title"])
        self.assertIn("AAPL, TSLA", payload["body"])
        self.assertEqual(set(payload["related_symbols"]), {"AAPL", "TSLA"})

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


if __name__ == "__main__":
    unittest.main()
