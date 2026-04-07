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


def generate_morning_calls(dry_run=False, target_date=None, force=False, market="CN"):
    """
    Generate and send personalized morning calls for all active users.
    Args:
        market: Market identifying code ("CN", "HK", "US").
    """
    today_str = target_date or datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
    
    # --- Defense-in-depth: Python-level Trading Day Guard ---
    if not force:
        try:
            # Lazy import to avoid circular dependency
            from trading_calendar import is_market_closed
            
            check_date = datetime.strptime(today_str, "%Y-%m-%d")
            # Market-specific holiday check
            if is_market_closed(check_date, market):
                logger.info(f"📅 [TradingDayGuard] {today_str} 为 {market} 市场休市日，跳过早报推送。")
                return 0
        except ImportError:
            # Fallback if trading_calendar not found (e.g. strict path issues)
            logger.warning("⚠️ [TradingDayGuard] Could not import trading_calendar, skipping check.")
        except Exception as e:
            logger.warning(f"⚠️ [TradingDayGuard] Check failed: {e}, proceeding.")

    logger.info(f"🌅 Starting Daily Morning Call [{market}] for {today_str} (Dry Run: {dry_run}, Force: {force})")
    
    t_logger = get_task_logger("news_desk", "morning_call")
    t_logger.start("Daily Morning Call", "delivery", dimensions={})

    nm = NotificationManager(dry_run=dry_run)
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Get Users with Watchlists
        cursor.execute("""
            SELECT DISTINCT user_id FROM user_watchlist
        """)
        users = [row[0] for row in cursor.fetchall()]
        
        sent_count = 0
        for user_id in users:
            # Fetch user's watchlist symbols and filter by market
            # Symbol logic: .HK for Hong Kong, .US for US, no suffix for CN
            symbol_filter = ""
            if market == "CN":
                symbol_filter = "AND symbol NOT LIKE '%.HK' AND symbol NOT LIKE '%.US'"
            elif market == "HK":
                symbol_filter = "AND symbol LIKE '%.HK'"
            elif market == "US":
                symbol_filter = "AND symbol LIKE '%.US'"

            cursor.execute(f"SELECT symbol FROM user_watchlist WHERE user_id = ? {symbol_filter}", (user_id,))
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
            # Align with ZISO AI's unified semantics: TriggeredLong, Watch, NoSetup, RiskOff
            buy_signals = [f"{p[4]}" for p in predictions if p[1] in ('TriggeredLong', 'Long')]
            sell_signals = [f"{p[4]}" for p in predictions if p[1] in ('RiskOff', 'Short')]
            
            buy_count = len(buy_signals)
            sell_count = len(sell_signals)
            
            # Watchlist Sentiment & Stock Selection Logic (Sparcity Adjusted)
            if buy_count > 0 and buy_count >= sell_count:
                # Even 1-2 buy signals in a sea of neutral is highly actionable
                sentiment_tag = "局部试多" if buy_count <= 2 else "多头进攻"
                stock_names_to_show = ", ".join(buy_signals[:3])
                notif_type = "morning_call"
            elif sell_count > 0 and sell_count > buy_count:
                sentiment_tag = "局部承压" if sell_count <= 2 else "避险防御"
                stock_names_to_show = ", ".join(sell_signals[:3])
                notif_type = "morning_call"
            else:
                sentiment_tag = "震荡观望"
                stock_names_to_show = ", ".join([f"{p[4]}" for p in predictions][:3])
                notif_type = "morning_call_neutral"
            
            # Queue for NotificationManager to handle (it will fetch tier and render during flush)
            nm.queue_notification(user_id, notif_type, {
                "stock_names": stock_names_to_show,
                "sentiment_tag": sentiment_tag,
                "url": "/monitor?utm_source=push&utm_medium=morning_call",
                "related_symbols": watchlist
            })
            sent_count += 1
            
        # Flush all
        total_delivered = nm.flush()
        logger.info(f"✅ Morning Call Task Finished. Queued: {sent_count}, Delivered: {total_delivered}")
        t_logger.success(f"Delivered briefing to {total_delivered} users.", notify=True)
        return 0
        
    except Exception as e:
        logger.error(f"❌ Morning Call Failed: {e}")
        t_logger.fail(f"Execution Error: {str(e)}", notify=True, rerun_workflow="daily_morning_call.yml")
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Simulate without sending")
    parser.add_argument("--date", type=str, help="Specify date in YYYY-MM-DD format")
    parser.add_argument("--force", action="store_true", help="Force execution on holidays")
    parser.add_argument("--market", type=str, default="CN", choices=["CN", "HK", "US"], help="Target market (CN, HK, US)")
    args = parser.parse_args()
    
    raise SystemExit(generate_morning_calls(dry_run=args.dry_run, target_date=args.date, force=args.force, market=args.market))
