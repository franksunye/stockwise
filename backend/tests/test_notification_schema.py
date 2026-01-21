"""
Unit tests for Notification System Database Schema.
Part of Phase 1: Database Schema Extension.
"""
import sys
import os
import unittest

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_connection, init_db


class TestNotificationSchema(unittest.TestCase):
    """Verify notification system tables are created correctly."""
    
    @classmethod
    def setUpClass(cls):
        """Ensure database is initialized before tests."""
        # Note: In CI, this will use Turso. Locally, uses SQLite.
        init_db()
    
    def setUp(self):
        self.conn = get_connection()
        self.cursor = self.conn.cursor()
    
    def tearDown(self):
        self.conn.close()
    
    def test_notification_logs_table_exists(self):
        """Verify notification_logs table is created."""
        self.cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='notification_logs'
        """)
        result = self.cursor.fetchone()
        self.assertIsNotNone(result, "notification_logs table should exist")
    
    def test_notification_logs_columns(self):
        """Verify notification_logs has expected columns."""
        self.cursor.execute("PRAGMA table_info(notification_logs)")
        columns = {row[1] if isinstance(row, tuple) else row['name'] for row in self.cursor.fetchall()}
        
        expected_columns = {'id', 'user_id', 'type', 'related_symbols', 'title', 'body', 'url', 'sent_at', 'clicked_at', 'channel'}
        self.assertTrue(expected_columns.issubset(columns), 
                        f"Missing columns: {expected_columns - columns}")
    
    def test_signal_states_table_exists(self):
        """Verify signal_states table is created."""
        self.cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='signal_states'
        """)
        result = self.cursor.fetchone()
        self.assertIsNotNone(result, "signal_states table should exist")
    
    def test_signal_states_columns(self):
        """Verify signal_states has expected columns."""
        self.cursor.execute("PRAGMA table_info(signal_states)")
        columns = {row[1] if isinstance(row, tuple) else row['name'] for row in self.cursor.fetchall()}
        
        expected_columns = {'user_id', 'symbol', 'last_signal', 'last_confidence', 'last_notified_at'}
        self.assertTrue(expected_columns.issubset(columns), 
                        f"Missing columns: {expected_columns - columns}")
    
    def test_notification_logs_insert_and_query(self):
        """Verify we can insert and query notification_logs."""
        import uuid
        test_id = f"test_{uuid.uuid4().hex[:8]}"
        
        try:
            self.cursor.execute("""
                INSERT INTO notification_logs (id, user_id, type, title, body, channel)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (test_id, "test_user", "signal_flip", "Test Title", "Test Body", "push"))
            self.conn.commit()
            
            self.cursor.execute("SELECT * FROM notification_logs WHERE id = ?", (test_id,))
            result = self.cursor.fetchone()
            self.assertIsNotNone(result, "Should be able to query inserted log")
        finally:
            # Cleanup
            self.cursor.execute("DELETE FROM notification_logs WHERE id = ?", (test_id,))
            self.conn.commit()
    
    def test_signal_states_upsert(self):
        """Verify signal_states supports upsert pattern (INSERT OR REPLACE)."""
        test_user = "test_user_signal"
        test_symbol = "00700"
        
        try:
            # First insert
            self.cursor.execute("""
                INSERT OR REPLACE INTO signal_states (user_id, symbol, last_signal, last_confidence)
                VALUES (?, ?, ?, ?)
            """, (test_user, test_symbol, "Buy", 0.8))
            self.conn.commit()
            
            self.cursor.execute("""
                SELECT last_signal, last_confidence FROM signal_states 
                WHERE user_id = ? AND symbol = ?
            """, (test_user, test_symbol))
            result = self.cursor.fetchone()
            self.assertEqual(result[0], "Buy")
            
            # Update via upsert
            self.cursor.execute("""
                INSERT OR REPLACE INTO signal_states (user_id, symbol, last_signal, last_confidence)
                VALUES (?, ?, ?, ?)
            """, (test_user, test_symbol, "Sell", 0.9))
            self.conn.commit()
            
            self.cursor.execute("""
                SELECT last_signal, last_confidence FROM signal_states 
                WHERE user_id = ? AND symbol = ?
            """, (test_user, test_symbol))
            result = self.cursor.fetchone()
            self.assertEqual(result[0], "Sell", "Signal should be updated to Sell")
            self.assertAlmostEqual(result[1], 0.9, places=1)
            
        finally:
            # Cleanup
            self.cursor.execute("DELETE FROM signal_states WHERE user_id = ?", (test_user,))
            self.conn.commit()
    
    def test_notification_logs_index_exists(self):
        """Verify index on notification_logs exists for efficient queries."""
        self.cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='index' AND name='idx_notif_logs_user_type'
        """)
        result = self.cursor.fetchone()
        self.assertIsNotNone(result, "Index idx_notif_logs_user_type should exist")


if __name__ == "__main__":
    unittest.main(verbosity=2)
