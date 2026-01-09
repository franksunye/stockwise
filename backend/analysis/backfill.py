"""
AI 分析回填模块
支持历史数据的补充分析
"""
import time
from datetime import datetime, timedelta

import pandas as pd

from config import BEIJING_TZ
from database import get_connection, get_stock_pool
from utils import send_wecom_notification
from engine.ai_service import generate_ai_prediction
from engine.validator import validate_previous_prediction
from trading_calendar import is_trading_day, get_market_from_symbol
from helpers import check_stock_analysis_mode
from logger import logger


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
    
    # 2. 确定目标日期列表
    target_dates = []
    today = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
    
    if auto_fill:
        # 智能模式：查找有行情数据但缺少分析的日期
        logger.info("🔍 智能模式：扫描缺失分析的日期...")
        
        query = """
        SELECT DISTINCT dp.date, dp.symbol
        FROM daily_prices dp
        LEFT JOIN ai_predictions ap ON dp.symbol = ap.symbol AND dp.date = ap.date
        WHERE dp.symbol IN ({}) AND ap.date IS NULL
        ORDER BY dp.date DESC
        LIMIT 100
        """.format(','.join(['?'] * len(targets)))
        
        cursor = conn.cursor()
        cursor.execute(query, targets)
        missing = cursor.fetchall()
        
        if not missing:
            logger.info("✅ 没有缺失的分析，所有数据已完整")
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
        # 最近N天模式
        logger.info(f"📅 最近 {days} 天模式")
        current = datetime.now(BEIJING_TZ)
        count = 0
        for i in range(days * 2):  # 预留buffer处理非交易日
            check_date = (current - timedelta(days=i)).strftime("%Y-%m-%d")
            market = get_market_from_symbol(targets[0]) if targets else "CN"
            if is_trading_day(check_date, market=market):
                target_dates.append(check_date)
                count += 1
                if count >= days:
                    break
        target_dates.reverse()  # 按时间顺序
        
    elif start_date and end_date:
        # 日期范围模式
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
        # 单日模式
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
        
        # 交易日检查
        if not is_trading_day(date_str, market=market):
            weekday = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")
            logger.warning(f"⚠️ {date_str} ({weekday}) 非交易日，跳过")
            total_skipped += 1
            continue
        
        logger.info(f"\n{'='*50}")
        logger.info(f"🗓️ 分析日期: {date_str}")
        logger.info(f"{'='*50}")
        
        success = _analyze_stocks_for_date(conn, targets, date_str, model_filter=model_filter, force=force)
        total_success += success
    
    conn.close()
    duration = time.time() - start_time
    
    logger.info(f"\n✅ 回填完成!")
    logger.info(f"   成功: {total_success} 条")
    logger.info(f"   跳过: {total_skipped} 天 (非交易日)")
    logger.info(f"   耗时: {duration:.1f}s")
    
    # 发送通知
    report = f"### 📅 StockWise: AI Backfill\n"
    report += f"> **Status**: ✅ 完成\n"
    report += f"- **日期**: {target_dates[0] if len(target_dates)==1 else f'{target_dates[0]} ~ {target_dates[-1]}'}\n"
    report += f"- **成功**: {total_success} 条分析\n"
    report += f"- **耗时**: {duration:.1f}s"
    send_wecom_notification(report)


def _analyze_stocks_for_date(conn, stocks: list, date_str: str, model_filter: str = None, force: bool = False) -> int:
    """为指定日期分析一组股票，返回成功数量"""
    success_count = 0
    
    # Use PredictionRunner for multi-model support
    from engine.runner import PredictionRunner
    import asyncio
    import os
    
    runner = PredictionRunner(model_filter=model_filter, force=force)
    
    # Windows event loop policy
    if os.name == 'nt':
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except: pass
    
    for stock in stocks:
        try:
            # 获取该日期的行情数据
            query = "SELECT * FROM daily_prices WHERE symbol = ? AND date = ?"
            df = pd.read_sql_query(query, conn, params=(stock, date_str))
            
            if df.empty:
                logger.warning(f"   ⚠️ {stock}: {date_str} 无数据，跳过")
                continue
            
            row = df.iloc[0]
            
            # 指标完整性检查
            if pd.isna(row.get('ma5')) or pd.isna(row.get('rsi')):
                logger.warning(f"   ⚠️ {stock}: {date_str} 指标不完整，跳过")
                continue
            
            logger.info(f"   >>> 分析 {stock} ({date_str})")
            
            # Run prediction - Pass data=None to force PredictionRunner to fetch FULL context (Strict Parity)
            asyncio.run(runner.run_analysis(stock, date_str, data=None, force=force))
            success_count += 1
            
            # Sync back validation logic
            try:
                 validate_previous_prediction(stock, row)
            except Exception as e:
                 logger.warning(f"   ⚠️ {stock} 验证失败: {e}")
            
        except Exception as e:
            logger.error(f"   ❌ {stock} 分析失败: {e}")
    
    return success_count
