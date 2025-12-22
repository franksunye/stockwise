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
    
    # 删除旧表，重建新结构 (开发阶段)
    cursor.execute("DROP TABLE IF EXISTS daily_prices")
    
    cursor.execute("""
        CREATE TABLE daily_prices (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            
            -- 基础行情
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume REAL,
            change_percent REAL,
            
            -- 均线系统
            ma5 REAL,
            ma10 REAL,
            ma20 REAL,
            ma60 REAL,
            
            -- MACD
            macd REAL,
            macd_signal REAL,
            macd_hist REAL,
            
            -- 布林带
            boll_upper REAL,
            boll_mid REAL,
            boll_lower REAL,
            
            -- RSI
            rsi REAL,
            
            -- KDJ
            kdj_k REAL,
            kdj_d REAL,
            kdj_j REAL,
            
            -- AI 层
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
    
    # === 均线系统 ===
    df["ma5"] = df.ta.sma(length=5, close="close")
    df["ma10"] = df.ta.sma(length=10, close="close")
    df["ma20"] = df.ta.sma(length=20, close="close")
    df["ma60"] = df.ta.sma(length=60, close="close")
    
    # === MACD (12, 26, 9) ===
    macd = df.ta.macd(close="close", fast=12, slow=26, signal=9)
    if macd is not None:
        df["macd"] = macd.iloc[:, 0]       # MACD 线
        df["macd_signal"] = macd.iloc[:, 1] # 信号线
        df["macd_hist"] = macd.iloc[:, 2]   # 柱状图
    else:
        df["macd"] = df["macd_signal"] = df["macd_hist"] = 0
    
    # === 布林带 (20, 2) ===
    bbands = df.ta.bbands(close="close", length=20, std=2)
    if bbands is not None:
        df["boll_lower"] = bbands.iloc[:, 0]  # 下轨
        df["boll_mid"] = bbands.iloc[:, 1]    # 中轨
        df["boll_upper"] = bbands.iloc[:, 2]  # 上轨
    else:
        df["boll_lower"] = df["boll_mid"] = df["boll_upper"] = 0
    
    # === RSI (14) ===
    df["rsi"] = df.ta.rsi(length=14, close="close")
    
    # === KDJ (9, 3, 3) ===
    stoch = df.ta.stoch(high="high", low="low", close="close", k=9, d=3, smooth_k=3)
    if stoch is not None:
        df["kdj_k"] = stoch.iloc[:, 0]  # K 值
        df["kdj_d"] = stoch.iloc[:, 1]  # D 值
        df["kdj_j"] = 3 * stoch.iloc[:, 0] - 2 * stoch.iloc[:, 1]  # J = 3K - 2D
    else:
        df["kdj_k"] = df["kdj_d"] = df["kdj_j"] = 0
    
    # 4. 填充 NaN (计算指标的前几天是空的)
    df = df.fillna(0)
    
    # 5. AI 点评 (本地开发暂无，设为 None)
    df["ai_summary"] = None
    
    # 6. 写入数据库
    print("💾 写入数据库...")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # 辅助函数：保留小数位
    def r2(x): return round(x, 2) if x else 0  # 价格类：2位
    def r3(x): return round(x, 3) if x else 0  # 指标类：3位
    def r1(x): return round(x, 1) if x else 0  # 百分比：1位
    
    records = []
    for _, row in df.iterrows():
        records.append((
            symbol,
            row["date"],
            r2(row["open"]),
            r2(row["high"]),
            r2(row["low"]),
            r2(row["close"]),
            int(row["volume"]),           # 成交量取整
            r2(row["change_percent"]),
            r2(row["ma5"]),
            r2(row["ma10"]),
            r2(row["ma20"]),
            r2(row["ma60"]),
            r3(row["macd"]),
            r3(row["macd_signal"]),
            r3(row["macd_hist"]),
            r2(row["boll_upper"]),
            r2(row["boll_mid"]),
            r2(row["boll_lower"]),
            r1(row["rsi"]),
            r1(row["kdj_k"]),
            r1(row["kdj_d"]),
            r1(row["kdj_j"]),
            row["ai_summary"]             # None 或实际值
        ))
    
    cursor.executemany("""
        INSERT OR REPLACE INTO daily_prices 
        (symbol, date, open, high, low, close, volume, change_percent,
         ma5, ma10, ma20, ma60, macd, macd_signal, macd_hist,
         boll_upper, boll_mid, boll_lower, rsi, kdj_k, kdj_d, kdj_j, ai_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, records)
    
    conn.commit()
    conn.close()
    
    print(f"✅ {symbol} 同步完成，共 {len(records)} 条记录")


def show_latest_data(symbol: str, limit: int = 5):
    """显示最新数据 (验证用)"""
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT date, close, change_percent, ma5, ma20, macd, rsi, kdj_k
        FROM daily_prices
        WHERE symbol = ?
        ORDER BY date DESC
        LIMIT ?
    """, (symbol, limit))
    
    rows = cursor.fetchall()
    conn.close()
    
    if rows:
        print(f"\n📈 {symbol} 最新 {limit} 条数据:")
        print("-" * 80)
        print(f"{'日期':<12} {'收盘':>8} {'涨跌幅':>8} {'MA5':>8} {'MA20':>8} {'MACD':>8} {'RSI':>6} {'K':>6}")
        print("-" * 80)
        for row in rows:
            date, close, change, ma5, ma20, macd, rsi, k = row
            print(f"{date:<12} {close:>8.2f} {change:>7.2f}% {ma5:>8.2f} {ma20:>8.2f} {macd:>8.3f} {rsi:>6.1f} {k:>6.1f}")


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
