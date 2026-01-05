"""
StockWise Database Module (Raw Interface - No ORM)

回归纯粹的 DB-API 2.0 接口，放弃 SQLAlchemy。
在 Serverless (Turso) 环境下，无状态的短连接比连接池更稳定。
"""
import sqlite3
import libsql
import os
from pathlib import Path

from config import DB_PATH, TURSO_DB_URL, TURSO_AUTH_TOKEN
from logger import logger

def get_connection():
    """
    创建原始数据库连接。
    Strategy: Always New Connection (NullPool equivalent).
    """
    if TURSO_DB_URL:
        # logger.debug(f"🔗 [Raw] Connecting to Turso...")
        # sync client from libsql-experimental
        return libsql.connect(database=TURSO_DB_URL, auth_token=TURSO_AUTH_TOKEN)
    else:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        # logger.debug(f"📂 [Raw] Connecting to Local SQLite...")
        return sqlite3.connect(str(DB_PATH), timeout=30.0)

def close_global_connection():
    """兼容性桩函数，实际无需操作"""
    pass

def get_table_columns(cursor, table_name):
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        return [row[1] for row in cursor.fetchall()]
    except Exception:
        return []

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Price Tables
        for table in ["daily_prices", "weekly_prices", "monthly_prices"]:
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {table} (
                    symbol TEXT NOT NULL, date TEXT NOT NULL,
                    open REAL, high REAL, low REAL, close REAL, volume REAL, change_percent REAL,
                    ma5 REAL, ma10 REAL, ma20 REAL, ma60 REAL,
                    macd REAL, macd_signal REAL, macd_hist REAL,
                    boll_upper REAL, boll_mid REAL, boll_lower REAL,
                    rsi REAL, kdj_k REAL, kdj_d REAL, kdj_j REAL, ai_summary TEXT,
                    PRIMARY KEY (symbol, date)
                )
            """)
        
        # 2. Meta & Pool
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stock_meta (
                symbol TEXT PRIMARY KEY, name TEXT NOT NULL, market TEXT NOT NULL,
                last_updated TEXT, pinyin TEXT, pinyin_abbr TEXT,
                industry TEXT, main_business TEXT, description TEXT
            )
        """)
        cursor.execute("CREATE TABLE IF NOT EXISTS stock_pool (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
        cursor.execute("CREATE TABLE IF NOT EXISTS global_stock_pool (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, first_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, watchers_count INTEGER DEFAULT 1, last_synced_at TIMESTAMP)")
        
        # 3. User System
        cursor.execute("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, username TEXT, email TEXT, registration_type TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, subscription_tier TEXT DEFAULT 'free', subscription_expires_at TIMESTAMP)")
        cursor.execute("CREATE TABLE IF NOT EXISTS user_watchlist (user_id TEXT NOT NULL, symbol TEXT NOT NULL, added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, symbol))")
        cursor.execute("CREATE TABLE IF NOT EXISTS invitation_codes (code TEXT PRIMARY KEY, type TEXT NOT NULL, duration_days INTEGER DEFAULT 30, is_used BOOLEAN DEFAULT 0, used_by_user_id TEXT, used_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")

        # 4. AI & Traces
        cursor.execute("CREATE TABLE IF NOT EXISTS ai_predictions (symbol TEXT NOT NULL, date TEXT NOT NULL, target_date TEXT NOT NULL, signal TEXT, confidence REAL, support_price REAL, ai_reasoning TEXT, validation_status TEXT DEFAULT 'Pending', actual_change REAL, model TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (symbol, date))")
        cursor.execute("CREATE TABLE IF NOT EXISTS llm_traces (trace_id TEXT PRIMARY KEY, symbol TEXT, model TEXT, system_prompt TEXT, user_prompt TEXT, response_raw TEXT, response_parsed TEXT, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0, total_tokens INTEGER DEFAULT 0, latency_ms INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', error_message TEXT, retry_count INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
        
        # 5. Push Subs
        cursor.execute("CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_used_at TIMESTAMP, UNIQUE(user_id, endpoint))")

        # 6. Multi-Model V2
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prediction_models (
                model_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                provider TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                priority INTEGER DEFAULT 0,
                config_json TEXT,
                capabilities_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_predictions_v2 (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                model_id TEXT NOT NULL,
                target_date TEXT NOT NULL,
                signal TEXT,
                confidence REAL,
                support_price REAL,
                pressure_price REAL,
                ai_reasoning TEXT,
                prompt_version TEXT,
                token_usage_input INTEGER,
                token_usage_output INTEGER,
                execution_time_ms INTEGER,
                validation_status TEXT DEFAULT 'Pending',
                actual_change REAL,
                is_primary BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (symbol, date, model_id),
                FOREIGN KEY (model_id) REFERENCES prediction_models(model_id)
            )
        """)
        
        conn.commit()
        logger.info("✅ 数据库结构初始化完成 (Raw SQL - No ORM)")
        
    except Exception as e:
        logger.error(f"❌ 数据库初始化失败: {e}")
        raise e
    finally:
        conn.close()

def get_stock_pool():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT symbol FROM global_stock_pool WHERE watchers_count > 0 ORDER BY watchers_count DESC")
        return [row[0] for row in cursor.fetchall()]
    finally:
        conn.close()

def get_stock_profile(symbol: str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        # Handle dict access by converting tuple to dict if needed, or return tuple
        # But legacy code expects tuple-like or dict-like access?
        # Step 8 sync_profiles uses fetchone() and dict access via column name... wait.
        # Step 28 code yielded a RowProxy which supports both.
        # Raw sqlite3 Row supports both if row_factory is set.
        cursor.execute("SELECT industry, main_business, description FROM stock_meta WHERE symbol = ?", (symbol,))
        row = cursor.fetchone()
        return row
    finally:
        conn.close()
