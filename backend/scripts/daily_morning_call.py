"""
Daily Morning Call Script.
Part of Phase 4: Scheduled Notifications.
Sends a 08:30 morning briefing to users with AI plans and market sentiment.
"""
import sys
import os
import json
from datetime import datetime, timedelta

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_connection
from logger import logger
from notification_service import NotificationManager
from config import BEIJING_TZ


def generate_morning_calls(dry_run=False, target_date=None):
    """
    Generate and send personalized morning calls for all active users.
    """
    today_str = target_date or datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
    logger.info(f"🌅 Starting Daily Morning Call generation for {today_str} (Dry Run: {dry_run})")
    
    nm = NotificationManager(dry_run=dry_run)
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Fetch Market Sentiment (from latest stock analysis)
    # The daily_briefs table doesn't have a 'type' column - it's user-specific
    # Use stock_briefs for a sample market sentiment instead
    cursor.execute("""
        SELECT analysis_markdown FROM stock_briefs 
        WHERE date = ? ORDER BY created_at DESC LIMIT 1
    """, (today_str,))
    brief_row = cursor.fetchone()
    market_sentiment = brief_row[0] if brief_row else "市场情绪稳定，关注 AI 交易计划。"
    
    # Extract just a snippet for the body
    sentiment_snippet = market_sentiment[:100] + "..." if len(market_sentiment) > 100 else market_sentiment

    # 2. Get Users with Watchlists
    cursor.execute("""
        SELECT DISTINCT user_id FROM user_watchlist
    """)
    users = [row[0] for row in cursor.fetchall()]
    
    sent_count = 0
    for user_id in users:
        # Fetch user's watchlist symbols
        cursor.execute("SELECT symbol FROM user_watchlist WHERE user_id = ?", (user_id,))
        watchlist = [row[0] for row in cursor.fetchall()]
        
        if not watchlist:
            continue
            
        # Fetch today's AI plans for these stocks
        placeholders = ",".join(["?"] * len(watchlist))
        cursor.execute(f"""
            SELECT symbol, signal, confidence, ai_reasoning 
            FROM ai_predictions_v2
            WHERE symbol IN ({placeholders}) AND date = ? AND is_primary = 1
        """, (*watchlist, today_str))
        predictions = cursor.fetchall()
        
        if not predictions:
            logger.debug(f"⏩ Skip user {user_id}: No predictions for watchlist today.")
            continue
            
        # Compose personalized message
        buy_signals = [p[0] for p in predictions if p[1] in ('Buy', 'Strong Buy', 'Long')]
        
        title = "☕ 今日早报: AI 交易提醒"
        if buy_signals:
            body = f"📊 您的关注股中 {', '.join(buy_signals[:3])} 等有看多信号。{sentiment_snippet}"
        else:
            body = f"📉 今日市场观望为主。{sentiment_snippet}"
            
        url = "/daily-brief?utm_source=push&utm_medium=morning_call"
        
        # Log and Queue
        nm.queue_notification(user_id, "morning_call", {
            "title": title,
            "body": body,
            "url": url,
            "related_symbols": watchlist
        })
        sent_count += 1
        
    # Flush all
    total_delivered = nm.flush()
    logger.info(f"✅ Morning Call Task Finished. Queued: {sent_count}, Delivered: {total_delivered}")
    conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Simulate without sending")
    parser.add_argument("--date", type=str, help="Specify date in YYYY-MM-DD format")
    args = parser.parse_args()
    
    generate_morning_calls(dry_run=args.dry_run, target_date=args.date)
