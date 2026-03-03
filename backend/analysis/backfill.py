"""
AI 分析回填模块
支持历史数据的补充分析
"""
import time
from datetime import datetime, timedelta

import pandas as pd

from config import BEIJING_TZ
from database import get_connection, get_stock_pool
from engine.validator import validate_previous_prediction
from trading_calendar import is_trading_day, get_market_from_symbol
from logger import logger


def _build_missing_predictions_query(symbol_count: int, model_filter: str = None):
    """
    Build auto-fill query based on ai_predictions_v2.

    Semantics:
    - model_filter is specific model_id: detect missing rows for that model only.
    - model_filter is None or 'all': detect missing rows with no v2 prediction at all.
    """
    placeholders = ','.join(['?'] * symbol_count)

    if model_filter and model_filter != 'all':
        query = f"""
        SELECT DISTINCT dp.date, dp.symbol
        FROM daily_prices dp
        LEFT JOIN ai_predictions_v2 ap
            ON dp.symbol = ap.symbol
           AND dp.date = ap.date
           AND ap.model_id = ?
        WHERE dp.symbol IN ({placeholders})
          AND ap.date IS NULL
        ORDER BY dp.date DESC
        LIMIT 100
        """
        return query, [model_filter]

    query = f"""
    SELECT DISTINCT dp.date, dp.symbol
    FROM daily_prices dp
    LEFT JOIN ai_predictions_v2 ap
        ON dp.symbol = ap.symbol
       AND dp.date = ap.date
    WHERE dp.symbol IN ({placeholders})
      AND ap.date IS NULL
    ORDER BY dp.date DESC
    LIMIT 100
    """
    return query, []


def run_ai_analysis_backfill(
    symbol: str = None,
    market_filter: str = None,
    date: str = None,
    start_date: str = None,
    end_date: str = None,
    days: int = None,
    auto_fill: bool = False,
    model_filter: str = None,
    force: bool = False
):
    """
    AI 分析回填功能

    支持多种模式：
    - 单日模式: date="2025-12-30"
    - 日期范围: start_date="2025-12-23", end_date="2025-12-30"
    - 最近N天: days=7
    - 智能补充: auto_fill=True
    """
    # 1. 确定目标股票
    if symbol:
        targets = [symbol]
    else:
        pool = get_stock_pool()
        if not pool:
            logger.warning("⚠️ 股票池为空")
            return

        if market_filter:
            targets = [s for s in pool if (market_filter == "HK" and len(s) == 5) or (market_filter == "CN" and len(s) != 5)]
        else:
            targets = pool

    if not targets:
        logger.warning("⚠️ 无目标股票")
        return

    conn = get_connection()

    # Initialize tracker for notifications
    from backend.analysis.user_tracker import UserCompletionTracker
    tracker = UserCompletionTracker()
    tracker.load_watchlists(targets)

    # 2. 确定目标日期列表
    target_dates = []

    if auto_fill:
        logger.info("🔍 智能模式：扫描缺失分析的日期...")

        query, prefix_params = _build_missing_predictions_query(len(targets), model_filter=model_filter)
        cursor = conn.cursor()
        cursor.execute(query, tuple(prefix_params + targets))
        missing = cursor.fetchall()

        if not missing:
            suffix = f"（模型: {model_filter}）" if model_filter and model_filter != 'all' else ""
            logger.info(f"✅ 没有缺失的分析{suffix}，所有数据已完整")
            conn.close()
            return

        # 按日期分组
        dates_with_stocks = {}
        for row in missing:
            d, s = row[0], row[1]
            if d not in dates_with_stocks:
                dates_with_stocks[d] = []
            dates_with_stocks[d].append(s)

        logger.info(f"📅 发现 {len(dates_with_stocks)} 个交易日缺失分析:")
        for d in sorted(dates_with_stocks.keys()):
            count = len(dates_with_stocks[d])
            logger.info(f"   - {d} ({count} 只股票)")

        # 执行补充
        total_success = 0
        for date_str in sorted(dates_with_stocks.keys()):
            stocks_to_fill = dates_with_stocks[date_str]
            logger.info(f"\n🧠 开始补充 {date_str}...")
            success = _analyze_stocks_for_date(conn, stocks_to_fill, date_str, model_filter=model_filter, force=force)
            total_success += success

        conn.close()
        logger.info(f"\n✅ 智能补充完成! 共处理 {total_success} 条分析")
        return

    elif days:
        logger.info(f"📅 最近 {days} 天模式")
        current = datetime.now(BEIJING_TZ)
        count = 0
        for i in range(days * 2):
            check_date = (current - timedelta(days=i)).strftime("%Y-%m-%d")
            market = get_market_from_symbol(targets[0]) if targets else "CN"
            if is_trading_day(check_date, market=market):
                target_dates.append(check_date)
                count += 1
                if count >= days:
                    break
        target_dates.reverse()

    elif start_date and end_date:
        logger.info(f"📅 日期范围模式: {start_date} 到 {end_date}")
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            logger.error("❌ 日期格式错误，请使用 YYYY-MM-DD")
            conn.close()
            return

        if start_dt > end_dt:
            logger.error("❌ 起始日期不能晚于结束日期")
            conn.close()
            return

        current = start_dt
        market = get_market_from_symbol(targets[0]) if targets else "CN"
        while current <= end_dt:
            date_str = current.strftime("%Y-%m-%d")
            if is_trading_day(date_str, market=market):
                target_dates.append(date_str)
            current += timedelta(days=1)

    elif date:
        target_dates = [date]
    else:
        logger.error("❌ 未指定日期参数，请使用 --date, --days, --start-date/--end-date, 或 --auto-fill")
        conn.close()
        return

    if not target_dates:
        logger.warning("⚠️ 指定范围内没有交易日")
        conn.close()
        return

    logger.info(f"📋 目标日期: {target_dates}")
    logger.info(f"📋 目标股票: {len(targets)} 只")

    # 3. 执行分析
    start_time = time.time()
    total_success = 0
    total_skipped = 0

    for date_str in target_dates:
        market = get_market_from_symbol(targets[0]) if targets else "CN"

        if not is_trading_day(date_str, market=market):
            weekday = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")
            logger.warning(f"⚠️ {date_str} ({weekday}) 非交易日，跳过")
            total_skipped += 1
            continue

        logger.info(f"\n{'=' * 50}")
        logger.info(f"🗓️ 分析日期: {date_str}")
        logger.info(f"{'=' * 50}")

        success = _analyze_stocks_for_date(conn, targets, date_str, model_filter=model_filter, force=force, tracker=tracker)
        total_success += success

    conn.close()
    duration = round(time.time() - start_time, 1)

    return {
        "success": total_success,
        "skipped_days": total_skipped,
        "period": f"{target_dates[0]} ~ {target_dates[-1]}" if len(target_dates) > 1 else target_dates[0],
        "duration": duration,
    }


def _analyze_stocks_for_date(conn, stocks: list, date_str: str, model_filter: str = None, force: bool = False, tracker=None) -> int:
    """为指定日期分析一组股票，返回成功数量。"""
    success_count = 0

    from engine.runner import PredictionRunner
    import asyncio
    import os

    runner = PredictionRunner(model_filter=model_filter, force=force)

    if os.name == 'nt':
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except Exception:
            pass

    for stock in stocks:
        try:
            query = "SELECT * FROM daily_prices WHERE symbol = ? AND date = ?"
            df = pd.read_sql_query(query, conn, params=(stock, date_str))

            if df.empty:
                logger.warning(f"   ⚠️ {stock}: {date_str} 无数据，跳过")
                continue

            row = df.iloc[0]

            if pd.isna(row.get('ma5')) or pd.isna(row.get('rsi')):
                logger.warning(f"   ⚠️ {stock}: {date_str} 指标不完整，跳过")
                continue

            logger.info(f"   >>> 分析 {stock} ({date_str})")

            result = asyncio.run(runner.run_analysis(stock, date_str, data=None, force=force))
            if result:
                success_count += 1

                if tracker:
                    from backend.analysis.user_tracker import notify_user_prediction_updated
                    ready_users = tracker.mark_stock_complete(stock)
                    for uid in ready_users:
                        mkt = "CN" if len(stock) > 5 else "HK"
                        if model_filter and model_filter in ["CN", "HK"]:
                            mkt = model_filter
                        notify_user_prediction_updated(uid, market=mkt)

            try:
                validate_previous_prediction(stock, row)
            except Exception as e:
                logger.warning(f"   ⚠️ {stock} 验证失败: {e}")

        except Exception as e:
            logger.error(f"   ❌ {stock} 分析失败: {e}")

    return success_count
