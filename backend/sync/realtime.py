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
    

    # Lazy Import IntradayMonitor to avoid circular deps
    try:
        from sync.intraday_monitor import IntradayMonitor
        monitor = IntradayMonitor()
        monitor.load_rules() # Ensure rules are loaded
    except ImportError:
        monitor = None
        logger.warning("⚠️ IntradayMonitor not available")

    # [Optimization] Bulk fetch spot prices once to avoid repeated network calls
    spot_map = {}
    try:
        import akshare as ak
        logger.info("📡 正在获取全场实时行情以供对齐...")
        # 1. CN Spot
        try:
            cn_spot = ak.stock_zh_a_spot_em()
            if not cn_spot.empty:
                for _, row in cn_spot.iterrows():
                    symbol = str(row['代码'])
                    spot_map[symbol] = {
                        'price': float(row['最新价']),
                        'change': float(row['涨跌幅']),
                        'open': float(row['开盘']),
                        'high': float(row['最高']),
                        'low': float(row['最低']),
                        'volume': float(row['成交量']),
                    }
        except Exception as e:
            logger.warning(f"⚠️ CN Spot fetch failed: {e}")
            
        # 2. HK Spot
        try:
            hk_spot = ak.stock_hk_spot_em()
            if not hk_spot.empty:
                # HK Spot EM columns: '代码', '最新价', '涨跌幅', ...
                for _, row in hk_spot.iterrows():
                    symbol = str(row['代码'])
                    spot_map[symbol] = {
                        'price': float(row['最新价']),
                        'change': float(row['涨跌幅']),
                        'open': float(row['开盘']),
                        'high': float(row['最高']),
                        'low': float(row['最低']),
                        'volume': float(row['成交量']),
                    }
        except Exception as e:
            logger.warning(f"⚠️ HK Spot fetch failed: {e}")
            
    except Exception as e:
        logger.warning(f"⚠️ Global spot fetch failed: {e}")

    def sync_single_realtime(stock):
        try:
            # Pass pre-fetched spot data for the specific stock
            stock_spot = spot_map.get(stock)
            result = process_stock_period(stock, period="daily", is_realtime=True, spot_data=stock_spot)
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
                # errors.append(f"Stock {stock} error: {str(e)[:100]}")
                # Use less verbose logging for realtime errors (common network jitters)
                logger.debug(f"❌ {stock} Realtime Sync Failed: {e}")
                errors.append(f"Error {stock}") 


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
