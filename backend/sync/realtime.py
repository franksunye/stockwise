"""
盘中实时同步模块
"""
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from database import get_stock_pool
from utils import send_wecom_notification
from helpers import check_trading_day_skip
from sync.prices import process_stock_period
from config import SYNC_CONFIG
from logger import logger


def sync_spot_prices(symbols: list):
    """盘中实时同步"""
    # 如果全场休市，跳过实时同步
    if check_trading_day_skip():
        return

    start_time = time.time()
    success_count = 0
    errors = []
    
    workers = SYNC_CONFIG["realtime_workers"]
    logger.info(f"⚡ 启动并发盘中同步 (Workers={workers}) - 针对 {len(symbols)} 只股票")
    
    def sync_single_realtime(stock):
        try:
            process_stock_period(stock, period="daily", is_realtime=True)
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
                errors.append(f"Stock {stock} error: {str(e)[:100]}")
                logger.error(f"❌ {stock} 实时同步失败: {e}")

    duration = time.time() - start_time
    
    if len(errors) == 0:
        status = "✅ SUCCESS"
    elif success_count > 0:
        status = "⚠️ PARTIAL"
    else:
        status = "❌ FAILED"
    
    report = f"### 🛠️ StockWise: Realtime Sync\n"
    report += f"> **Status**: {status}\n"
    report += f"- **Success**: {success_count}/{len(symbols)}\n"
    if errors:
        report += f"- **Failed**: {len(errors)}\n"
        # Extract stock codes from error messages somewhat loosely
        failed_stocks = [e.split()[1] for e in errors if "Stock" in e]
        if failed_stocks:
             report += f"> ❌ Failures: {', '.join(failed_stocks[:5])}{'...' if len(failed_stocks)>5 else ''}\n"
             
    report += f"- **执行耗时**: {duration:.1f}s"
    send_wecom_notification(report)
    
    return success_count, len(errors)
    
    return success_count, len(errors)
