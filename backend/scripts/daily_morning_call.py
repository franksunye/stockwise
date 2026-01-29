"""
Daily Morning Call Script.
Part of Phase 4: Scheduled Notifications.
Sends a 08:30 morning briefing to users with AI plans and market sentiment.
"""
import sys
import os
import json
from datetime import datetime, timedelta

# Add backend to path (legacy support)
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
# Add project root to path (support 'backend.*' imports)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from notification_service import NotificationManager
from config import BEIJING_TZ

try:
    from backend.engine.task_logger import get_task_logger
except ImportError:
    from engine.task_logger import get_task_logger


def generate_morning_calls(dry_run=False, target_date=None):
    """
    Generate and send personalized morning calls for all active users.
    """
    today_str = target_date or datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
    logger.info(f"🌅 Starting Daily Morning Call generation for {today_str} (Dry Run: {dry_run})")
    
    t_logger = get_task_logger("news_desk", "morning_call")
    t_logger.start("Daily Morning Call", "delivery", dimensions={})

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
            
        # Fetch today's AI plans for these stocks (with names)
        placeholders = ",".join(["?"] * len(watchlist))
        cursor.execute(f"""
            SELECT p.symbol, p.signal, p.confidence, p.ai_reasoning, m.name
            FROM ai_predictions_v2 p
            JOIN stock_meta m ON p.symbol = m.symbol
            WHERE p.symbol IN ({placeholders}) AND p.target_date = ? AND p.is_primary = 1
        """, (*watchlist, today_str))
        predictions = cursor.fetchall()
        
        if not predictions:
            logger.debug(f"⏩ Skip user {user_id}: No predictions for watchlist today.")
            continue
            
        # Compose personalized message placeholders
        buy_signals = [f"{p[4]}" for p in predictions if p[1] in ('Buy', 'Strong Buy', 'Long')]
        
        # Decide which template type to use
        notif_type = "morning_call" if buy_signals else "morning_call_neutral"
        
        # Queue for NotificationManager to handle (it will fetch tier and render during flush)
        nm.queue_notification(user_id, notif_type, {
            "stock_names": ", ".join(buy_signals[:3]),
            "sentiment_snippet": sentiment_snippet,
            "url": "/dashboard?brief=true&utm_source=push&utm_medium=morning_call",
            "related_symbols": watchlist
        })
        sent_count += 1
        
    # Flush all
    total_delivered = nm.flush()
    logger.info(f"✅ Morning Call Task Finished. Queued: {sent_count}, Delivered: {total_delivered}")
    t_logger.success(f"Delivered briefing to {total_delivered} users.")
    conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Simulate without sending")
    parser.add_argument("--date", type=str, help="Specify date in YYYY-MM-DD format")
    args = parser.parse_args()
    
    generate_morning_calls(dry_run=args.dry_run, target_date=args.date)
