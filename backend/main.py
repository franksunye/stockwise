"""
StockWise ETL Pipeline - Orchestrator
模块化重构版
"""

import sys
import argparse
import time
import io
from concurrent.futures import ThreadPoolExecutor, as_completed

# 修复 Windows 控制台编码问题
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except (AttributeError, io.UnsupportedOperation):
        pass

import pandas as pd
from datetime import datetime, timedelta

from config import BEIJING_TZ
from database import init_db, get_connection, get_stock_pool
from fetchers import sync_stock_meta, fetch_stock_data, sync_profiles
from utils import send_wecom_notification
from notifications import send_push_notification
from engine.indicators import calculate_indicators
from engine.ai_service import generate_ai_prediction
from engine.validator import validate_previous_prediction
from logger import logger

def get_last_date(symbol: str, table: str = "daily_prices") -> str:
    """获取数据库中某支股票的最后日期"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT MAX(date) FROM {table} WHERE symbol = ?", (symbol,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row and row[0] else None

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
        buffer_days = 80
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
    
    # 3. 验证昨日预测（仅在全量同步时执行，盘中价格不稳定不适合验证）
    if period == "daily" and not df.empty and not is_realtime:
        validate_previous_prediction(symbol, df.iloc[-1])

    # 4. 判断是否需要更新
    if last_date_str and df["date"].max() < last_date_str:
        logger.info(f"✨ 数据已是最新 ({last_date_str})。")
        return

    # 5. 计算指标
    df = calculate_indicators(df)
    
    # 6. 入库
    conn = get_connection()
    cursor = conn.cursor()
    records = []
    
    # 定义舍入函数
    def r2(x): return round(float(x), 2) if x else 0
    def r3(x): return round(float(x), 3) if x else 0
    def r1(x): return round(float(x), 1) if x else 0

    for _, row in df.iterrows():
        records.append((
            symbol, row["date"], r2(row["open"]), r2(row["high"]), r2(row["low"]), r2(row["close"]),
            int(row["volume"]), r2(row["change_percent"]),
            r2(row["ma5"]), r2(row["ma10"]), r2(row["ma20"]), r2(row["ma60"]),
            r3(row["macd"]), r3(row["macd_signal"]), r3(row["macd_hist"]),
            r2(row["boll_upper"]), r2(row["boll_mid"]), r2(row["boll_lower"]),
            r1(row["rsi"]), r1(row["kdj_k"]), r1(row["kdj_d"]), r1(row["kdj_j"]), None
        ))
    
    cursor.executemany(f"""
        INSERT OR REPLACE INTO {table_name} 
        (symbol, date, open, high, low, close, volume, change_percent,
         ma5, ma10, ma20, ma60, macd, macd_signal, macd_hist,
         boll_upper, boll_mid, boll_lower, rsi, kdj_k, kdj_d, kdj_j, ai_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, records)
    conn.commit()
    conn.close()
    
    # 7. 实时更新推送 (仅在盘中实时模式下触发)
    if is_realtime:
        last_row = df.iloc[-1]
        change = float(last_row['change_percent'])
        price = float(last_row['close'])
        
        # 尝试从数据库获取中文简称
        stock_name = symbol
        try:
            cursor.execute("SELECT name FROM stock_meta WHERE symbol = ?", (symbol,))
            row_meta = cursor.fetchone()
            if row_meta:
                stock_name = row_meta[0]
        except: pass
        
        emoji = "🚀" if change >= 3 else ("📈" if change > 0 else ("🔹" if change == 0 else "📉"))
        title = f"{stock_name} ({symbol}) {emoji} {change:+.2f}%"
        body = f"最新: {price} | 成交: {int(last_row['volume'])}"
        
        # 发送给关注该股票的用户，使用 symbol 作为 tag 实现同一个股票通知覆盖
        send_push_notification(
            title=title, 
            body=body, 
            url=f"/dashboard?symbol={symbol}", 
            related_symbol=symbol,
            tag=f"price_update_{symbol}"
        )
    
    # 注意: AI 预测逻辑已分离，请使用 --analyze 单独运行

def sync_spot_prices(symbols: list):
    """盘中实时同步"""
    start_time = time.time()
    success_count = 0
    errors = []
    
    logger.info(f"⚡ 启动并发盘中同步 (Workers=4) - 针对 {len(symbols)} 只股票")
    
    def sync_single_realtime(stock):
        try:
            process_stock_period(stock, period="daily", is_realtime=True)
            return True
        except Exception as e:
            raise e

    with ThreadPoolExecutor(max_workers=4) as executor:
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
    status = "✅ SUCCESS" if success_count > 0 else "❌ FAILED"
    
    report = f"### 🛠️ StockWise: Realtime Sync\n"
    report += f"> **Status**: {status}\n"
    report += f"- **Processed**: {success_count}/{len(symbols)}\n"
    report += f"- **执行耗时**: {duration:.1f}s"
    send_wecom_notification(report)

def check_stock_analysis_mode(symbol: str) -> str:
    """检查股票分析模式：如果有 Pro/Premium 用户关注，则使用 AI，否则使用 Rules"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 获取当前 UTC 时间字符串进行比较 (格式兼容 ISO)
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
        
        # 检查是否有有效期内的付费用户关注
        query = """
        SELECT COUNT(*) FROM users u
        JOIN user_watchlist w ON u.user_id = w.user_id
        WHERE w.symbol = ? 
        AND u.subscription_tier IN ('pro', 'premium')
        AND (u.subscription_expires_at IS NULL OR u.subscription_expires_at > ?)
        """
        cursor.execute(query, (symbol, now_str))
        row = cursor.fetchone()
        count = row[0] if row else 0
        conn.close()
        
        mode = 'ai' if count > 0 else 'rule'
        if mode == 'ai':
            logger.info(f"   💎 检测到 Pro 用户关注，启用 AI 深度分析")
        else:
            logger.info(f"   ⚪ 仅普通用户关注，使用规则引擎")
            
        return mode
    except Exception as e:
        logger.warning(f"   ⚠️ 权限检查失败 ({e})，默认使用 AI")
        return 'ai'

def run_ai_analysis(symbol: str = None, market_filter: str = None):
    """独立运行 AI 预测任务"""
    targets = []
    if symbol:
        targets = [symbol]
    else:
        pool = get_stock_pool()
        if not pool:
            logger.warning("⚠️ 股票池为空")
            return
        
        # 按市场过滤
        if market_filter:
            for s in pool:
                is_hk = len(s) == 5
                if (market_filter == "HK" and is_hk) or (market_filter == "CN" and not is_hk):
                    targets.append(s)
        else:
            targets = pool
    
    logger.info(f"🧠 开始执行 AI 分析任务，共 {len(targets)} 只股票...")
    start_time = time.time()
    success_count = 0
    
    conn = get_connection()
    
    for stock in targets:
        try:
            # 获取该股票最新的日线数据 (含指标)
            query = f"SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1"
            df = pd.read_sql_query(query, conn, params=(stock,))
            
            if df.empty:
                logger.warning(f"⚠️ {stock}: 无行情数据，跳过")
                continue
                
            today_data = df.iloc[0]
            logger.info(f">>> 分析 {stock} ({today_data['date']})")
            
            # 确定分析模式 (AI vs Rule)
            analysis_mode = check_stock_analysis_mode(stock)
            
            # 生成预测
            generate_ai_prediction(stock, today_data, mode=analysis_mode)
            success_count += 1
            
        except Exception as e:
            logger.error(f"❌ {stock} 分析失败: {e}")
            
    conn.close()
    duration = time.time() - start_time
    logger.info(f"✅ AI 分析完成! 成功: {success_count}/{len(targets)}, 耗时: {duration:.1f}s")
    
    # 发送企微通知
    market_label = f" ({market_filter})" if market_filter else ""
    report = f"### 🧠 StockWise: AI Analysis{market_label}\n"
    report += f"> **Status**: ✅ 完成\n"
    report += f"- **Processed**: {success_count}/{len(targets)} Stocks\n"
    report += f"- **处理耗时**: {duration:.1f}s"
    send_wecom_notification(report)
    
    # 发送 Web Push 广播 (所有订阅用户)
    send_push_notification(
        title="🤖 AI 日报生成完毕",
        body=f"已完成 {len(targets)} 只股票的深度分析，点击查看今日重点情报。",
        url="/dashboard",
        broadcast=True,
        tag="daily_report"
    )


def run_ai_analysis_backfill(
    symbol: str = None,
    market_filter: str = None,
    date: str = None,
    start_date: str = None,
    end_date: str = None,
    days: int = None,
    auto_fill: bool = False
):
    """
    AI 分析回填功能
    
    支持多种模式：
    - 单日模式: date="2025-12-30"
    - 日期范围: start_date="2025-12-23", end_date="2025-12-30"
    - 最近N天: days=7
    - 智能补充: auto_fill=True
    """
    from trading_calendar import is_trading_day, get_market_from_symbol
    
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
            success = _analyze_stocks_for_date(conn, stocks_to_fill, date_str)
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
        
        success = _analyze_stocks_for_date(conn, targets, date_str)
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


def _analyze_stocks_for_date(conn, stocks: list, date_str: str) -> int:
    """为指定日期分析一组股票，返回成功数量"""
    success_count = 0
    
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
            logger.info(f"       ✅ 数据校验: 收盘={row['close']}, MA5={row['ma5']:.2f}, RSI={row['rsi']:.1f}")
            
            # 确定分析模式
            analysis_mode = check_stock_analysis_mode(stock)
            
            # 生成预测 (传入 as_of_date 用于回填场景，确保 prompt 使用历史数据)
            generate_ai_prediction(stock, row, mode=analysis_mode, as_of_date=date_str)
            success_count += 1
            
        except Exception as e:
            logger.error(f"   ❌ {stock} 分析失败: {e}")
    
    return success_count


def run_full_sync(market_filter: str = None):
    """每日全量同步
    
    Args:
        market_filter: 可选，过滤市场 ("CN" 或 "HK")，None 表示全部
    """
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
    
    # 使用线程池并发同步 (Max Workers = 4)
    # 避免并发过高导致数据库被锁或 IP 被封
    logger.info(f"🚀 启动并发同步 (Workers=4)...")
    
    def sync_single_stock(stock):
        """单个股票的全量同步任务"""
        try:
            # 日线是必须的
            process_stock_period(stock, period="daily")
            # 周月线偶尔失败不影响核心体验
            try: process_stock_period(stock, period="weekly")
            except: pass 
            try: process_stock_period(stock, period="monthly")
            except: pass
            return True
        except Exception as e:
            raise e

    with ThreadPoolExecutor(max_workers=4) as executor:
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

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='StockWise ETL Pipeline')
    parser.add_argument('--realtime', action='store_true', help='执行盘中实时同步')
    parser.add_argument('--sync-meta', action='store_true', help='仅同步股票元数据')
    parser.add_argument('--analyze', action='store_true', help='执行 AI 预测分析 (独立任务)')
    parser.add_argument('--symbol', type=str, help='指定股票代码')
    parser.add_argument('--market', type=str, choices=['CN', 'HK'], help='只同步/分析特定市场')
    
    # 新增: 回填功能参数
    parser.add_argument('--date', type=str, help='指定分析日期 (YYYY-MM-DD)')
    parser.add_argument('--start-date', type=str, help='日期范围起始 (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='日期范围结束 (YYYY-MM-DD)')
    parser.add_argument('--days', type=int, help='回填最近N天')
    parser.add_argument('--auto-fill', action='store_true', help='智能检测并补充缺失分析')
    
    args = parser.parse_args()
    init_db()
    
    # 判断是否为回填模式
    is_backfill_mode = args.date or args.start_date or args.end_date or args.days or args.auto_fill
    
    if args.sync_meta:
        sync_stock_meta()
        # 同步完基础列表后，顺便更新一波公司概况 (每次20个)
        sync_profiles(limit=20)
    elif args.analyze and is_backfill_mode:
        # 回填模式: 分析指定日期的历史数据
        run_ai_analysis_backfill(
            symbol=args.symbol,
            market_filter=args.market,
            date=args.date,
            start_date=getattr(args, 'start_date', None),
            end_date=getattr(args, 'end_date', None),
            days=args.days,
            auto_fill=args.auto_fill
        )
    elif args.analyze:
        # 独立运行 AI 分析 (分析最新数据)
        run_ai_analysis(symbol=args.symbol, market_filter=args.market)
    elif args.symbol:
        # On-Demand Sync: 需要错误处理和通知
        start_time = time.time()
        success = True
        error_msg = None
        
        try:
            process_stock_period(args.symbol, period="daily")
            process_stock_period(args.symbol, period="weekly")
            process_stock_period(args.symbol, period="monthly")
        except Exception as e:
            success = False
            error_msg = str(e)
            logger.error(f"❌ {args.symbol} 同步失败: {e}")
            import traceback
            traceback.print_exc()
        
        duration = time.time() - start_time
        
        # 发送通知
        if success:
            report = f"### ✅ StockWise: On-Demand Sync\n"
            report += f"> **Symbol**: {args.symbol}\n"
            report += f"- **Status**: 成功\n"
            report += f"- **Periods**: 日线 + 周线 + 月线\n"
            report += f"- **执行耗时**: {duration:.1f}s"
        else:
            report = f"### ❌ StockWise: On-Demand Sync Failed\n"
            report += f"> **Symbol**: {args.symbol}\n"
            report += f"- **Status**: 失败\n"
            report += f"- **Error**: {error_msg[:200]}\n"
            report += f"- **执行耗时**: {duration:.1f}s"
        
        send_wecom_notification(report)
        
        # 确保失败时返回非零退出码
        if not success:
            sys.exit(1)
    elif args.realtime:
        sync_spot_prices(get_stock_pool())
    else:
        run_full_sync(market_filter=args.market)
        
    # 强制退出，防止 libsql-client 后台线程导致进程挂起
    sys.exit(0)

