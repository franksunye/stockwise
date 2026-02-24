"""
Broadcast Market Almanac Notification Script.
Independent task to send the daily 'Investment Almanac' ritual to all active users.
"""
import sys
import os
import json
from datetime import datetime

# Path setup
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from notification_service import NotificationManager
from config import BEIJING_TZ

def broadcast_almanac(dry_run=False, target_date=None, phase="ritual"):
    """
    Fetch today's almanac and broadcast to all users.
    Phases: 
      - 'preview': Sent post-market, targets T+1.
      - 'ritual': Sent pre-market, targets Today with overnight data.
    """
    today_str = target_date or datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
    
    logger.info(f"📜 Starting Almanac Broadcast for {today_str} (Phase: {phase}, Dry Run: {dry_run})")
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Fetch Today's Almanac Data
        cursor.execute("""
            SELECT mood_tag, action_strategy, ai_insight 
            FROM market_almanacs 
            WHERE target_date = ?
        """, (today_str,))
        row = cursor.fetchone()
        
        if not row:
            logger.warning(f"⚠️ No almanac found for {today_str}. Skipping broadcast.")
            return

        mood_tag, strategy, insight = row
        # Clean insight for push body
        insight_snippet = insight[:60].replace('\n', ' ') + "..." if len(insight) > 60 else insight
        
        # 2. Identify target users
        # Broadcast to all users who have at least one valid push subscription
        cursor.execute("SELECT DISTINCT user_id FROM push_subscriptions")
        user_ids = [r[0] for r in cursor.fetchall()]
        
        if not user_ids:
            logger.info("🔕 No target users found for broadcast.")
            return

        nm = NotificationManager(dry_run=dry_run)
        
        # 3. Queue Notifications based on phase
        notif_type = f"almanac_{phase}"
        
        for uid in user_ids:
            nm.queue_notification(uid, notif_type, {
                "mood_tag": mood_tag,
                "strategy": strategy.split(' / ')[0], # Just the "宜" part for brevity
                "insight_snippet": insight_snippet,
                "url": f"/dashboard?utm_source=push&utm_medium=almanac_{phase}"
            })
            
        # 4. Flush
        total_delivered = nm.flush()
        logger.info(f"✅ Almanac Broadcast ({phase}) Finished. Delivered: {total_delivered}")
        
    except Exception as e:
        logger.error(f"❌ Almanac Broadcast Failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--date", type=str)
    parser.add_argument("--phase", type=str, choices=["preview", "ritual"], default="ritual")
    args = parser.parse_args()
    
    broadcast_almanac(dry_run=args.dry_run, target_date=args.date, phase=args.phase)
