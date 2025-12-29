"""
StockWise ETL Pipeline - Orchestrator
模块化重构版
"""

import sys
import argparse
import time
import io

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
from engine.indicators import calculate_indicators
from engine.ai_service import generate_ai_prediction
from engine.validator import validate_previous_prediction

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
        print(f"\n⏱️ [实时重算] 正在更新盘中指标: {symbol}")
    else:
        print(f"\n🔍 检查 {period} 状态: {symbol}")
    
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
        print(f"✨ 数据已是最新 ({last_date_str})。")
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
    
    # 注意: AI 预测逻辑已分离，请使用 --analyze 单独运行

def sync_spot_prices(symbols: list):
    """盘中实时同步"""
    start_time = time.time()
    success_count = 0
    errors = []
    
    print(f"\n⚡ 正在执行盘中实时同步 - 针对 {len(symbols)} 只股票")
    for symbol in symbols:
        try:
            process_stock_period(symbol, period="daily", is_realtime=True)
            success_count += 1
        except Exception as e:
            errors.append(f"Stock {symbol} error: {str(e)[:100]}")

    duration = time.time() - start_time
    status = "✅ SUCCESS" if success_count > 0 else "❌ FAILED"
    
    report = f"### 🛠️ StockWise: Realtime Sync\n"
    report += f"> **Status**: {status}\n"
    report += f"- **Processed**: {success_count}/{len(symbols)}\n"
    report += f"- **Duration**: {duration:.1f}s"
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
            print(f"   💎 检测到 Pro 用户关注，启用 AI 深度分析")
        else:
            print(f"   ⚪ 仅普通用户关注，使用规则引擎")
            
        return mode
    except Exception as e:
        print(f"   ⚠️ 权限检查失败 ({e})，默认使用 AI")
        return 'ai'

def run_ai_analysis(symbol: str = None, market_filter: str = None):
    """独立运行 AI 预测任务"""
    targets = []
    if symbol:
        targets = [symbol]
    else:
        pool = get_stock_pool()
        if not pool:
            print("⚠️ 股票池为空")
            return
        
        # 按市场过滤
        if market_filter:
            for s in pool:
                is_hk = len(s) == 5
                if (market_filter == "HK" and is_hk) or (market_filter == "CN" and not is_hk):
                    targets.append(s)
        else:
            targets = pool
    
    print(f"\n🧠 开始执行 AI 分析任务，共 {len(targets)} 只股票...")
    start_time = time.time()
    success_count = 0
    
    conn = get_connection()
    
    for stock in targets:
        try:
            # 获取该股票最新的日线数据 (含指标)
            query = f"SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1"
            df = pd.read_sql_query(query, conn, params=(stock,))
            
            if df.empty:
                print(f"⚠️ {stock}: 无行情数据，跳过")
                continue
                
            today_data = df.iloc[0]
            print(f"\n>>> 分析 {stock} ({today_data['date']})")
            
            # 确定分析模式 (AI vs Rule)
            analysis_mode = check_stock_analysis_mode(stock)
            
            # 生成预测
            generate_ai_prediction(stock, today_data, mode=analysis_mode)
            success_count += 1
            
        except Exception as e:
            print(f"❌ {stock} 分析失败: {e}")
            
    conn.close()
    duration = time.time() - start_time
    print(f"\n✅ AI 分析完成! 成功: {success_count}/{len(targets)}, 耗时: {duration:.1f}s")


def run_full_sync(market_filter: str = None):
    """每日全量同步
    
    Args:
        market_filter: 可选，过滤市场 ("CN" 或 "HK")，None 表示全部
    """
    target_stocks = get_stock_pool()
    if not target_stocks:
        print("⚠️ 股票池为空")
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
        print(f"⚠️ {market_filter} 市场股票池为空")
        return

    start_time = time.time()
    success_count = 0
    errors = []
    
    for stock in target_stocks:
        try:
            process_stock_period(stock, period="daily")
            process_stock_period(stock, period="weekly")
            process_stock_period(stock, period="monthly")
            success_count += 1
        except Exception as e:
            errors.append(f"{stock} error: {str(e)[:100]}")
    
    duration = time.time() - start_time
    market_label = f" ({market_filter})" if market_filter else ""
    report = f"### 📊 StockWise: Daily Sync{market_label}\n"
    report += f"> **Status**: {'✅' if not errors else '⚠️'}\n"
    report += f"- **Target**: {len(target_stocks)} Stocks\n"
    report += f"- **Periods**: 日线(D), 周线(W), 月线(M) ✅\n"
    report += f"- **Processed**: {success_count} Success, {len(errors)} Errors\n"
    report += f"- **Duration**: {duration:.1f}s"
    send_wecom_notification(report)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='StockWise ETL Pipeline')
    parser.add_argument('--realtime', action='store_true', help='执行盘中实时同步')
    parser.add_argument('--sync-meta', action='store_true', help='仅同步股票元数据')
    parser.add_argument('--analyze', action='store_true', help='执行 AI 预测分析 (独立任务)')
    parser.add_argument('--symbol', type=str, help='指定股票代码')
    parser.add_argument('--market', type=str, choices=['CN', 'HK'], help='只同步/分析特定市场')
    
    args = parser.parse_args()
    init_db()
    
    if args.sync_meta:
        sync_stock_meta()
        # 同步完基础列表后，顺便更新一波公司概况 (每次20个)
        sync_profiles(limit=20)
    elif args.analyze:
        # 独立运行 AI 分析
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
            print(f"❌ {args.symbol} 同步失败: {e}")
            import traceback
            traceback.print_exc()
        
        duration = time.time() - start_time
        
        # 发送通知
        if success:
            report = f"### ✅ StockWise: On-Demand Sync\n"
            report += f"> **Symbol**: {args.symbol}\n"
            report += f"- **Status**: 成功\n"
            report += f"- **Periods**: 日线 + 周线 + 月线\n"
            report += f"- **Duration**: {duration:.1f}s"
        else:
            report = f"### ❌ StockWise: On-Demand Sync Failed\n"
            report += f"> **Symbol**: {args.symbol}\n"
            report += f"- **Status**: 失败\n"
            report += f"- **Error**: {error_msg[:200]}\n"
            report += f"- **Duration**: {duration:.1f}s"
        
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

