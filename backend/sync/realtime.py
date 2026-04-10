"""
盘中实时同步模块
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from database import get_stock_pool
from utils import get_market, send_wecom_notification
from helpers import check_trading_day_skip
from sync.prices import process_stock_period
from config import SYNC_CONFIG
from logger import logger
from trading_calendar import is_realtime_session_open


def sync_spot_prices(
    symbols: list,
    ignore_session_filter: bool = False,
    ignore_trading_day_gate: bool = False,
):
    """盘中实时同步

    ignore_session_filter=True: 跳过交易时段过滤（用于 on-demand 单票）
    ignore_trading_day_gate=True: 跳过全市场交易日闸门（用于 on-demand 单票）
    """
    # 如果全场休市，跳过实时同步
    if not ignore_trading_day_gate and check_trading_day_skip():
        return {
            "success_count": 0,
            "failed_count": 0,
            "total_count": len(symbols),
            "duration": 0,
            "message": "Market closed, skipping."
        }

    pool_total = len(symbols)
    env_ignore = os.getenv("REALTIME_SYNC_IGNORE_SESSION", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    should_ignore_session = ignore_session_filter or env_ignore
    if should_ignore_session:
        active = list(symbols)
        skipped_session = 0
        if ignore_session_filter:
            logger.info("⚡ Realtime on-demand mode — 跳过交易时段过滤")
        elif env_ignore:
            logger.warning("⚠️ REALTIME_SYNC_IGNORE_SESSION set — 跳过交易时段过滤（全量标的）")
    else:
        active = [s for s in symbols if is_realtime_session_open(get_market(s))]
        skipped_session = pool_total - len(active)
    if skipped_session:
        logger.info(
            f"⏭️ Realtime: {skipped_session}/{pool_total} 只股票不在常规交易时段内，跳过同步"
        )
    if not active:
        return {
            "success_count": 0,
            "failed_count": 0,
            "total_count": 0,
            "duration": 0,
            "message": "No market in regular session; skipping realtime fetch.",
            "pool_total": pool_total,
            "skipped_off_session": skipped_session,
        }

    symbols = active

    start_time = time.time()
    success_count = 0
    errors = []
    
    workers = SYNC_CONFIG["realtime_workers"]
    logger.info(f"⚡ 启动并发盘中同步 (Workers={workers}) - 针对 {len(symbols)} 只股票")
    

    # Lazy Import IntradayMonitor to avoid circular deps
    try:
        from sync.intraday_monitor import IntradayMonitor
        monitor = IntradayMonitor()
        monitor.load_rules() # Ensure rules are loaded
    except ImportError:
        monitor = None
        logger.warning("⚠️ IntradayMonitor not available")

    def sync_single_realtime(stock):
        try:
            result = process_stock_period(stock, period="daily", is_realtime=True)
            if result is False: # Explicit False means fetch failed
                raise Exception("Fetch failed")
            
            # [Intraday Rule Check]
            if isinstance(result, dict) and monitor:
                monitor.check(result['symbol'], result['price'], result['change'])
                
            return True
        except Exception as e:
            raise e

    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_to_stock = {executor.submit(sync_single_realtime, sym): sym for sym in symbols}
        
        for i, future in enumerate(as_completed(future_to_stock)):
            stock = future_to_stock[future]
            try:
                future.result()
                success_count += 1
            except Exception as e:
                # Use less verbose logging for realtime errors (common network jitters)
                logger.debug(f"❌ {stock} Realtime Sync Failed: {e}")
                errors.append(f"Error {stock}") 


    duration = round(time.time() - start_time, 1)
    
    # [Refactored] Use JobGuard to handle notification
    return {
        "success_count": success_count,
        "failed_count": len(errors),
        "total_count": len(symbols),
        "duration": duration,
        "failed_samples": [e.replace("Error ", "") for e in errors][:5]
    }
