"""
StockWise ETL Pipeline
本地开发版 - 使用 SQLite
"""

import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

# 北京时区 (UTC+8)
BEIJING_TZ = timezone(timedelta(hours=8))

import akshare as ak
import pandas as pd
import pandas_ta_classic as ta
import ssl

# 解决 Pandas 2.2+ 的 FutureWarnings
pd.set_option('future.no_silent_downcasting', True)

# 解决某些环境下 akshare 接口的 SSL 握手问题
try:
    ssl._create_default_https_context = ssl._create_unverified_context
except:
    pass
try:
    from libsql_experimental import connect
except ImportError:
    connect = None

from pypinyin import pinyin, Style

# ============================================================
# 配置
# ============================================================

# 数据库路径/连接
DB_PATH = Path(__file__).parent.parent / "data" / "stockwise.db"
TURSO_DB_URL = os.getenv("TURSO_DB_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")


def get_stock_pool():
    """从全局股票池获取需要同步的股票 (仅同步有人关注的股票)"""
    conn = get_connection()
    cursor = conn.cursor()
    # 只同步有人关注的股票 (watchers_count > 0)
    # watchers_count = 0 表示系统默认池，可选择性同步
    cursor.execute("SELECT symbol FROM global_stock_pool WHERE watchers_count > 0 ORDER BY watchers_count DESC")
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
        print(f"🔗 连接 Turso: {TURSO_DB_URL[:50]}...")
        return connect(TURSO_DB_URL, auth_token=TURSO_AUTH_TOKEN)
    else:
        # 使用本地 SQLite
        print(f"⚠️ TURSO_DB_URL 未设置，使用本地 SQLite: {DB_PATH}")
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
    
    # 2. 股票元数据表 (编号、名称、市场、拼音搜索支持)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_meta (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            market TEXT NOT NULL,
            last_updated TEXT,
            pinyin TEXT,
            pinyin_abbr TEXT
        )
    """)
    
    # 3. 核心股票池 (系统级同步目标)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_pool (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 4. 全局股票池 (带关注计数的聚合表)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS global_stock_pool (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            first_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            watchers_count INTEGER DEFAULT 1,
            last_synced_at TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_global_pool_watchers ON global_stock_pool(watchers_count)")

    # 5. 用户系统表 (用于多用户关注计数)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            email TEXT,
            registration_type TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_registration_type ON users(registration_type)")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_watchlist (
            user_id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, symbol),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_watchlist_user ON user_watchlist(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_watchlist_symbol ON user_watchlist(symbol)")

    # 6. AI 预测与验证表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ai_predictions (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,          -- 预测生成日 (T)
            target_date TEXT NOT NULL,   -- 预测目标日 (T+1)
            signal TEXT,                 -- Long/Short/Side
            confidence REAL,             -- 置信度 (0-1)
            support_price REAL,          -- AI 建议支撑位
            ai_reasoning TEXT,           -- AI 理由
            validation_status TEXT DEFAULT 'Pending', -- Correct/Incorrect/Pending
            actual_change REAL,          -- 实际涨跌幅
            PRIMARY KEY (symbol, date)
        )
    """)
    
    # 验证全局股票池是否有数据
    cursor.execute("SELECT COUNT(*) FROM global_stock_pool WHERE watchers_count > 0")
    active_stocks_count = cursor.fetchone()[0]
    
    if active_stocks_count == 0:
        print("   ⚠️ 全局股票池为空，ETL 将不会同步任何股票")
        print("   💡 提示: 用户需要在前端添加关注的股票后，ETL 才会开始同步数据")
    else:
        print(f"   ✅ 全局股票池已有 {active_stocks_count} 只活跃股票")
    
    conn.commit()
    conn.close()
    db_info = TURSO_DB_URL[:50] + "..." if TURSO_DB_URL else str(DB_PATH)
    print(f"✅ 数据库准备就绪: {db_info}")


def sync_stock_meta():
    """同步股票基础信息 (名称、市场、拼音)"""
    print("\n📦 同步股票元数据...")
    
    def get_pinyin_info(name):
        """生成全拼和首字母简写"""
        try:
            # 转换为全拼 (不带声调): 'pingan'
            full_pinyin = "".join([i[0] for i in pinyin(name, style=Style.NORMAL)])
            # 转换为首字母简写: 'pa'
            abbr_pinyin = "".join([i[0][0] for i in pinyin(name, style=Style.FIRST_LETTER)])
            return full_pinyin.lower(), abbr_pinyin.lower()
        except:
            return "", ""

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
                    name = str(row[name_col])
                    if symbol.isdigit():
                        py, abbr = get_pinyin_info(name)
                        all_records.append((symbol, name, "HK", now_str, py, abbr))
                print(f"   已获取 {len(hk_stocks)} 条港股元数据")
        except Exception as e:
            print(f"   ⚠️ 港股列表获取失败: {e}")

        # 2. 获取 A 股列表 (分层次尝试以提高稳定性)
        try:
            print("   正在获取 A 股列表...")
            # 策略 A: 直接调用东财 HTTP 接口 (跳过 SSL 问题，最快最全)
            try:
                import requests
                # 包含沪深主要板块的 A 股 (m:0 t:6, m:1 t:2, m:1 t:23)
                url = "http://82.push2.eastmoney.com/api/qt/clist/get"
                params = {
                    "pn": "1", "pz": "6000", "po": "1", "np": "1", 
                    "ut": "bd1d9ddb04089700cf9c27f6f7426281",
                    "fltt": "2", "invt": "2", "fid": "f12",
                    "fs": "m:0+t:6,m:1+t:2,m:1+t:23,m:0+t:80", # 沪深+北交所
                    "fields": "f12,f14"
                }
                resp = requests.get(url, params=params, timeout=10)
                data = resp.json()
                stocks = data.get("data", {}).get("diff", [])
                if stocks:
                    for s in stocks:
                        symbol = str(s["f12"])
                        name = str(s["f14"])
                        if symbol.isdigit():
                            py, abbr = get_pinyin_info(name)
                            all_records.append((symbol, name, "CN", now_str, py, abbr))
                    print(f"   ✅ 已通过 HTTP API 成功获取 {len(stocks)} 条 A 股全量元数据")
            except Exception as e_http:
                print(f"   ⚠️ HTTP 接口获取失败 ({e_http})，尝试策略 B (AkShare)...")
                # 策略 B: 尝试通过 AkShare 官方推荐接口
                try:
                    a_stocks = ak.stock_zh_a_spot_em()
                    if not a_stocks.empty:
                        symbol_col = "代码" if "代码" in a_stocks.columns else "symbol"
                        name_col = "名称" if "名称" in a_stocks.columns else "name"
                        for _, row in a_stocks.iterrows():
                            symbol = str(row[symbol_col])
                            name = str(row[name_col])
                            if symbol.isdigit():
                                py, abbr = get_pinyin_info(name)
                                all_records.append((symbol, name, "CN", now_str, py, abbr))
                        print(f"   ✅ 已成功通过 AkShare 获取 {len(a_stocks)} 条 A 股元数据")
                except Exception as e_em:
                    print(f"   ⚠️ AkShare 获取失败 ({e_em})，尝试策略 C (分交易所备份)...")
                    # 策略 C: 分交易所获取备份
                    exchange_configs = [
                        ("SH", ak.stock_info_sh_name_code, ["主板A股", "科创板"]),
                        ("SZ", ak.stock_info_sz_name_code, ["A股列表", "创业板"]),
                        ("BJ", ak.stock_info_bj_name_code, [None])
                    ]
                    for ex_name, func, symbols in exchange_configs:
                        for sym in symbols:
                            try:
                                m_df = func(symbol=sym) if sym else func()
                                if not m_df.empty:
                                    s_col = next((c for c in ["证券代码", "A股代码", "代码", "code"] if c in m_df.columns), None)
                                    n_col = next((c for c in ["证券简称", "A股简称", "名称", "name"] if c in m_df.columns), None)
                                    if s_col and n_col:
                                        count = 0
                                        for _, row in m_df.iterrows():
                                            symbol = str(row[s_col]).strip()
                                            name = str(row[n_col]).strip()
                                            if symbol.isdigit():
                                                py, abbr = get_pinyin_info(name)
                                                all_records.append((symbol, name, "CN", now_str, py, abbr))
                                                count += 1
                                        print(f"   已从 {ex_name}:{sym or 'ALL'} 获取 {count} 条元数据")
                            except Exception as e_m:
                                print(f"   ⚠️ {ex_name}:{sym} 获取失败: {e_m}")
        except Exception as e:
            print(f"   ⚠️ A 股列表整体获取异常: {e}")

        if not all_records:
            return

        # 3. 批量写入
        conn = get_connection()
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT OR REPLACE INTO stock_meta (symbol, name, market, last_updated, pinyin, pinyin_abbr)
            VALUES (?, ?, ?, ?, ?, ?)
        """, all_records)
        conn.commit()
        conn.close()
        print(f"✅ 元数据同步完成，共已更新 {len(all_records)} 条记录 (包含拼音索引)")

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

def get_market(symbol: str) -> str:
    """获取股票所属市场 (CN/HK)"""
    # 优先从数据库查询
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT market FROM stock_meta WHERE symbol = ?", (symbol,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return row[0]
    except:
        pass
    
    # 启发式判断: 5位是港股，6位是A股
    if len(symbol) == 5:
        return "HK"
    return "CN"


def fetch_stock_data(symbol: str, period: str = "daily", start_date: str = None) -> pd.DataFrame:
    """获取历史行情数据 (支持 A/H)"""
    if not start_date:
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")
    
    market = get_market(symbol)
    print(f"📡 正在获取 {market}:{symbol} {period} 数据 (从 {start_date} 起)...")
    
    try:
        if market == "HK":
            df = ak.stock_hk_hist(
                symbol=symbol,
                period=period,
                start_date=start_date,
                end_date=datetime.now().strftime("%Y%m%d"),
                adjust="qfq"
            )
        else:
            # A 股处理
            df = ak.stock_zh_a_hist(
                symbol=symbol,
                period=period,
                start_date=start_date,
                end_date=datetime.now().strftime("%Y%m%d"),
                adjust="qfq"
            )
        return df
    except Exception as e:
        print(f"❌ {symbol} {period} 获取失败: {e}")
        return pd.DataFrame()


def validate_previous_prediction(symbol: str, today_data: pd.Series):
    """验证昨日的 AI 预测 (T-1 预测 T)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 查找距离今日最近的一条待验证预测 (必须是今日之前的预测)
    today_str = today_data['date']
    cursor.execute("""
        SELECT date, signal, support_price 
        FROM ai_predictions 
        WHERE symbol = ? AND validation_status = 'Pending' AND date < ?
        ORDER BY date DESC LIMIT 1
    """, (symbol, today_str))
    
    row = cursor.fetchone()
    if not row:
        conn.close()
        return
        
    pred_date, signal, support_price = row
    
    # 获取今日收盘价和涨跌幅
    actual_change = today_data.get('change_percent', 0)
    close_price = today_data.get('close', 0)
    
    # 简易验证逻辑
    status = 'Neutral'
    if signal == 'Long':
        # 看多：涨了就是对的，跌了就是错的
        status = 'Correct' if actual_change > 0 else 'Incorrect'
    elif signal == 'Short':
        # 看空：跌了就是对的，涨了就是错的
        status = 'Correct' if actual_change < 0 else 'Incorrect'
    elif signal == 'Side':
        # 观望：波动较小视为中性或准确 (这里暂定 Neutral)
        status = 'Neutral'

    # 更新数据库
    cursor.execute("""
        UPDATE ai_predictions 
        SET validation_status = ?, actual_change = ?
        WHERE symbol = ? AND date = ?
    """, (status, actual_change, symbol, pred_date))
    
    conn.commit()
    conn.close()
    print(f"   🔎 验证昨日预测 ({pred_date}): 信号={signal}, 今日实际涨幅={actual_change}%, 结论={status}")


def generate_ai_prediction(symbol: str, today_data: pd.Series):
    """根据今日行情生成对明日的 AI 预测 (T 预测 T+1)"""
    import json
    
    # 模拟更复杂的战术决策逻辑
    close = today_data.get('close', 0)
    ma20 = today_data.get('ma20', 0)
    rsi = today_data.get('rsi', 50)
    support_price = today_data.get('ma20', close * 0.95)
    
    # [核心变化] 动态调整信号
    # 如果是盘中实时价，信号要根据当前与支撑位的关系敏感变动
    if close < support_price * 0.98:
        signal = 'Short' # 严重破位
    elif close > ma20:
        signal = 'Long' # 趋势向上
    else:
        signal = 'Side' # 震荡
        
    if 45 <= rsi <= 55 and signal != 'Short': signal = 'Side'
    
    tactics = {
        "holding": [
            {"p": "P1", "a": "止损/减仓", "c": f"跌破 {support_price:.2f} 且30分钟不收回", "r": "防止趋势转盈为亏"},
            {"p": "P2", "a": "持仓待涨", "c": "股价运行在MA20上方", "r": "跟随趋势"}
        ],
        "empty": [
            {"p": "P1", "a": "观望/谨慎", "c": f"等待站稳 {ma20:.2f} 且放量", "r": "右侧交易更稳健"},
            {"p": "P2", "a": "小仓试错", "c": f"回踩 {support_price:.2f} 不破", "r": "博取反弹"}
        ]
    }
    
    reasoning_data = {
        "summary": f"当前价 {'站稳' if close > ma20 else '跌破'} MA20，RSI 指标显示{'动能充沛' if rsi > 50 else '超卖反弹需求'}。",
        "tactics": tactics,
        "conflict": "趋势优先（MA20） > 动能（RSI）"
    }
    
    reasoning = json.dumps(reasoning_data, ensure_ascii=False)
    confidence = 0.72 if signal != 'Side' else 0.5

    # 存储到数据库
    conn = get_connection()
    cursor = conn.cursor()
    
    # 预测日期是今天 T，目标日期是明天 T+1
    today_str = today_data.get('date')
    if not today_str:
        return
        
    dt = datetime.strptime(today_str, "%Y-%m-%d")
    target_date = (dt + timedelta(days=1)).strftime("%Y-%m-%d")

    cursor.execute("""
        INSERT OR REPLACE INTO ai_predictions 
        (symbol, date, target_date, signal, confidence, support_price, ai_reasoning, validation_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')
    """, (symbol, today_str, target_date, signal, confidence, support_price, reasoning))
    
    conn.commit()
    conn.close()
    print(f"   🔮 系统决策同步 ({today_str}): 信号={signal}, 置信度={confidence}")
    return signal, support_price


def send_wecom_notification(content: str):
    """发送企业微信机器人通知"""
    import requests
    wecom_key = os.getenv("WECOM_ROBOT_KEY")
    if not wecom_key:
        return
    
    url = f"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={wecom_key}"
    data = {
        "msgtype": "markdown",
        "markdown": {
            "content": content
        }
    }
    try:
        response = requests.post(url, json=data, timeout=10)
        if response.status_code == 200:
            print("   📲 企微实时报告已推送")
        else:
            print(f"   ⚠️ 企微推送失败: {response.text}")
    except Exception as e:
        print(f"   ⚠️ 企微网络异常: {e}")


def sync_spot_prices(symbols: list):
    """同步盘中实时价格 (Spot) - System Ops 版本"""
    import time
    start_time = time.time()
    
    success_count = 0
    errors = []
    
    print(f"\n⚡ 正在执行盘中实时同步 (精简模式) - 针对 {len(symbols)} 只关注股票")
    
    try:
        for symbol in symbols:
            try:
                # 利用 akshare 的 history 接口获取包含当日实时数据的日线行情
                # 这种方式是 symbol-specific 的，避免了全量同步 4000+ 股票导致的 SSL 错误
                process_stock_period(symbol, period="daily", is_realtime=True)
                success_count += 1
                print(f"   ✅ {symbol} 实时同步完成")
            except Exception as e:
                errors.append(f"Stock {symbol} processing error: {str(e)[:100]}")
    except Exception as e:
        errors.append(f"Global processing Error: {str(e)[:100]}")

    # 发送系统运维报告
    duration = time.time() - start_time
    status = "✅ SUCCESS" if not errors and success_count > 0 else "⚠️ PARTIAL" if success_count > 0 else "❌ FAILED"
    
    ops_report = f"### 🛠️ StockWise Ops: Realtime Sync\n"
    ops_report += f"> **Status**: {status}\n"
    ops_report += f"- **Time**: {datetime.now(BEIJING_TZ).strftime('%Y-%m-%d %H:%M:%S')}\n"
    ops_report += f"- **Duration**: {duration:.2f}s\n"
    ops_report += f"- **Processed**: {success_count}/{len(symbols)} stocks\n"
    
    if errors:
        ops_report += f"\n**Errors ({len(errors)})**:\n"
        ops_report += "\n".join([f"- {err}" for err in errors[:5]]) # 最多显示5条错误
        
    send_wecom_notification(ops_report)
    print(f"✅ 盘中实时任务处理完成 (Success: {success_count})")


def process_stock_period(symbol: str, period: str = "daily", is_realtime: bool = False):
    """增量处理特定周期的股票数据"""
    table_name = f"{period}_prices"
    if is_realtime:
        print(f"\n⏱️ [实时重算] 正在更新盘中指标: {symbol}")
    else:
        print(f"\n🔍 检查 {period} 状态: {symbol}")
    
    # 1. 守门员检查 (Gatekeeper)
    last_date_str = get_last_date(symbol, table_name)
    
    # 2. 计算抓取起始点
    # 日线取 80 天回溯 (满足 MA60 稳定性)，周线取 150 周 (约 3 年)
    if period == "daily":
        buffer_days = 80
    else:
        buffer_days = 150 * 7
    
    if last_date_str:
        last_dt = datetime.strptime(last_date_str, "%Y-%m-%d")
        fetch_dt = last_dt - timedelta(days=buffer_days)
        fetch_start_str = fetch_dt.strftime("%Y%m%d")
        if is_realtime:
            print(f"   🌊 盘中回溯起点: {fetch_start_str} (满足指标平滑)")
        else:
            print(f"   🌊 发现更新需求。最后日期: {last_date_str}，回溯起点: {fetch_start_str}")
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
    
    # 5. [核心] 验证昨日预测 (仅针对日线)
    if period == "daily" and not df.empty:
        latest_row = df.iloc[-1]
        validate_previous_prediction(symbol, latest_row)

    # 幂等性检查：如果最新 K 线没变化，说明行情和指标已完整入库
    # 修改：为了支持修正当日错误股价，即使日期相同也允许更新 (改为 < 而不是 <=)
    if last_date_str and df["date"].max() < last_date_str:
        print(f"✨ 数据已是最新 ({last_date_str})。")
        # 如果是日线，确保今日预测已生成
        if period == "daily":
             # 从数据库读取带指标的最新一行
             conn = get_connection()
             df_last = pd.read_sql(f"SELECT * FROM {table_name} WHERE symbol='{symbol}' ORDER BY date DESC LIMIT 1", conn)
             conn.close()
             if not df_last.empty:
                 generate_ai_prediction(symbol, df_last.iloc[0])
        return

    # 6. 计算指标
    if is_realtime:
        print(f"   📊 正在计算实时技术指标...")
    else:
        print(f"📊 计算 {period} 技术指标...")
        
    # 为防止某些环境下 ta 返回 DataFrame 而非 Series，统一使用 iloc 取第一列
    df["ma5"] = ta.sma(df["close"], length=5)
    df["ma10"] = ta.sma(df["close"], length=10)
    df["ma20"] = ta.sma(df["close"], length=20)
    df["ma60"] = ta.sma(df["close"], length=60)
    
    # 额外处理：如果 ta 函数返回的是 DataFrame (带有列名)，显式转为 Series
    for col in ["ma5", "ma10", "ma20", "ma60"]:
        if isinstance(df[col], pd.DataFrame):
            df[col] = df[col].iloc[:, 0]
    
    macd = ta.macd(df["close"], fast=12, slow=26, signal=9)
    if macd is not None:
        # MACD 结果通常是 DataFrame，包含 MACD, Signal, Hist
        df["macd"] = macd.iloc[:, 0]
        df["macd_signal"] = macd.iloc[:, 1]
        df["macd_hist"] = macd.iloc[:, 2]
    
    bbands = ta.bbands(df["close"], length=20, std=2)
    if bbands is not None:
        df["boll_lower"] = bbands.iloc[:, 0]
        df["boll_mid"] = bbands.iloc[:, 1]
        df["boll_upper"] = bbands.iloc[:, 2]
    
    df["rsi"] = ta.rsi(df["close"], length=14)
    if isinstance(df["rsi"], pd.DataFrame):
        df["rsi"] = df["rsi"].iloc[:, 0]
    
    stoch = ta.stoch(high=df["high"], low=df["low"], close=df["close"], k=9, d=3, smooth_k=3)
    if stoch is not None:
        df["kdj_k"] = stoch.iloc[:, 0]
        df["kdj_d"] = stoch.iloc[:, 1]
        df["kdj_j"] = 3 * stoch.iloc[:, 0] - 2 * stoch.iloc[:, 1]
    
    df = df.fillna(0).infer_objects(copy=False)
    df["ai_summary"] = None
    
    # 6. 批量写入
    if is_realtime:
        print(f"   💾 更新 {period} 实时数据...")
    else:
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
    
    # 7. 生成今日预测 (仅针对日线)
    if period == "daily":
        generate_ai_prediction(symbol, df.iloc[-1])


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
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='StockWise ETL Pipeline')
    parser.add_argument('--realtime', action='store_true', help='执行盘中实时同步')
    parser.add_argument('--sync-meta', action='store_true', help='仅同步股票基础元数据')
    parser.add_argument('--symbol', type=str, help='同步特定股票')
    
    args = parser.parse_args()

    print("=" * 60)
    mode = "META" if args.sync_meta else ("REALTIME" if args.realtime else ("SINGLE:"+args.symbol if args.symbol else "FULL"))
    print(f"StockWise ETL Pipeline - [{mode}] Sync Mode")
    print("=" * 60)
    
    init_db()
    
    if args.sync_meta:
        sync_stock_meta()
        print("\n✅ 元数据同步任务结束。")
        sys.exit(0)

    if args.symbol:
        target_stocks = [args.symbol]
    else:
        # 获取核心股票池
        target_stocks = get_stock_pool()
    
    if not target_stocks:
        # 如果 global_stock_pool 为空，尝试从 stock_pool 获取 (兼容旧版)
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT symbol FROM stock_pool")
        target_stocks = [row[0] for row in cursor.fetchall()]
        conn.close()

    if not target_stocks:
        print("⚠️ 股票池为空，退出。")
        sys.exit(0)

    print(f"\n📊 目标股票池: {len(target_stocks)} 只股票")

    if args.symbol:
        # 单独同步模式
        print(f"\n🚀 [即时同步] 处理股票: {args.symbol}")
        process_stock_period(args.symbol, period="daily")
        process_stock_period(args.symbol, period="weekly")
    elif args.realtime:
        # 实时同步模式 (5分钟一次，由外部调度或简易循环)
        sync_spot_prices(target_stocks)
    else:
        # 全量/增量历史同步模式 (System Ops 视角)
        import time
        start_time = time.time()
        success_count = 0
        errors = []
        
        for stock in target_stocks:
            print(f"\n🚀 处理股票: {stock}")
            print("-" * 30)
            try:
                process_stock_period(stock, period="daily")
                process_stock_period(stock, period="weekly")
                success_count += 1
            except Exception as e:
                print(f"   ❌ {stock} 处理失败: {e}")
                errors.append(f"{stock} sync error: {str(e)[:100]}")
        
        # 发送每日运维总结
        duration = time.time() - start_time
        status = "✅ SUCCESS" if not errors and success_count > 0 else "❌ FAILED"
        
        ops_report = f"### 📊 StockWise Ops: Daily Full Sync\n"
        ops_report += f"> **Status**: {status}\n"
        ops_report += f"- **Date**: {datetime.now(BEIJING_TZ).strftime('%Y-%m-%d')}\n"
        ops_report += f"- **Duration**: {duration:.1f}s\n"
        ops_report += f"- **Processed**: {success_count}/{len(target_stocks)} stocks\n"
        
        if errors:
            ops_report += f"\n**Critical Errors**:\n"
            ops_report += "\n".join([f"- {err}" for err in errors[:5]])
            
        send_wecom_notification(ops_report)
    
    print("\n" + "=" * 60)
    print("🎉 全部处理完成!")
    print("=" * 60)
