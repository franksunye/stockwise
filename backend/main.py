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
from libsql_experimental import connect

# ============================================================
# 配置
# ============================================================

# 数据库路径/连接
DB_PATH = Path(__file__).parent.parent / "data" / "stockwise.db"
TURSO_DB_URL = os.getenv("TURSO_DB_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")


def get_stock_pool():
    """从数据库获取核心股票池"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT symbol FROM stock_pool ORDER BY added_at")
    stocks = [row[0] for row in cursor.fetchall()]
    conn.close()
    return stocks

# ============================================================
# 数据库操作
# ============================================================

def get_connection():
    """获取数据库连接 (支持本地 SQLite 或 Turso)"""
    if TURSO_DB_URL:
        # 使用 Turso 远程连接
        return connect(TURSO_DB_URL, auth_token=TURSO_AUTH_TOKEN)
    else:
        # 使用本地 SQLite
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        import sqlite3
        return sqlite3.connect(DB_PATH)


def init_db():
    """初始化数据库表结构 (持久化版)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. 基础行情表 (日/周)
    def create_table_sql(table_name):
        return f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            open REAL, high REAL, low REAL, close REAL, volume REAL, change_percent REAL,
            ma5 REAL, ma10 REAL, ma20 REAL, ma60 REAL,
            macd REAL, macd_signal REAL, macd_hist REAL,
            boll_upper REAL, boll_mid REAL, boll_lower REAL,
            rsi REAL, kdj_k REAL, kdj_d REAL, kdj_j REAL,
            ai_summary TEXT,
            PRIMARY KEY (symbol, date)
        )
        """

    cursor.execute(create_table_sql("daily_prices"))
    cursor.execute(create_table_sql("weekly_prices"))
    
    # 2. 股票元数据表 (编号、名称、市场)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_meta (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            market TEXT NOT NULL,
            last_updated TEXT
        )
    """)
    
    # 3. 股票池表 (管理后台配置)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_pool (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 初始化核心股票池 (如果为空)
    cursor.execute("SELECT COUNT(*) FROM stock_pool")
    if cursor.fetchone()[0] == 0:
        initial_stocks = [
            ('02171', '映客'),
            ('02269', '药明生物'),
            ('01801', '信达生物'),
            ('00700', '腾讯控股'),
            ('09988', '阿里巴巴-SW'),
            ('03690', '美团-W'),
            ('01024', '快手-W'),
            ('02015', '理想汽车-W'),
            ('09868', '小鹏汽车-W'),
            ('01810', '小米集团-W'),
        ]
        cursor.executemany(
            "INSERT INTO stock_pool (symbol, name) VALUES (?, ?)",
            initial_stocks
        )
        print(f"   已初始化 {len(initial_stocks)} 只核心股票")
    
    conn.commit()
    conn.close()
    print(f"✅ 数据库准备就绪 (日线/周线/元数据/股票池): {DB_PATH}")


def sync_stock_meta():
    """同步股票基础信息 (名称、市场)"""
    print("\n📦 同步股票元数据...")
    
    try:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        all_records = []

        # 1. 获取港股列表
        try:
            hk_stocks = ak.stock_hk_spot_em()
            if not hk_stocks.empty:
                symbol_col = "代码" if "代码" in hk_stocks.columns else "symbol"
                name_col = "名称" if "名称" in hk_stocks.columns else "name"
                for _, row in hk_stocks.iterrows():
                    symbol = str(row[symbol_col])
                    if symbol.isdigit():
                        all_records.append((symbol, row[name_col], "HK", now_str))
                print(f"   已获取 {len(hk_stocks)} 条港股元数据")
        except Exception as e:
            print(f"   ⚠️ 港股列表获取失败: {e}")

        # 2. 获取 A 股列表
        try:
            a_stocks = ak.stock_zh_a_spot_em()
            if not a_stocks.empty:
                symbol_col = "代码" if "代码" in a_stocks.columns else "symbol"
                name_col = "名称" if "名称" in a_stocks.columns else "name"
                for _, row in a_stocks.iterrows():
                    symbol = str(row[symbol_col])
                    if symbol.isdigit():
                        all_records.append((symbol, row[name_col], "CN", now_str))
                print(f"   已获取 {len(a_stocks)} 条 A 股元数据")
        except Exception as e:
            print(f"   ⚠️ A 股列表获取失败: {e}")

        if not all_records:
            return

        # 3. 批量写入
        conn = get_connection()
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT OR REPLACE INTO stock_meta (symbol, name, market, last_updated)
            VALUES (?, ?, ?, ?)
        """, all_records)
        conn.commit()
        conn.close()
        print(f"✅ 元数据同步完成，共已更新 {len(all_records)} 条记录")

    except Exception as e:
        print(f"❌ 元数据同步失败: {e}")


def get_last_date(symbol: str, table: str = "daily_prices") -> str:
    """获取数据库中某支股票的最后日期"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT MAX(date) FROM {table} WHERE symbol = ?", (symbol,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row and row[0] else None


# ============================================================
# 数据处理
# ============================================================

def fetch_stock_data(symbol: str, period: str = "daily", start_date: str = None) -> pd.DataFrame:
    """获取历史行情数据"""
    if not start_date:
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")
    
    print(f"📡 正在获取 {symbol} {period} 数据 (从 {start_date} 起)...")
    
    try:
        df = ak.stock_hk_hist(
            symbol=symbol,
            period=period,  # "daily", "weekly", "monthly"
            start_date=start_date,
            end_date=datetime.now().strftime("%Y%m%d"),
            adjust="qfq"
        )
        return df
    except Exception as e:
        print(f"❌ {symbol} {period} 获取失败: {e}")
        return pd.DataFrame()


def process_stock_period(symbol: str, period: str = "daily"):
    """增量处理特定周期的股票数据"""
    table_name = f"{period}_prices"
    print(f"\n🔍 检查 {period} 状态: {symbol}")
    
    # 1. 守门员检查 (Gatekeeper)
    last_date_str = get_last_date(symbol, table_name)
    
    # 2. 计算抓取起始点 (Buffer: 日线取 150天, 周线取 150周 -> 约3年)
    buffer_days = 150 if period == "daily" else 150 * 7
    if last_date_str:
        last_dt = datetime.strptime(last_date_str, "%Y-%m-%d")
        fetch_dt = last_dt - timedelta(days=buffer_days)
        fetch_start_str = fetch_dt.strftime("%Y%m%d")
        print(f"🌊 发现更新需求。最后日期: {last_date_str}，回溯起点: {fetch_start_str}")
    else:
        fetch_start_str = (datetime.now() - timedelta(days=365 * 3)).strftime("%Y%m%d")
        print(f"🆕 数据库无记录。执行全量初始化 (3年)...")

    # 3. 抓取数据
    df = fetch_stock_data(symbol, period=period, start_date=fetch_start_str)
    if df.empty:
        return
    
    # 4. 数据清洗
    df = df.rename(columns={
        "日期": "date", "开盘": "open", "收盘": "close", 
        "最高": "high", "最低": "low", "成交量": "volume", "涨跌幅": "change_percent"
    })
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    
    # 幂等性检查：如果最新 K 线没变化，跳过
    if last_date_str and df["date"].max() <= last_date_str:
        print(f"✨ 数据已是最新 ({last_date_str})。停止。")
        return

    # 5. 计算指标
    print(f"📊 计算 {period} 技术指标...")
    df["ma5"] = df.ta.sma(length=5, close="close")
    df["ma10"] = df.ta.sma(length=10, close="close")
    df["ma20"] = df.ta.sma(length=20, close="close")
    df["ma60"] = df.ta.sma(length=60, close="close")
    
    macd = df.ta.macd(close="close", fast=12, slow=26, signal=9)
    if macd is not None:
        df["macd"] = macd.iloc[:, 0]
        df["macd_signal"] = macd.iloc[:, 1]
        df["macd_hist"] = macd.iloc[:, 2]
    
    bbands = df.ta.bbands(close="close", length=20, std=2)
    if bbands is not None:
        df["boll_lower"] = bbands.iloc[:, 0]
        df["boll_mid"] = bbands.iloc[:, 1]
        df["boll_upper"] = bbands.iloc[:, 2]
    
    df["rsi"] = df.ta.rsi(length=14, close="close")
    
    stoch = df.ta.stoch(high="high", low="low", close="close", k=9, d=3, smooth_k=3)
    if stoch is not None:
        df["kdj_k"] = stoch.iloc[:, 0]
        df["kdj_d"] = stoch.iloc[:, 1]
        df["kdj_j"] = 3 * stoch.iloc[:, 0] - 2 * stoch.iloc[:, 1]
    
    df = df.fillna(0)
    df["ai_summary"] = None
    
    # 6. 批量写入
    print(f"💾 写入 {period} 数据 ({len(df)} 条)...")
    conn = get_connection()
    cursor = conn.cursor()
    
    def r2(x): return round(x, 2) if x else 0
    def r3(x): return round(x, 3) if x else 0
    def r1(x): return round(x, 1) if x else 0
    
    records = []
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
    print(f"✅ {symbol} {period} 同步完成")


def show_latest_data(symbol: str, period: str = "daily", limit: int = 3):
    """显示最新数据"""
    table = f"{period}_prices"
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT date, close, ma5, macd FROM {table} WHERE symbol = ? ORDER BY date DESC LIMIT ?", (symbol, limit))
    rows = cursor.fetchall()
    conn.close()
    
    if rows:
        print(f"   [{period.upper()}] 最新数据: {rows[0][0]} Close: {rows[0][1]:.2f} MA5: {rows[0][2]:.2f}")


# ============================================================
# 主入口
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("StockWise ETL Pipeline - [日线/周线/元数据] 增量多引擎版")
    print("=" * 60)
    
    init_db()
    
    # 1. 元数据同步 (MVP 阶段跳过，仅在需要时手动执行)
    # sync_stock_meta()  # 耗时较长，仅在需要更新全市场股票名称时执行
    
    # 2. 从数据库获取核心股票池
    target_stocks = get_stock_pool()
    print(f"\n📊 核心股票池: {len(target_stocks)} 只股票")
    print(f"   {', '.join(target_stocks)}")
    
    # 3. 处理目标股票行情
    for stock in target_stocks:
        print(f"\n🚀 处理股票: {stock}")
        print("-" * 30)
        # 先处理日线
        process_stock_period(stock, period="daily")
        # 再处理周线
        process_stock_period(stock, period="weekly")
        
        # 验证显示
        show_latest_data(stock, period="daily")
        show_latest_data(stock, period="weekly")
    
    print("\n" + "=" * 60)
    print("🎉 全部处理完成!")
    print("=" * 60)
