"""
价格数据同步模块
处理日线、周线、月线数据的增量同步
"""
import time
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd

from database import get_connection, get_stock_pool
from config import SYNC_CONFIG, BEIJING_TZ
from fetchers import fetch_stock_data
from utils import send_wecom_notification, format_volume, get_market
from engine.indicators import calculate_indicators
# from engine.validator import validate_previous_prediction  <-- Decoupled
from helpers import get_last_date, check_trading_day_skip
from backend.db_repo.queries import get_cleanup_sql, get_save_prices_sql, GET_STOCK_NAME_QUERY
from backend.logger import logger


def _normalize_period_ohlcv(df: pd.DataFrame, period: str) -> pd.DataFrame:
    """
    Normalize raw provider data into strict weekly/monthly OHLCV bars.
    This prevents accidental daily rows leaking into period tables.
    """
    if df.empty or period not in ("weekly", "monthly"):
        return df

    required_cols = {"date", "open", "high", "low", "close", "volume"}
    if not required_cols.issubset(df.columns):
        logger.warning(f"⚠️ {period} normalization skipped: missing columns {required_cols - set(df.columns)}")
        return pd.DataFrame()

    work = df.copy()
    work["date"] = pd.to_datetime(work["date"], errors="coerce")
    work = work.dropna(subset=["date"]).sort_values("date")
    work = work.drop_duplicates(subset=["date"], keep="last")

    # Force numeric for robust aggregation.
    for col in ["open", "high", "low", "close", "volume"]:
        work[col] = pd.to_numeric(work[col], errors="coerce")
    work = work.dropna(subset=["open", "high", "low", "close", "volume"])
    if work.empty:
        return pd.DataFrame()

    if period == "weekly":
        work["_bucket"] = work["date"].dt.to_period("W-FRI")
    else:
        work["_bucket"] = work["date"].dt.to_period("M")

    aggregated = (
        work.groupby("_bucket", sort=True, as_index=False)
        .agg(
            date=("date", "max"),
            open=("open", "first"),
            high=("high", "max"),
            low=("low", "min"),
            close=("close", "last"),
            volume=("volume", "sum"),
        )
        .sort_values("date")
        .reset_index(drop=True)
    )

    aggregated["change_percent"] = aggregated["close"].pct_change().fillna(0) * 100
    aggregated["date"] = aggregated["date"].dt.strftime("%Y-%m-%d")

    return aggregated[["date", "open", "high", "low", "close", "volume", "change_percent"]]


def _is_period_interval_sane(df: pd.DataFrame, period: str) -> bool:
    """
    Guard rail: weekly rows should not be clustered like daily bars;
    monthly rows should not be clustered like weekly/daily bars.
    """
    if df.empty or len(df) < 3:
        return True

    dates = pd.to_datetime(df["date"], errors="coerce").dropna().sort_values()
    if len(dates) < 3:
        return True

    diffs = dates.diff().dropna().dt.days
    if diffs.empty:
        return True

    threshold = 4 if period == "weekly" else 20
    bad_ratio = float((diffs < threshold).sum()) / float(len(diffs))
    return bad_ratio <= 0.15


def _calculate_indicators_safe(df: pd.DataFrame) -> pd.DataFrame:
    try:
        return calculate_indicators(df)
    except Exception as e:
        logger.warning(f"⚠️ Indicator calculation failed, fallback to zeroed indicators: {e}")
        out = df.copy()
        default_cols = [
            "ma5", "ma10", "ma20", "ma60",
            "macd", "macd_signal", "macd_hist",
            "boll_upper", "boll_mid", "boll_lower",
            "rsi", "kdj_k", "kdj_d", "kdj_j",
        ]
        for col in default_cols:
            if col not in out.columns:
                out[col] = 0
        return out


def _resolve_fetch_plan(period: str, last_date_str: str = None) -> tuple[str, str]:
    """
    Use daily as the canonical source for weekly/monthly generation.
    This keeps period bars stable even when public weekly/monthly endpoints flap.
    """
    now = datetime.now()

    if period == "daily":
        if last_date_str:
            last_dt = datetime.strptime(last_date_str, "%Y-%m-%d")
            fetch_start = (last_dt - timedelta(days=7)).strftime("%Y%m%d")
        else:
            fetch_start = (now - timedelta(days=120)).strftime("%Y%m%d")
        return "daily", fetch_start

    if period == "weekly":
        overlap_days = 365 if last_date_str else 365 * 3
    else:
        # Monthly indicators need a longer warm-up window, but do not require 10y of daily bars.
        overlap_days = 365 * 3 if last_date_str else 365 * 6

    if last_date_str:
        last_dt = datetime.strptime(last_date_str, "%Y-%m-%d")
        fetch_start = (last_dt - timedelta(days=overlap_days)).strftime("%Y%m%d")
    else:
        fetch_start = (now - timedelta(days=overlap_days)).strftime("%Y%m%d")

    return "daily", fetch_start


def process_stock_period(symbol: str, period: str = "daily", is_realtime: bool = False):
    """增量处理特定周期的股票数据"""
    table_name = f"{period}_prices"
    if is_realtime:
        logger.info(f"⏱️ [实时重算] 正在更新盘中指标: {symbol}")
    else:
        logger.info(f"🔍 检查 {period} 状态: {symbol}")
    
    last_date_str = get_last_date(symbol, table_name)
    
    source_period, fetch_start_str = _resolve_fetch_plan(period, last_date_str)
    if period in ("weekly", "monthly"):
        logger.info(f"🧭 {symbol} {period}: using {source_period} history as canonical source.")

    # 1. 抓取 (Pass is_realtime flag to use optimized Sina Spot path)
    df = fetch_stock_data(symbol, period=source_period, start_date=fetch_start_str, is_realtime=is_realtime)
    # [Fix] Explicitly return False if fetch failed or no data, so caller knows it wasn't updated
    if df.empty: return False
    
    # 2. 清洗
    df = df.rename(columns={
        "日期": "date", "开盘": "open", "收盘": "close", 
        "最高": "high", "最低": "low", "成交量": "volume", "涨跌幅": "change_percent"
    })
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    logger.debug(f"📊 {symbol} Raw Data: {len(df)} rows, Range: {df['date'].min()} to {df['date'].max()}")
    
    
    # 3. 验证昨日预测 (Validation Decoupled -> Run via --verify)
    # if period == "daily" and not df.empty and not is_realtime:
    #    validate_previous_prediction(symbol, df.iloc[-1])

    # 4. 判断是否需要更新
    if last_date_str and df["date"].max() < last_date_str:
        logger.info(f"✨ 数据已是最新 ({last_date_str})。")
        return True

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
        return False

    # 5.3 Period normalization (weekly/monthly only)
    if period in ("weekly", "monthly"):
        raw_rows = len(df)
        df = _normalize_period_ohlcv(df, period)
        if df.empty:
            logger.warning(f"⚠️ {symbol}: {period} 归一化后无有效数据")
            return False

        if not _is_period_interval_sane(df, period):
            logger.error(f"❌ {symbol}: {period} 周期间隔异常，拒绝写入以防止数据污染")
            return False

        logger.info(f"🧹 {symbol} {period} normalized: raw={raw_rows} -> bars={len(df)}")

    # [Optimization] Splice local history for indicator calculation
    # For any daily sync (standard or realtime) that has previous data,
    # we prepend historical rows from DB to ensure sliding windows (like MA60) work correctly.
    new_rows_mask = None
    
    if period == "daily" and (is_realtime or last_date_str):
        try:
            conn = get_connection()
            # We need enough history for MA60 (approx 60 trading days, so 90 calendar days safe buffer)
            # Use 120 limit to be safe
            hist_query = f"""
                SELECT date, open, high, low, close, volume, change_percent 
                FROM {table_name} 
                WHERE symbol = ? 
                ORDER BY date DESC LIMIT 120
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
    df = _calculate_indicators_safe(df)
    
    # [Optimization] Filter back to only new rows for insertion
    if period == "daily" and '__is_new' in df.columns:
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

    # 6.1 对于周/月线：删除本次回灌窗口，确保历史污染可被覆盖清理
    if period in ("weekly", "monthly") and records:
        start_date = records[0][1]  # 本次窗口最早日期

        def _cleanup_period_window(conn, _table, _symbol, _start_date):
            cur = conn.cursor()
            cur.execute(get_cleanup_sql(_table), (_symbol, _start_date))

        execute_with_retry(_cleanup_period_window, 3, table_name, symbol, start_date)

    def _save_prices(conn, _table, _records):
        cur = conn.cursor()
        cur.executemany(get_save_prices_sql(_table), _records)

    execute_with_retry(_save_prices, 3, table_name, records)
    
    # 7. 实时更新推送 (仅在盘中实时模式下触发)
    if is_realtime:
        last_row = df.iloc[-1]
        change = float(last_row['change_percent'])
        price = float(last_row['close'])
        
        # 尝试从数据库获取中文简称
        def _get_name(conn, sym):
            cur = conn.cursor()
            cur.execute(GET_STOCK_NAME_QUERY, (sym,))
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
            # Route through NotificationManager for preference-checked delivery.
            # broadcast_price_alert() checks per-user notification_settings before
            # making HTTP calls. Rendering is now handled inside the loop for i18n.
            from notification_service import NotificationManager
            nm = NotificationManager()
            
            context = {
                "stock_name": stock_name,
                "symbol": symbol,
                "emoji": emoji,
                "change_pct": f"{change:+.2f}",
                "price": price,
                "volume_formatted": format_volume(last_row['volume']),
                "url": f"/dashboard/stock/{symbol}"
            }
            nm.broadcast_price_alert(symbol, "price_update", context, tag="price_update")
        
        # [NEW] Active Radar Audit: Compare price action against AI strategy anchors
        try:
            from backend.sync.intraday_monitor import IntradayMonitor
            radar = IntradayMonitor()
            radar.load_rules() # Internal dedup handles frequency
            radar.check(symbol, price, change)
        except Exception as e:
            logger.warning(f"⚠️ Radar audit failed for {symbol}: {e}")
        
        return {
            "success": True,
            "symbol": symbol,
            "price": price,
            "change": change,
            "volume": last_row['volume']
        }

    return True


def run_full_sync(market_filter: str = None, force_full: bool = False):
    """每日全量同步"""
    # 如果是例行运行，且该市场今天休市，则跳过
    # logic moved to scheduler level, execution level should follow command
    # if check_trading_day_skip(market_filter):
    #     return
        
    target_stocks = get_stock_pool()
    if not target_stocks:
        logger.warning("⚠️ 股票池为空")
        return
    
    # 智能调度策略：
    # 1. 强制模式 (--full-periods): 总是同步所有周期
    # 2. 自动模式: 
    #    - 周一至周四: 仅同步日线 (Daily)
    #    - 周五: 同步日线 + 周线 + 月线 (Daily, Weekly, Monthly)
    weekday = datetime.now().weekday() # 0=Mon, 4=Fri
    is_friday = (weekday == 4)
    
    sync_weekly = force_full or is_friday
    sync_monthly = force_full or is_friday
    
    mode_label = "Daily Only"
    if sync_weekly: mode_label = "Full (D/W/M)"
    
    logger.info(f"📅 Sync Strategy: {mode_label} (Friday={is_friday}, Force={force_full})")
    
    # 按市场过滤
    if market_filter:
        target_stocks = [symbol for symbol in target_stocks if get_market(symbol) == market_filter]
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
    try:
        from backend.engine.context_service import MARKET_ANCHORS
    except ImportError:
        from engine.context_service import MARKET_ANCHORS
    
    # Merge and deduplicate
    current_set = set(target_stocks)
    all_anchors = []
    if isinstance(MARKET_ANCHORS, dict):
        for m_anchors in MARKET_ANCHORS.values():
            all_anchors.extend(m_anchors)
    else:
        all_anchors = MARKET_ANCHORS

    for anchor in all_anchors:
        # Check market filter compatibility
        if market_filter:
            if get_market(anchor) != market_filter:
                continue
        
        if anchor not in current_set:
            target_stocks.append(anchor)
            logger.info(f"⚓ Auto-injecting Market Anchor: {anchor}")

    logger.info(f"🚀 启动并发同步 (Workers={workers})...")
    
    def sync_single_stock(stock):
        """单个股票的全量同步任务"""
        # 日线是必须的，如果失败（返回 False），抛出异常以便外层捕获
        if not process_stock_period(stock, period="daily"):
            raise ValueError("Daily sync failed (empty or network error)")
        
        if sync_weekly:
            time.sleep(0.5) # Slight delay to avoid DB connection burst
            # 周月线偶尔失败不影响核心体验，故仅记录不抛出异常
            try: 
                process_stock_period(stock, period="weekly")
                time.sleep(0.5)
            except: pass 
            
        if sync_monthly:
            try: process_stock_period(stock, period="monthly")
            except: pass
            
        return True

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
    # [Refactored] Use JobGuard to send notification
    return {
        "success_count": success_count,
        "error_count": len(errors),
        "target_count": len(target_stocks),
        "strategy": mode_label,
        "is_friday": is_friday,
        "sync_weekly": sync_weekly,
        "errors": errors[:5] if errors else None # Only show first 5 errors in summary
    }
