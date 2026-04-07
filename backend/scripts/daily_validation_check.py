"""
Daily Validation Glory Push Script.
Part of Phase 4: Scheduled Notifications.
Runs after market close, identifies validated wins, and notifies users.
"""
import sys
import os
from datetime import datetime

# Add backend to path (legacy support)
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
# Add project root to path (support 'backend.*' imports)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from notification_service import NotificationManager
from trading_calendar import get_market_from_symbol


def run_validation_glory_push(market="CN", dry_run=False, run_verify=False):
    """
    1. Optionally update validation status in DB (manual fallback).
    2. Find successful predictions (Correct).
    3. Push glory notifications to users with these symbols in watchlist.
    """
    logger.info(
        f"🏆 Starting Validation Glory Push | Market: {market} (Dry Run: {dry_run}, Run Verify: {run_verify})"
    )
    
    # Step 1: Sync DB validation status
    # Initialize Task Logger
    try:
        from backend.engine.task_logger import get_task_logger
    except ImportError:
        from engine.task_logger import get_task_logger
        
    t_logger = get_task_logger("validation_auditor", f"validation_glory_push_{market.lower()}")
    t_logger.start(f"Daily Validation Glory Push ({market})", "validation")

    try:
        if run_verify:
            try:
                from engine.validator import verify_all_pending
                verify_all_pending()
            except Exception as e:
                logger.error(f"❌ Failed to run verify_all_pending: {e}")
                t_logger.fail(f"verify_all_pending failed: {e}", notify=True)
                return
        else:
            logger.info("ℹ️ Skip verify_all_pending (handled by daily pipeline verify jobs).")
        
        # 🎯 方案核心：基于市场感知（Market-Aware）的日期与标的过滤
        from config import BEIJING_TZ
        from datetime import timedelta
        
        # 获取基准时间
        now_bj = datetime.now(BEIJING_TZ)
        
        # 💡 US 市场日期偏移逻辑：
        # 如果当前是周二 morning (BJ)，美股刚结束的是周一 (T-1) 交易日。
        # 如果当前是周五 evening (BJ)，A 股刚结束的是周五 (T) 交易日。
        if market == 'US':
            target_date_obj = now_bj - timedelta(days=1)
            logger.info("🇺🇸 US Market mode: adjusting target_date to T-1 for post-close validation.")
        else:
            target_date_obj = now_bj
            
        target_date_str = target_date_obj.strftime('%Y-%m-%d')
        logger.info(f"📅 Looking for successful predictions targeting: {target_date_str} for market: {market}")
    
        nm = NotificationManager(dry_run=dry_run)
        conn = get_connection()
        cursor = conn.cursor()
        
        # Step 2: Find 'Correct' predictions targeting TODAY (JOIN with stock_meta for names)
        cursor.execute("""
            SELECT p.symbol, p.signal, p.actual_change, p.date, m.name
            FROM ai_predictions_v2 p
            JOIN stock_meta m ON p.symbol = m.symbol
            WHERE p.target_date = ? 
            AND p.validation_status = 'Correct' 
            AND p.is_primary = 1
            ORDER BY ABS(p.actual_change) DESC
        """, (target_date_str,))
        successes_raw = cursor.fetchall()
        
        # Step 2.1: Filter by Market
        successes = []
        for s in successes_raw:
            if get_market_from_symbol(s[0]) == market:
                successes.append(s)
        
        if not successes:
            logger.info(f"ℹ️ No 'Correct' predictions found for {market} on target_date {target_date_str}.")
            t_logger.success(f"No correct predictions found for {market} on {target_date_str}.", notify=False)
            conn.close()
            return
    
        # Map stock to results for easy lookup
        success_map = {s[0]: {"signal": s[1], "change": s[2], "date": s[3], "name": s[4]} for s in successes}
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
                
            # Get user tier for personalization
            cursor.execute("SELECT subscription_tier FROM users WHERE user_id = ?", (user_id,))
            tier_row = cursor.fetchone()
            user_tier = tier_row[0] if tier_row and tier_row[0] else "free"
    
            # Prepare descriptive placeholders
            stock_names_list = [success_map[s]['name'] for s in symbols[:3]]
            stock_names = ", ".join(stock_names_list)
            
            # Identify the single best win in this batch for the user
            peak_gain = max([abs(success_map[s]['change']) for s in symbols])
            
            url = "/dashboard?utm_source=push&utm_medium=validation_glory"
            nm.queue_notification(user_id, "validation_glory", {
                "stock_names": stock_names,
                "peak_gain": f"{peak_gain:+.1f}",
                "url": url,
                "related_symbols": symbols
            })
    
        total_sent = nm.flush()
        logger.info(f"✅ Validation Glory Push Finished. Delivered: {total_sent}")
        t_logger.success(f"Delivered validation glory push to {total_sent} users.", notify=True)
        conn.close()
    
    except Exception as e:
        logger.error(f"❌ Validation Glory Push Failed: {e}")
        t_logger.fail(f"Execution Error: {str(e)}", notify=True, rerun_workflow="daily_validation_check.yml")


if __name__ == "__main__":
    import argparse
    parser.add_argument(
        "--market",
        type=str,
        default="CN",
        choices=["CN", "HK", "US"],
        help="Target market (CN/HK/US)",
    )
    args = parser.parse_args()
    
    run_validation_glory_push(market=args.market, dry_run=args.dry_run, run_verify=args.run_verify)
