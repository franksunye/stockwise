import sqlite3
from config import DB_PATH, TURSO_DB_URL, TURSO_AUTH_TOKEN

try:
    from libsql_experimental import connect
except ImportError:
    connect = None

def get_connection():
    """获取数据库连接 (支持本地 SQLite 或 Turso)"""
    if TURSO_DB_URL:
        print(f"🔗 连接 Turso: {TURSO_DB_URL[:50]}...")
        return connect(TURSO_DB_URL, auth_token=TURSO_AUTH_TOKEN)
    else:
        print(f"⚠️ TURSO_DB_URL 未设置，使用本地 SQLite: {DB_PATH}")
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        return sqlite3.connect(DB_PATH)

def init_db():
    """初始化数据库表结构"""
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
    cursor.execute(create_table_sql("monthly_prices"))
    
    # 2. 股票元数据表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_meta (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            market TEXT NOT NULL,
            last_updated TEXT,
            pinyin TEXT,
            pinyin_abbr TEXT,
            industry TEXT,
            main_business TEXT,
            description TEXT
        )
    """)

    # 检查所有必要的列是否存在，如果不存在则添加 (Schema Evolution)
    # 对于 SQLite/Turso，不能通过 CREATE TABLE IF NOT EXISTS 自动添加新列
    # 需要手动检查并 ALTER TABLE
    try:
        cursor.execute("PRAGMA table_info(stock_meta)")
        columns = [info[1] for info in cursor.fetchall()]
        
        expected_columns = {
            "industry": "TEXT",
            "main_business": "TEXT", 
            "description": "TEXT"
        }
        
        for col_name, col_type in expected_columns.items():
            if col_name not in columns:
                print(f"🛠️ 更新数据库: 添加 stock_meta.{col_name}")
                cursor.execute(f"ALTER TABLE stock_meta ADD COLUMN {col_name} {col_type}")
                
    except Exception as e:
        print(f"⚠️ 检查/更新表结构失败: {e}")

    # 3. 核心股票池
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_pool (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 4. 全局股票池
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

    # 5. 用户系统表
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

    # 6. AI 预测与验证表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ai_predictions (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            target_date TEXT NOT NULL,
            signal TEXT,
            confidence REAL,
            support_price REAL,
            ai_reasoning TEXT,
            validation_status TEXT DEFAULT 'Pending',
            actual_change REAL,
            PRIMARY KEY (symbol, date)
        )
    """)
    
    conn.commit()
    conn.close()
    print("✅ 数据库结构检查/初始化完成")

def get_stock_pool():
    """从全局股票池获取需要同步的股票 (仅同步有人关注的股票)"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT symbol FROM global_stock_pool 
        WHERE watchers_count > 0 
        ORDER BY watchers_count DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]

def get_stock_profile(symbol: str):
    """
    获取股票的公司概况信息
    返回: (industry, main_business, description) 或 None
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT industry, main_business, description FROM stock_meta WHERE symbol = ?", (symbol,))
    row = cursor.fetchone()
    conn.close()
    return row
