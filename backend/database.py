"""
StockWise Database Module (SQLAlchemy Core + libsql)

使用 SQLAlchemy 管理连接池，通过 libsql SDK 连接 Turso 或本地 SQLite。
"""
import libsql
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.dialects import registry

from config import DB_PATH, TURSO_DB_URL, TURSO_AUTH_TOKEN
from logger import logger

# 注册方言: "sqlite.libsql" -> backend.db_dialect.LibSQLDialect
registry.register("sqlite.libsql", "backend.db_dialect", "LibSQLDialect")


def _get_libsql_connection():
    """创建 libsql 原始连接"""
    if TURSO_DB_URL:
        logger.debug(f"🔗 连接 Turso: {TURSO_DB_URL[:40]}...")
        return libsql.connect(database=TURSO_DB_URL, auth_token=TURSO_AUTH_TOKEN)
    else:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        logger.debug(f"📂 使用本地数据库: {DB_PATH}")
        # 30秒超时，避免本地锁冲突
        return libsql.connect(database=str(DB_PATH), timeout=30.0)

def create_sa_engine():
    """
    创建 SQLAlchemy Engine。
    远程 Turso 使用连接池，本地使用 NullPool。
    """
    from sqlalchemy.pool import NullPool
    
    # 这里的 dialect 实例仅用于传递 dbapi，实际上不仅需要实例，还需要注册
    # 为了解决 create_function 问题，必须通过 URL 路由到我们自定义的 LibSQLDialect 类
    
    if TURSO_DB_URL:
        return create_engine(
            "sqlite+libsql://",  # 使用自定义 scheme
            creator=_get_libsql_connection,
            poolclass=QueuePool,
            pool_size=10,
            max_overflow=20,
            pool_recycle=300,
            pool_pre_ping=True,
            pool_use_lifo=True,
            module=libsql # 明确传入 module
        )
    else:
        return create_engine(
            "sqlite+libsql://", # 使用自定义 scheme
            creator=_get_libsql_connection,
            poolclass=NullPool,
            module=libsql # 明确传入 module
        )

# 使用工厂函数创建全局 Engine
engine = create_sa_engine()




# --- 兼容层 ---

class CursorShim:
    def __init__(self, sa_conn):
        self.sa_conn = sa_conn
        self.result = None
        self.description = None
        self.rowcount = 0

    def execute(self, sql, params=None):
        if params:
            if isinstance(params, (tuple, list)):
                new_sql = sql
                new_params = {}
                for i, val in enumerate(params):
                    new_sql = new_sql.replace("?", f":p{i}", 1)
                    new_params[f"p{i}"] = val
                self.result = self.sa_conn.execute(text(new_sql), new_params)
            else:
                self.result = self.sa_conn.execute(text(sql), params)
        else:
            self.result = self.sa_conn.execute(text(sql))
        
        if self.result.returns_rows:
            self.description = [(col, None, None, None, None, None, None) for col in self.result.keys()]
        self.rowcount = self.result.rowcount
        return self

    def executemany(self, sql, seq_of_parameters):
        for params in seq_of_parameters:
            self.execute(sql, params)
        return self

    def fetchone(self):
        if not self.result: return None
        row = self.result.fetchone()
        return tuple(row) if row else None

    def fetchall(self):
        if not self.result: return []
        return [tuple(row) for row in self.result.fetchall()]
    
    def close(self):
        pass


class ConnectionShim:
    def __init__(self, sa_conn):
        self.sa_conn = sa_conn
        
    def cursor(self):
        return CursorShim(self.sa_conn)
    
    def commit(self):
        self.sa_conn.commit()
        
    def rollback(self):
        self.sa_conn.rollback()
        
    def close(self):
        self.sa_conn.close()


def get_connection(force_new=False):
    return ConnectionShim(engine.connect())


def close_global_connection():
    logger.info("🔌 正在释放数据库连接池...")
    engine.dispose()


# --- 数据库初始化 ---

def get_table_columns(conn, table_name):
    result = conn.execute(text(f"PRAGMA table_info({table_name})"))
    return [row[1] for row in result.fetchall()]


def init_db():
    with engine.begin() as conn:
        for table in ["daily_prices", "weekly_prices", "monthly_prices"]:
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {table} (
                    symbol TEXT NOT NULL, date TEXT NOT NULL,
                    open REAL, high REAL, low REAL, close REAL, volume REAL, change_percent REAL,
                    ma5 REAL, ma10 REAL, ma20 REAL, ma60 REAL,
                    macd REAL, macd_signal REAL, macd_hist REAL,
                    boll_upper REAL, boll_mid REAL, boll_lower REAL,
                    rsi REAL, kdj_k REAL, kdj_d REAL, kdj_j REAL, ai_summary TEXT,
                    PRIMARY KEY (symbol, date)
                )
            """))
        
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS stock_meta (
                symbol TEXT PRIMARY KEY, name TEXT NOT NULL, market TEXT NOT NULL,
                last_updated TEXT, pinyin TEXT, pinyin_abbr TEXT,
                industry TEXT, main_business TEXT, description TEXT
            )
        """))
        conn.execute(text("CREATE TABLE IF NOT EXISTS stock_pool (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS global_stock_pool (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, first_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, watchers_count INTEGER DEFAULT 1, last_synced_at TIMESTAMP)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, username TEXT, email TEXT, registration_type TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, subscription_tier TEXT DEFAULT 'free', subscription_expires_at TIMESTAMP)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS user_watchlist (user_id TEXT NOT NULL, symbol TEXT NOT NULL, added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, symbol))"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS invitation_codes (code TEXT PRIMARY KEY, type TEXT NOT NULL, duration_days INTEGER DEFAULT 30, is_used BOOLEAN DEFAULT 0, used_by_user_id TEXT, used_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS ai_predictions (symbol TEXT NOT NULL, date TEXT NOT NULL, target_date TEXT NOT NULL, signal TEXT, confidence REAL, support_price REAL, ai_reasoning TEXT, validation_status TEXT DEFAULT 'Pending', actual_change REAL, model TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (symbol, date))"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS llm_traces (trace_id TEXT PRIMARY KEY, symbol TEXT, model TEXT, system_prompt TEXT, user_prompt TEXT, response_raw TEXT, response_parsed TEXT, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0, total_tokens INTEGER DEFAULT 0, latency_ms INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', error_message TEXT, retry_count INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_used_at TIMESTAMP, UNIQUE(user_id, endpoint))"))

        # 多模型预测系统 (V2)
        conn.execute(text("""
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
        """))
        conn.execute(text("""
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
        """))

    logger.info("✅ 数据库结构初始化完成 (SQLAlchemy Core)")


def get_stock_pool():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT symbol FROM global_stock_pool WHERE watchers_count > 0 ORDER BY watchers_count DESC"))
        return [row[0] for row in result.fetchall()]


def get_stock_profile(symbol: str):
    with engine.connect() as conn:
        result = conn.execute(text("SELECT industry, main_business, description FROM stock_meta WHERE symbol = :symbol"), {"symbol": symbol})
        return result.fetchone()
