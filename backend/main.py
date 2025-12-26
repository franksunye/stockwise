"""
StockWise ETL Pipeline - Orchestrator
模块化重构版
"""

import sys
import argparse
import time
import pandas as pd
from datetime import datetime, timedelta

from config import BEIJING_TZ
from database import init_db, get_connection, get_stock_pool
from fetchers import sync_stock_meta, fetch_stock_data
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
    
    # 3. 验证昨日预测
    if period == "daily" and not df.empty:
        validate_previous_prediction(symbol, df.iloc[-1])

    # 4. 判断是否需要更新
    if last_date_str and df["date"].max() < last_date_str:
        print(f"✨ 数据已是最新 ({last_date_str})。")
        if period == "daily":
             conn = get_connection()
             df_last = pd.read_sql(f"SELECT * FROM {table_name} WHERE symbol='{symbol}' ORDER BY date DESC LIMIT 1", conn)
             conn.close()
             if not df_last.empty:
                 generate_ai_prediction(symbol, df_last.iloc[0])
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
    
    # 7. 生成明日预测
    if period == "daily":
        generate_ai_prediction(symbol, df.iloc[-1])

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

def run_full_sync():
    """每日全量同步"""
    target_stocks = get_stock_pool()
    if not target_stocks:
        print("⚠️ 股票池为空")
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
    report = f"### 📊 StockWise: Daily Full Sync\n"
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
    parser.add_argument('--symbol', type=str, help='同步特定股票')
    
    args = parser.parse_args()
    init_db()
    
    if args.sync_meta:
        sync_stock_meta()
    elif args.symbol:
        process_stock_period(args.symbol, period="daily")
        process_stock_period(args.symbol, period="weekly")
        process_stock_period(args.symbol, period="monthly")
    elif args.realtime:
        sync_spot_prices(get_stock_pool())
    else:
        run_full_sync()
