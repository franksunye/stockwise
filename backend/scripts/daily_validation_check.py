"""
Daily Validation Success Script.
Part of Phase 4: Scheduled Notifications.
Runs after market close, identifies correct AI predictions, and notifies users.
"""
import sys
import os
import json
from datetime import datetime

# Add backend to path (legacy support)
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
# Add project root to path (support 'backend.*' imports)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from notification_service import NotificationManager
from engine.validator import verify_all_pending


def run_validation_notifications(dry_run=False):
    """
    1. Update validation status in DB.
    2. Find successful predictions (Correct).
    3. Notify users with these stocks in watchlist.
    """
    logger.info(f"🏆 Starting Daily Validation Check (Dry Run: {dry_run})")
    
    # Step 1: Sync DB validation status
    try:
        verify_all_pending()
    except Exception as e:
        logger.error(f"❌ Failed to run verify_all_pending: {e}")
    
    # 🎯 方案二核心：基于业务日期（target_date）进行用户导向的通知
    # 获取北京时间的今天日期字符串
    from config import BEIJING_TZ
    today_str = datetime.now(BEIJING_TZ).strftime('%Y-%m-%d')
    logger.info(f"📅 Looking for successful predictions targeting: {today_str}")

    nm = NotificationManager(dry_run=dry_run)
    conn = get_connection()
    cursor = conn.cursor()
    
    # Step 2: Find 'Correct' predictions targeting TODAY
    cursor.execute("""
        SELECT symbol, signal, actual_change, date
        FROM ai_predictions_v2
        WHERE target_date = ? 
        AND validation_status = 'Correct' 
        AND is_primary = 1
        ORDER BY ABS(actual_change) DESC
    """, (today_str,))
    successes = cursor.fetchall()
    
    if not successes:
        logger.info(f"ℹ️ No 'Correct' predictions found for target_date {today_str}.")
        conn.close()
        return

    # Map stock to results for easy lookup
    success_map = {s[0]: {"signal": s[1], "change": s[2], "date": s[3]} for s in successes}
    valid_symbols = list(success_map.keys())

    # Step 3: Find users watching these symbols
    placeholders = ",".join(["?"] * len(valid_symbols))
    cursor.execute(f"""
        SELECT user_id, symbol FROM user_watchlist
        WHERE symbol IN ({placeholders})
    """, tuple(valid_symbols))
    user_symbol_pairs = cursor.fetchall()
    
    user_wins = {} # user_id -> List[symbol]
    for uid, sym in user_symbol_pairs:
        if uid not in user_wins:
            user_wins[uid] = []
        user_wins[uid].append(sym)
        
    # Step 4: Notify users
    for user_id, symbols in user_wins.items():
        if not symbols:
            continue
            
        win_details = [f"{s}({success_map[s]['change']:+.1f}%)" for s in symbols[:3]]
        
        title = "🏅 AI 预测验证成功!"
        body = f"昨日为您追踪的 {', '.join(win_details)} 走势符合 AI 预期。点击查看复盘对比。"
        url = "/dashboard?utm_source=push&utm_medium=validation_glory"
        
        nm.queue_notification(user_id, "validation_glory", {
            "title": title,
            "body": body,
            "url": url,
            "related_symbols": symbols
        })

    total_sent = nm.flush()
    logger.info(f"✅ Validation Notification Task Finished. Delivered: {total_sent}")
    conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Simulate without sending")
    args = parser.parse_args()
    
    run_validation_notifications(dry_run=args.dry_run)
