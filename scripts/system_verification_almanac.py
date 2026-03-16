import sys
import os
import unittest
from unittest.mock import patch, MagicMock
import pandas as pd
import requests

# Path setup
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

from engine.market_facts_service import _fetch_a_spot
from context.provider import MarketContextProvider
from notifications import send_push_notification

class TestSystemResilience(unittest.TestCase):

    @patch('engine.market_facts_service.ak')
    def test_sina_fallback_on_em_failure(self, mock_ak):
        """
        [Audit Patch 3] Verify that if Eastmoney fails, we fall back to Sina and normalize columns.
        """
        # 1. Setup EM failure
        mock_ak.stock_zh_a_spot_em.side_effect = requests.exceptions.ConnectionError("Remote end closed connection")
        
        # 2. Setup Sina success with its specific schema
        sina_data = pd.DataFrame([{
            "code": "000001",
            "name": "平安银行",
            "trade": 10.5,
            "changepercent": 2.5,
            "amount": 1000000000,
            "turnoverratio": 1.2
        }])
        mock_ak.stock_zh_a_spot.return_value = sina_data
        
        # 3. Execute
        df, meta = _fetch_a_spot()
        
        # 4. Verify
        self.assertIsNotNone(df)
        self.assertEqual(meta["source"], "akshare:stock_zh_a_spot")
        self.assertIn("成交额", df.columns) # Normalized column
        self.assertIn("最新价", df.columns) # Normalized column
        self.assertEqual(df["成交额"].iloc[0], 1000000000)
        print("✅ Patch 3 Verified: Sina Fallback & Normalization successful.")

    @patch('context.provider.MarketContextProvider._get_executor')
    def test_timeout_enforcement(self, mock_get_executor):
        """
        [Audit Patch 4] Verify _safe_ak_fetch uses the increased 60s timeout.
        """
        provider = MarketContextProvider()
        mock_executor = MagicMock()
        mock_future = MagicMock()
        mock_get_executor.return_value = mock_executor
        mock_executor.submit.return_value = mock_future
        
        # Test function
        def mock_func(): return "ok"
        
        # Call with default timeout
        provider._safe_ak_fetch(mock_func)
        
        # Verify that future.result was called with 60
        mock_future.result.assert_called_with(timeout=60)
        print("✅ Patch 4 Verified: 60s Timeout correctly enforced by default.")

    @patch('notifications.requests.post')
    @patch.dict(os.environ, {"INTERNAL_API_SECRET": "test_secret", "NEXT_PUBLIC_SITE_URL": "https://test.com"})
    def test_notification_secret_usage(self, mock_post):
        """
        [Audit Patch 1] Verify that push notification correctly sends the secret.
        """
        mock_post.return_value.status_code = 200
        
        success = send_push_notification("Title", "Body", target_user_id="user_123")
        
        self.assertTrue(success)
        # Check that Authorization header was sent
        args, kwargs = mock_post.call_args
        headers = kwargs.get('headers', {})
        self.assertEqual(headers.get("Authorization"), "Bearer test_secret")
        print("✅ Patch 1 Verified: Notification secrets correctly included in headers.")

if __name__ == "__main__":
    unittest.main()
