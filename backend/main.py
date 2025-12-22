"""
StockWise ETL Pipeline
本地开发版 - 使用 SQLite
"""

import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

import akshare as ak
import pandas as pd
import pandas_ta as ta

# ============================================================
# 配置
# ============================================================

# 目标股票池 (港股代码)
TARGET_STOCKS = ["02171"]  # 科济药业

# 数据库路径
DB_PATH = Path(__file__).parent.parent / "data" / "stockwise.db"

# ============================================================
# 数据库操作
# ============================================================

def get_connection():
    """获取数据库连接"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(DB_PATH)


def init_db():
    """初始化数据库表结构"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_prices (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume REAL,
            change_percent REAL,
            ma20 REAL,
            rsi REAL,
            ai_summary TEXT,
            PRIMARY KEY (symbol, date)
        )
    """)
    
    conn.commit()
    conn.close()
    print(f"✅ 数据库初始化完成: {DB_PATH}")


# ============================================================
# 数据处理
# ============================================================

def fetch_stock_data(symbol: str, days: int = 365) -> pd.DataFrame:
    """
    从 Akshare 获取港股历史数据
    
    Args:
        symbol: 港股代码 (如 '02171')
        days: 获取最近多少天的数据
        
    Returns:
        DataFrame with OHLCV data
    """
    print(f"📡 正在获取 {symbol} 数据...")
    
    try:
        # 港股日线数据
        df = ak.stock_hk_hist(
            symbol=symbol,
            period="daily",
            start_date=(datetime.now() - timedelta(days=days)).strftime("%Y%m%d"),
            end_date=datetime.now().strftime("%Y%m%d"),
            adjust="qfq"  # 前复权
        )
        
        if df.empty:
            print(f"⚠️ {symbol} 无数据返回")
            return pd.DataFrame()
            
        print(f"   获取到 {len(df)} 条记录")
        return df
        
    except Exception as e:
        print(f"❌ {symbol} 获取失败: {e}")
        return pd.DataFrame()


def process_stock(symbol: str):
    """处理单支股票：下载 -> 计算指标 -> 入库"""
    
    print(f"\n🚀 开始处理: {symbol}")
    print("=" * 50)
    
    # 1. 获取数据
    df = fetch_stock_data(symbol)
    if df.empty:
        return
    
    # 2. 数据清洗 (重命名为英文)
    df = df.rename(columns={
        "日期": "date",
        "开盘": "open",
        "收盘": "close",
        "最高": "high",
        "最低": "low",
        "成交量": "volume",
        "涨跌幅": "change_percent"
    })
    
    # 确保日期格式
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    
    # 3. 计算技术指标
    print("📊 计算技术指标...")
    
    # MA20
    df["ma20"] = df.ta.sma(length=20, close="close")
    
    # RSI (14)
    df["rsi"] = df.ta.rsi(length=14, close="close")
    
    # 4. 填充 NaN (计算指标的前几天是空的)
    df = df.fillna(0)
    
    # 5. AI 点评 (本地开发暂用占位符)
    df["ai_summary"] = "暂无AI点评"
    
    # 6. 写入数据库
    print("💾 写入数据库...")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    records = []
    for _, row in df.iterrows():
        records.append((
            symbol,
            row["date"],
            row["open"],
            row["high"],
            row["low"],
            row["close"],
            row["volume"],
            row["change_percent"],
            row["ma20"],
            row["rsi"],
            row["ai_summary"]
        ))
    
    cursor.executemany("""
        INSERT OR REPLACE INTO daily_prices 
        (symbol, date, open, high, low, close, volume, change_percent, ma20, rsi, ai_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, records)
    
    conn.commit()
    conn.close()
    
    print(f"✅ {symbol} 同步完成，共 {len(records)} 条记录")


def show_latest_data(symbol: str, limit: int = 5):
    """显示最新数据 (验证用)"""
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT date, close, change_percent, ma20, rsi
        FROM daily_prices
        WHERE symbol = ?
        ORDER BY date DESC
        LIMIT ?
    """, (symbol, limit))
    
    rows = cursor.fetchall()
    conn.close()
    
    if rows:
        print(f"\n📈 {symbol} 最新 {limit} 条数据:")
        print("-" * 60)
        print(f"{'日期':<12} {'收盘价':>10} {'涨跌幅':>10} {'MA20':>10} {'RSI':>8}")
        print("-" * 60)
        for row in rows:
            date, close, change, ma20, rsi = row
            print(f"{date:<12} {close:>10.2f} {change:>9.2f}% {ma20:>10.2f} {rsi:>8.1f}")


# ============================================================
# 主入口
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("StockWise ETL Pipeline - 本地开发版")
    print("=" * 60)
    
    # 初始化数据库
    init_db()
    
    # 处理所有目标股票
    for stock in TARGET_STOCKS:
        process_stock(stock)
        show_latest_data(stock)
    
    print("\n" + "=" * 60)
    print("🎉 全部处理完成!")
    print("=" * 60)
