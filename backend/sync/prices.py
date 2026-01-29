"""
价格数据同步模块
处理日线、周线、月线数据的增量同步
"""
import time
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd

from database import get_connection, get_stock_pool
from config import SYNC_CONFIG
from fetchers import fetch_stock_data
from utils import send_wecom_notification, format_volume
from notifications import send_push_notification
from engine.indicators import calculate_indicators
# from engine.validator import validate_previous_prediction  <-- Decoupled
from helpers import get_last_date, check_trading_day_skip
from logger import logger


def process_stock_period(symbol: str, period: str = "daily", is_realtime: bool = False):
    """增量处理特定周期的股票数据"""
    table_name = f"{period}_prices"
    if is_realtime:
        logger.info(f"⏱️ [实时重算] 正在更新盘中指标: {symbol}")
    else:
        logger.info(f"🔍 检查 {period} 状态: {symbol}")
    
    last_date_str = get_last_date(symbol, table_name)
    
    # 动态确定回溯天数，确保指标计算有足够上下文
    if period == "daily":
        # [Optimization] Realtime sync only needs recent data + local history
        buffer_days = 15 if is_realtime else 80
    elif period == "weekly":
        buffer_days = 365 * 2  # 2年历史确保周均线准确
    else:
        buffer_days = 365 * 10 # 10年历史确保月均线准确

    if last_date_str:
        last_dt = datetime.strptime(last_date_str, "%Y-%m-%d")
        fetch_start_str = (last_dt - timedelta(days=buffer_days)).strftime("%Y%m%d")
    else:
        fetch_start_str = (datetime.now() - timedelta(days=buffer_days)).strftime("%Y%m%d")

    # 1. 抓取
    df = fetch_stock_data(symbol, period=period, start_date=fetch_start_str)
    if df.empty: return
    
    # 2. 清洗
    df = df.rename(columns={
        "日期": "date", "开盘": "open", "收盘": "close", 
        "最高": "high", "最低": "low", "成交量": "volume", "涨跌幅": "change_percent"
    })
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    
    # 3. 验证昨日预测 (Validation Decoupled -> Run via --verify)
    # if period == "daily" and not df.empty and not is_realtime:
    #    validate_previous_prediction(symbol, df.iloc[-1])

    # 4. 判断是否需要更新
    if last_date_str and df["date"].max() < last_date_str:
        logger.info(f"✨ 数据已是最新 ({last_date_str})。")
        return

    # 5. 数据校验 (Data Validation)
    original_count = len(df)
    
    # 5.1 基本价格校验: close > 0
    df = df[df["close"] > 0]
    
    # 5.2 成交量校验: volume >= 0
    df = df[df["volume"] >= 0]
    
    # 注: 不校验涨跌幅范围，因为新股首日和港股可能大幅波动
    
    filtered_count = original_count - len(df)
    if filtered_count > 0:
        logger.warning(f"⚠️ {symbol}: 过滤了 {filtered_count} 条异常数据 (原 {original_count} 条)")
    
    if df.empty:
        logger.warning(f"⚠️ {symbol}: 校验后无有效数据")
        return

    # [Optimization] Splice local history for realtime calculation
    # Only keep track of new rows to insert later
    new_rows_mask = None
    
    if is_realtime and period == "daily":
        try:
            conn = get_connection()
            # We need enough history for MA60 (approx 60 trading days, so 90 calendar days safe buffer)
            # Use 100 limit to be safe
            hist_query = f"""
                SELECT date, open, high, low, close, volume, change_percent 
                FROM {table_name} 
                WHERE symbol = ? 
                ORDER BY date DESC LIMIT 100
            """
            
            # Suppress pandas warning about non-SQLAlchemy connection (LibSQL)
            import warnings
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=UserWarning, message=".*pandas only supports SQLAlchemy.*")
                hist_df = pd.read_sql_query(hist_query, conn, params=(symbol,))
                
            conn.close()
            
            if not hist_df.empty:
                # Ensure types match
                hist_df['date'] = hist_df['date'].astype(str)
                # Combine: History (Old -> New) + New Fetched
                # Note: hist_df is DESC, need to reverse
                hist_df = hist_df.iloc[::-1]
                
                # Exclude overlaps (if any dates in hist_df already in df)
                # Usually fetch_start is dynamic so overlaps exist
                min_new_date = df['date'].min()
                hist_df = hist_df[hist_df['date'] < min_new_date]
                
                if not hist_df.empty:
                    # Mark which rows are new (from the original df)
                    # We will calculate on the FULL set, but only insert the NEW set
                    df['__is_new'] = True
                    hist_df['__is_new'] = False
                    
                    full_df = pd.concat([hist_df, df], ignore_index=True)
                    df = full_df # Replace df with full context
        except Exception as e:
            logger.warning(f"⚠️ Context splicing failed for {symbol}: {e}")

    # 6. 计算指标
    df = calculate_indicators(df)
    
    # [Optimization] Filter back to only new rows for insertion (Realtime only)
    if is_realtime and period == "daily" and '__is_new' in df.columns:
        # Only save the rows that were actually fetched/updated
        df = df[df['__is_new'] == True].copy()
        # Clean up temp col
        del df['__is_new']
    
    # 7. 入库
    # 定义舍入函数
    def r2(x): return round(float(x), 2) if x else 0
    def r3(x): return round(float(x), 3) if x else 0
    def r1(x): return round(float(x), 1) if x else 0
    
    records = []
    for _, row in df.iterrows():
        records.append((
            symbol, row["date"], r2(row["open"]), r2(row["high"]), r2(row["low"]), r2(row["close"]),
            int(row["volume"]), r2(row["change_percent"]),
            r2(row["ma5"]), r2(row["ma10"]), r2(row["ma20"]), r2(row["ma60"]),
            r3(row["macd"]), r3(row["macd_signal"]), r3(row["macd_hist"]),
            r2(row["boll_upper"]), r2(row["boll_mid"]), r2(row["boll_lower"]),
            r1(row["rsi"]), r1(row["kdj_k"]), r1(row["kdj_d"]), r1(row["kdj_j"]), None
        )) # type: ignore

    from database import execute_with_retry

    # 6.1 对于周/月线：删除当前周期的旧记录（防止每日同步产生重复）
    # akshare 每天返回的"当前周/月"日期会变化，需要清理再插入
    if period in ("weekly", "monthly") and records:
        latest_date = records[-1][1]  # 最新记录的日期
        latest_dt = pd.to_datetime(latest_date)
        
        def _cleanup_current_period(conn, _table, _symbol, _latest_dt, _period):
            cur = conn.cursor()
            if _period == "weekly":
                # 删除同一周的所有记录 (ISO 周)
                week_start = _latest_dt - pd.Timedelta(days=_latest_dt.weekday())
                cur.execute(f"DELETE FROM {_table} WHERE symbol = ? AND date >= ?", 
                           (_symbol, week_start.strftime('%Y-%m-%d')))
                logger.debug(f"🧹 清理 {_symbol} 本周旧记录 (从 {week_start.strftime('%Y-%m-%d')} 起)")
            elif _period == "monthly":
                # 删除同月的所有记录
                month_start = _latest_dt.strftime('%Y-%m-01')
                cur.execute(f"DELETE FROM {_table} WHERE symbol = ? AND date >= ?", 
                           (_symbol, month_start))
                logger.debug(f"🧹 清理 {_symbol} 本月旧记录 (从 {month_start} 起)")
        
        execute_with_retry(_cleanup_current_period, 3, table_name, symbol, latest_dt, period)

    def _save_prices(conn, _table, _records):
        cur = conn.cursor()
        cur.executemany(f"""
            INSERT OR REPLACE INTO {_table} 
            (symbol, date, open, high, low, close, volume, change_percent,
             ma5, ma10, ma20, ma60, macd, macd_signal, macd_hist,
             boll_upper, boll_mid, boll_lower, rsi, kdj_k, kdj_d, kdj_j, ai_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, _records)

    execute_with_retry(_save_prices, 3, table_name, records)
    
    # 7. 实时更新推送 (仅在盘中实时模式下触发)
    if is_realtime:
        last_row = df.iloc[-1]
        change = float(last_row['change_percent'])
        price = float(last_row['close'])
        
        # 尝试从数据库获取中文简称
        def _get_name(conn, sym):
            cur = conn.cursor()
            cur.execute("SELECT name FROM stock_meta WHERE symbol = ?", (sym,))
            r = cur.fetchone()
            return r[0] if r else sym

        try:
            stock_name = execute_with_retry(_get_name, 2, symbol)
        except:
            stock_name = symbol
        
        emoji = "🚀" if change >= 3 else ("📈" if change > 0 else ("🔹" if change == 0 else "📉"))
        
        # [NEW] Use unified template engine for consistent messaging
        try:
            from notification_templates import NotificationTemplates
        except ImportError:
            # Fallback if templates are missing
            notify_title = f"{stock_name} ({symbol}) {emoji} {change:+.2f}%"
            notify_body = f"最新: {price} | 成交: {format_volume(last_row['volume'])}"
        else:
            notify_title, notify_body = NotificationTemplates.render(
                "price_update",
                stock_name=stock_name,
                symbol=symbol,
                emoji=emoji,
                change_pct=f"{change:+.2f}",
                price=price,
                volume_formatted=format_volume(last_row['volume'])
            )
        
        # 发送给关注该股票的用户，使用 symbol 作为 tag 实现同一个股票通知覆盖
        send_push_notification(
            title=notify_title, 
            body=notify_body,  
            url=f"/dashboard?symbol={symbol}", 
            related_symbol=symbol,
            tag=f"price_update_{symbol}"
        )


def run_full_sync(market_filter: str = None):
    """每日全量同步"""
    # 如果是例行运行，且该市场今天休市，则跳过
    # logic moved to scheduler level, execution level should follow command
    # if check_trading_day_skip(market_filter):
    #     return
        
    target_stocks = get_stock_pool()
    if not target_stocks:
        logger.warning("⚠️ 股票池为空")
        return
    
    # 按市场过滤
    if market_filter:
        filtered_stocks = []
        for symbol in target_stocks:
            is_hk = len(symbol) == 5
            if market_filter == "HK" and is_hk:
                filtered_stocks.append(symbol)
            elif market_filter == "CN" and not is_hk:
                filtered_stocks.append(symbol)
        target_stocks = filtered_stocks
        print(f"📍 过滤市场: {market_filter}，共 {len(target_stocks)} 只股票")

    if not target_stocks:
        logger.warning(f"⚠️ {market_filter} 市场股票池为空")
        return

    start_time = time.time()
    success_count = 0
    errors = []
    
    # 使用线程池并发同步
    workers = SYNC_CONFIG["daily_workers"]

    # [NEW] Force Inject Market Anchors (Ensure indices are fetched)
    # This solves the "Where does the market data come from?" problem.
    from engine.context_service import MARKET_ANCHORS
    
    # Merge and deduplicate
    current_set = set(target_stocks)
    for anchor in MARKET_ANCHORS:
        # Check market filter compatibility (simple heuristic)
        if market_filter:
            is_hk_anchor = len(anchor) == 5
            if market_filter == "HK" and not is_hk_anchor: continue
            if market_filter == "CN" and is_hk_anchor: continue
        
        if anchor not in current_set:
            target_stocks.append(anchor)
            logger.info(f"⚓ Auto-injecting Market Anchor: {anchor}")

    logger.info(f"🚀 启动并发同步 (Workers={workers})...")
    
    def sync_single_stock(stock):
        """单个股票的全量同步任务"""
        try:
            # 日线是必须的
            process_stock_period(stock, period="daily")
            time.sleep(0.5) # Slight delay to avoid DB connection burst
            
            # 周月线偶尔失败不影响核心体验
            try: 
                process_stock_period(stock, period="weekly")
                time.sleep(0.5)
            except: pass 
            try: process_stock_period(stock, period="monthly")
            except: pass
            return True
        except Exception as e:
            raise e

    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_to_stock = {executor.submit(sync_single_stock, stock): stock for stock in target_stocks}
        
        for i, future in enumerate(as_completed(future_to_stock)):
            stock = future_to_stock[future]
            try:
                future.result()
                success_count += 1
            except Exception as e:
                error_msg = str(e)
                errors.append(f"{stock}: {error_msg}")
                logger.error(f"❌ {stock} 同步失败: {error_msg}")
            
            # 进度条效果
            if (i + 1) % 10 == 0:
                logger.info(f"   ⏩ 进度: {i + 1}/{len(target_stocks)} ...")
    
    duration = time.time() - start_time
    market_label = f" ({market_filter})" if market_filter else ""
    report = f"### 📊 StockWise: Daily Sync{market_label}\n"
    report += f"> **Status**: {'✅' if not errors else '⚠️'}\n"
    report += f"- **Target**: {len(target_stocks)} Stocks\n"
    report += f"- **Periods**: 日线(D), 周线(W), 月线(M) ✅\n"
    report += f"- **Processed**: {success_count} Success, {len(errors)} Errors\n"
    report += f"- **处理耗时**: {duration:.1f}s"
    send_wecom_notification(report)
