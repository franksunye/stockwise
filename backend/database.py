"""
StockWise Database Module (Raw Interface - No ORM)

回归纯粹的 DB-API 2.0 接口，放弃 SQLAlchemy。
在 Serverless (Turso) 环境下，无状态的短连接比连接池更稳定。
"""
import sqlite3
import libsql
import os
from pathlib import Path

try:
    from backend.config import DB_PATH, TURSO_DB_URL, TURSO_AUTH_TOKEN
except ImportError:
    from config import DB_PATH, TURSO_DB_URL, TURSO_AUTH_TOKEN
try:
    from backend.logger import logger
except ImportError:
    from logger import logger
import time

# Turso/libSQL 瞬态错误模式列表
# 这些错误通常是网络层问题，重试后可恢复
TRANSIENT_ERROR_PATTERNS = [
    "stream not found",      # Hrana HTTP/2 流过期
    "locked",                # SQLite 锁冲突
    "404",                   # 数据库冷启动
    "tls handshake",         # TLS 握手中断
    "eof",                   # 连接意外关闭
    "connection reset",      # TCP 连接重置
    "hrana",                 # Hrana 协议错误
    "timeout",               # 超时
    "connection refused",    # 连接被拒绝
    "network",               # 通用网络错误
    "client_closed",         # 客户端连接关闭
]

def is_transient_error(e: Exception) -> bool:
    """检查是否为可重试的瞬态错误"""
    error_msg = str(e).lower()
    return any(pattern in error_msg for pattern in TRANSIENT_ERROR_PATTERNS)

def execute_with_retry(func, max_retries=3, *args, **kwargs):
    """
    Executes a function with database connection retry logic.
    The function `func` must accept `conn` as its first argument.
    """
    last_exception = None
    for attempt in range(max_retries):
        conn = None
        try:
            conn = get_connection()
            result = func(conn, *args, **kwargs)
            conn.commit()
            return result
        except Exception as e:
            last_exception = e
            if is_transient_error(e):
                wait_time = 1 * (attempt + 1)  # 指数退避: 1s, 2s, 3s
                logger.warning(f"🔄 Database Error (Attempt {attempt+1}/{max_retries}): {e} - Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                # If it's a logic error, raise immediately
                raise e
        finally:
            if conn:
                try:
                    conn.close()
                except:
                    pass
    
    logger.error(f"❌ Failed after {max_retries} attempts. Last error: {last_exception}")
    raise last_exception


def get_connection(max_retries: int = 3):
    """
    创建原始数据库连接。
    Strategy: Always New Connection (NullPool equivalent).
    Includes retry logic for transient connection errors.
    """
    last_exception = None
    for attempt in range(max_retries):
        try:
            if TURSO_DB_URL:
                # sync client from libsql-experimental
                return libsql.connect(database=TURSO_DB_URL, auth_token=TURSO_AUTH_TOKEN)
            else:
                DB_PATH.parent.mkdir(parents=True, exist_ok=True)
                return sqlite3.connect(str(DB_PATH), timeout=30.0)
        except Exception as e:
            last_exception = e
            if is_transient_error(e):
                wait_time = 1 * (attempt + 1)
                logger.warning(f"🔄 Connection Failed (Attempt {attempt+1}/{max_retries}): {e} - Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise e
    
    logger.error(f"❌ Failed to connect after {max_retries} attempts. Last error: {last_exception}")
    raise last_exception



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
        cursor.execute("CREATE TABLE IF NOT EXISTS stock_pool (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, added_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')))")
        cursor.execute("CREATE TABLE IF NOT EXISTS global_stock_pool (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, first_watched_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')), watchers_count INTEGER DEFAULT 1, last_synced_at TIMESTAMP)")
        
        # 3. User System
        cursor.execute("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, username TEXT, email TEXT, registration_type TEXT NOT NULL, created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')), last_active_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')), subscription_tier TEXT DEFAULT 'free', subscription_expires_at TIMESTAMP)")
        cursor.execute("CREATE TABLE IF NOT EXISTS user_watchlist (user_id TEXT NOT NULL, symbol TEXT NOT NULL, added_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')), PRIMARY KEY (user_id, symbol))")
        cursor.execute("CREATE TABLE IF NOT EXISTS invitation_codes (code TEXT PRIMARY KEY, type TEXT NOT NULL, duration_days INTEGER DEFAULT 30, is_used BOOLEAN DEFAULT 0, used_by_user_id TEXT, used_at TIMESTAMP, created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')))")

        # 4. AI & Traces
        # cursor.execute("CREATE TABLE IF NOT EXISTS ai_predictions ...") - DEPRECATED
        cursor.execute("CREATE TABLE IF NOT EXISTS llm_traces (trace_id TEXT PRIMARY KEY, symbol TEXT, model TEXT, system_prompt TEXT, user_prompt TEXT, response_raw TEXT, response_parsed TEXT, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0, total_tokens INTEGER DEFAULT 0, latency_ms INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', error_message TEXT, retry_count INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')))")
        
        # 5. Push Subs
        cursor.execute("CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT, created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')), last_used_at TIMESTAMP, UNIQUE(user_id, endpoint))")

        # 5b. Daily Briefs (AI-generated personalized briefings)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS daily_briefs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                date TEXT NOT NULL,
                content TEXT NOT NULL,
                push_hook TEXT,
                created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
                notified_at TIMESTAMP,
                UNIQUE(user_id, date)
            )
        """)

        # 5c. Stock Briefs (Phase 1 cache - stock-level analysis, shared across users)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stock_briefs (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                stock_name TEXT,
                analysis_markdown TEXT NOT NULL,
                raw_news TEXT,
                signal TEXT,
                confidence REAL,
                created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
                PRIMARY KEY (symbol, date)
            )
        """)

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
                created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours'))
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
                created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
                updated_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
                PRIMARY KEY (symbol, date, model_id),
                FOREIGN KEY (model_id) REFERENCES prediction_models(model_id)
            )
        """)

        # 7. Chain Execution Traces (For Multi-turn debugging & observability)
        # Optimized for "Delayed Write" to reduce lock contention on Turso
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chain_execution_traces (
                trace_id TEXT PRIMARY KEY,
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                model_id TEXT NOT NULL,
                strategy_name TEXT NOT NULL,
                
                -- Execution Details
                steps_executed TEXT,  -- JSON list of step names
                steps_details TEXT,   -- JSON detailed metrics per step
                
                -- Artifacts (The core value prop for debugging)
                chain_artifacts TEXT,  -- JSON dictionary of step outputs
                
                -- Metrics
                total_duration_ms INTEGER,
                total_tokens INTEGER,
                retry_count INTEGER DEFAULT 0,
                
                -- Final Outcome
                final_result TEXT,     -- JSON of the final synthesis
                status TEXT,           -- 'success', 'failed'
                error_step TEXT,
                error_reason TEXT,
                
                created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
                FOREIGN KEY (model_id) REFERENCES prediction_models(model_id)
            )
        """)
        
        # 8. Schema Migrations (Add missing columns to existing tables)
        # Add notified_at to daily_briefs if it doesn't exist
        daily_briefs_cols = get_table_columns(cursor, 'daily_briefs')
        if 'notified_at' not in daily_briefs_cols:
            try:
                cursor.execute("ALTER TABLE daily_briefs ADD COLUMN notified_at TIMESTAMP")
                logger.info("✅ Added notified_at column to daily_briefs table")
            except Exception as e:
                # Column might already exist in some edge cases
                if "duplicate column" not in str(e).lower():
                    logger.warning(f"⚠️ Could not add notified_at column: {e}")
        
        # 9. Notification System Tables (Phase 1 of Smart Notifications)
        # notification_logs: Track sent notifications for de-duplication and analytics
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                related_symbols TEXT,
                title TEXT,
                body TEXT,
                url TEXT,
                sent_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
                clicked_at TIMESTAMP,
                channel TEXT DEFAULT 'push'
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notif_logs_user_type ON notification_logs(user_id, type, sent_at)")
        
        # signal_states: Track last notified signal for each user/stock pair (for Signal Flip detection)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS signal_states (
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                last_signal TEXT,
                last_confidence REAL,
                last_notified_at TIMESTAMP,
                PRIMARY KEY (user_id, symbol)
            )
        """)
        
        # 10. Add notification_settings column to users table (if exists)
        # This column stores user preferences for notification types as JSON
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN notification_settings TEXT")
            logger.info("✅ Added notification_settings column to users table")
        except Exception as e:
            # Column might already exist or table might not exist yet
            if "duplicate column" not in str(e).lower() and "no such table" not in str(e).lower():
                logger.debug(f"ℹ️ notification_settings column: {e}")

        # 11. Task Logs (For Agent Status Dashboard)
        # Enhanced for "Agentic" view with attribution and dimensions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS task_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,         -- e.g. 'market_observer', 'quant_mind'
                task_type TEXT NOT NULL,        -- e.g. 'ingestion', 'reasoning', 'delivery'
                task_name TEXT NOT NULL,        -- machine name e.g. 'market_sync_cn'
                display_name TEXT NOT NULL,     -- human readable e.g. 'Market Ingestion (CN)'
                date TEXT NOT NULL,
                status TEXT NOT NULL,           -- pending, running, success, failed
                triggered_by TEXT,              -- e.g. 'scheduler', 'user:frank'
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                dimensions TEXT,                -- JSON: {market: CN, tier: PRO}
                message TEXT,
                metadata TEXT,                  -- JSON: {tokens: 150, rows: 500}
                created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours'))
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_task_logs_date_agent ON task_logs(date, agent_id)")
        
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
