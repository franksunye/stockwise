
import sys
import os
import json
import uuid
from datetime import datetime

# Add project root to path
backend_path = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(backend_path)
sys.path.insert(0, project_root)
sys.path.insert(0, backend_path)

from backend.notification_templates import NotificationTemplates
from backend.notification_service import NotificationManager
from backend.logger import logger

def test_template_rendering():
    logger.info("🧪 Testing Template Rendering...")
    
    test_cases = [
        ("daily_brief", "free", {"push_hook": "📈 2 stocks bullish"}),
        ("daily_brief", "pro", {"push_hook": "📈 2 stocks bullish"}),
        ("signal_flip", "free", {"symbol": "AAPL", "old_signal": "Hold", "new_signal": "Buy", "confidence_pct": 85}),
        ("signal_flip", "pro", {"symbol": "AAPL", "old_signal": "Hold", "new_signal": "Buy", "confidence_pct": 85}),
        ("prediction_updated", "free", {"market_name": "HK 市场"}),
        ("admin_task_report", "all", {
            "task_title": "Test Task", "status": "✅ SUCCESS", 
            "total": 10, "success": 10, "ai": 8, "rule": 2, 
            "failed": 0, "duration": 45.5
        })
    ]
    
    for ntype, tier, kwargs in test_cases:
        title, body = NotificationTemplates.render(ntype, tier=tier, **kwargs)
        logger.info(f"  [{ntype}] ({tier})")
        logger.info(f"    Title: {title}")
        logger.info(f"    Body:  {body}")
        assert "{" not in title and "{" not in body, f"❌ Placeholder remains in {ntype}"
    
    logger.info("✅ Template Rendering Tests Passed!")

def test_notification_manager_flow():
    logger.info("🧪 Testing NotificationManager Flow (Dry Run)...")
    
    # Use a dummy user
    test_uid = f"test_user_{uuid.uuid4().hex[:6]}"
    
    nm = NotificationManager(dry_run=True)
    
    # 1. Queue multiple notifications
    nm.queue_notification(test_uid, "prediction_updated", {"symbol": "700.HK", "market": "HK"})
    nm.queue_notification(test_uid, "prediction_updated", {"symbol": "3690.HK", "market": "HK"})
    nm.queue_notification(test_uid, "signal_flip", {
        "symbol": "700.HK", "old_signal": "Neutral", "new_signal": "Bullish", "confidence": 0.88
    })
    
    logger.info(f"  Queued {len(nm.queued_notifications[test_uid])} notifications for {test_uid}")
    
    # 2. Flush and check aggregation
    # Note: In our current logic, aggregation prioritizes Morning Call -> Signal Flip -> Validation -> Updates
    sent_count = nm.flush()
    
    logger.info(f"  Flushed. Sent count: {sent_count}")
    # In aggregation logic: Signal Flip has higher priority than prediction_updated
    # So for this test, we expect ONE notification sent (the Flip one)
    assert sent_count == 1, f"Expected 1 aggregated notification, got {sent_count}"
    
    logger.info("✅ NotificationManager Logic Tests Passed!")

if __name__ == "__main__":
    try:
        test_template_rendering()
        print("\n" + "="*50 + "\n")
        test_notification_manager_flow()
        print("\n" + "="*50 + "\n")
        logger.info("🚀 ALL QUALITY ASSURANCE TESTS PASSED!")
    except Exception as e:
        logger.error(f"❌ QA TEST FAILED: {e}")
        sys.exit(1)
