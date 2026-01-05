import sqlite3
import sys
import io
from datetime import datetime


from config import DB_PATH, TURSO_DB_URL, TURSO_AUTH_TOKEN
from logger import logger

try:
    import libsql_client
    import asyncio
    import inspect
except ImportError:
    libsql_client = None

# --- LibSQL (Turso) 适配器 ---
# 用于将 libsql_client (HTTP) 伪装成 sqlite3 (Native) 的接口
class LibSQLCursorAdapter:
    def __init__(self, client):
        self.client = client
        self._rows = []
        self._idx = 0
        self.rowcount = 0
        self.description = None

    def execute(self, sql, params=None):
        try:
            # libsql_client 要求 params 为 list 或 dict，sqlite3 有时传入 tuple
            if params and isinstance(params, tuple):
                params = list(params)
                
            # 执行 SQL
            result = self.client.execute(sql, params)
            
            # 异常处理：如果是协程（coroutine），说明 SyncClient 配置不当或库版本差异
            if inspect.iscoroutine(result):
                # 在同步环境中，尝试通过新循环运行 (极端后备方案)
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # 如果已经在运行，这里会很难办，但我们的脚本通常是同步的
                        logger.warning(f"⚠️ SQL 返回了协程且 EventLoop 正在运行: {sql[:50]}")
                        # 这种情况下无法简单同步获取，只能跳过或抛错
                    else:
                        result = loop.run_until_complete(result)
                except Exception as e:
                    logger.error(f"❌ 无法同步执行 SQL 协程: {e}")
                    raise e

            self._rows = result.rows
            self._idx = 0
            self.rowcount = result.rows_affected
            
            if hasattr(result, 'columns') and result.columns:
                self.description = [(col, None, None, None, None, None, None) for col in result.columns]
            else:
                self.description = None
                
            return self
        except Exception as e:
            if "already exists" not in str(e):
                logger.error(f"❌ SQL执行失败: {sql[:50]}... -> {e}")
            raise e

    def executemany(self, sql, seq_of_parameters):
        stmts = []
        for params in seq_of_parameters:
            if isinstance(params, tuple):
                params = list(params)
            stmts.append(libsql_client.Statement(sql, params))
        
        try:
            self.client.batch(stmts)
        except Exception as e:
            print(f"❌ 批量执行失败: {e}")
            raise e

    def fetchone(self):
        if self._idx < len(self._rows):
            row = self._rows[self._idx]
            self._idx += 1
            return row
        return None

    def fetchall(self):
        return self._rows

    def close(self):
        # HTTP cursor 无需关闭，但需满足 DBAPI 接口
        pass

import os

class LibSQLConnectionAdapter:
    def __init__(self, url, auth_token):
        # 区分环境：在 GitHub Actions 中强制使用 HTTPS 以避免 WebSocket 握手问题
        # 在本地环境，尽量也推荐 HTTPS，但允许用户保留原配置
        is_ci = os.getenv("GITHUB_ACTIONS") == "true"
        
        if url:
             # 如果是 CI 环境 或者 URL 明确是 libsql:// 开头，为了稳定性转为 https://
             if (is_ci or url.startswith("libsql://")):
                 if "turso.io" in url:
                     # 针对 Turso 的特殊优化：强制走 HTTP 协议
                     url = url.replace("libsql://", "https://", 1).replace("wss://", "https://", 1)
                 
        self.client = libsql_client.create_client_sync(url=url, auth_token=auth_token)

    def cursor(self):
        return LibSQLCursorAdapter(self.client)

    def commit(self):
        pass

    def close(self):
        self.client.close()

# --- 全局连接单例 (避免频繁创建连接) ---
_global_conn = None
_connection_count = 0

def get_connection(force_new: bool = False):
    """
    获取数据库连接 (支持本地 SQLite 或 Turso)
    
    默认使用全局单例连接以避免频繁创建/销毁连接导致的性能问题。
    如果需要独立连接（如在多线程场景），可设置 force_new=True。
    """
    global _global_conn, _connection_count
    
    # 如果已有全局连接且不强制新建，直接返回
    if _global_conn is not None and not force_new:
        return _global_conn
    
    if TURSO_DB_URL:
        if not libsql_client:
             print("❌ 未安装 libsql-client，无法连接 Turso。请运行: pip install libsql-client")
             sys.exit(1)
        
        # 只在第一次连接时打印日志
        if _connection_count == 0:
            print(f"🔗 连接 Turso: {TURSO_DB_URL[:40]}...")
        
        conn = LibSQLConnectionAdapter(TURSO_DB_URL, TURSO_AUTH_TOKEN)
    else:
        if _connection_count == 0:
            print(f"⚠️ TURSO_DB_URL 未设置，使用本地 SQLite: {DB_PATH}")
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
    
    _connection_count += 1
    
    # 如果不是强制新建，设为全局单例
    if not force_new:
        _global_conn = conn
    
    return conn

def close_global_connection():
    """显式关闭全局连接（在程序结束时调用）"""
    global _global_conn
    if _global_conn is not None:
        try:
            logger.debug("🔌 正在关闭全局数据库连接...")
            # 使用线程超时保护，避免 close() 永久阻塞
            import threading
            def _close():
                try:
                    _global_conn.close()
                except:
                    pass
            
            t = threading.Thread(target=_close, daemon=True)
            t.start()
            t.join(timeout=3)  # 最多等待 3 秒
            
            if t.is_alive():
                logger.warning("⚠️ 关闭连接超时，跳过")
            else:
                logger.debug("✅ 全局连接已关闭")
        except Exception as e:
            logger.warning(f"⚠️ 关闭全局连接时出错: {e}")
        _global_conn = None

def get_table_columns(cursor, table_name):
    """
    获取表的所有字段名 (兼容 SQLite3 Tuple 和 LibSQL Row 对象)
    """
    cursor.execute(f"PRAGMA table_info({table_name})")
    rows = cursor.fetchall()
    
    columns = []
    for row in rows:
        # 策略 1: SQLite3 (tuple, index 1 is name)
        if isinstance(row, tuple):
            columns.append(row[1])
        # 策略 2: LibSQL Row Object (has .name attribute)
        elif hasattr(row, 'name'):
            columns.append(row.name)
        # 策略 3: LibSQL Dict-like
        elif hasattr(row, '__getitem__'):
             try:
                 columns.append(row['name'])
             except:
                 try: columns.append(row[1])
                 except: pass
    return columns

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
    try:
        columns = get_table_columns(cursor, "stock_meta")
        
        expected_columns = {
            "industry": "TEXT",
            "main_business": "TEXT", 
            "description": "TEXT"
        }
        
        for col_name, col_type in expected_columns.items():
            if col_name not in columns:
                logger.info(f"🛠️ 更新数据库: 添加 stock_meta.{col_name}")
                cursor.execute(f"ALTER TABLE stock_meta ADD COLUMN {col_name} {col_type}")
                
    except Exception as e:
        logger.warning(f"⚠️ 检查/更新表结构失败: {e}")

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
            last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            subscription_tier TEXT DEFAULT 'free',
            subscription_expires_at TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_registration_type ON users(registration_type)")

    # 检查 users 表的新字段 (Schema Evolution)
    try:
        columns = get_table_columns(cursor, "users")
        
        if "subscription_tier" not in columns:
            logger.info("🛠️ 更新数据库: 添加 users.subscription_tier")
            cursor.execute("ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free'")
            
        if "subscription_expires_at" not in columns:
            logger.info("🛠️ 更新数据库: 添加 users.subscription_expires_at")
            cursor.execute("ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMP")
            
        if "referred_by" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN referred_by TEXT")

        if "has_onboarded" not in columns:
            logger.info("🛠️ 更新数据库: 添加 users.has_onboarded")
            cursor.execute("ALTER TABLE users ADD COLUMN has_onboarded BOOLEAN DEFAULT 0")
            
    except Exception as e:
        logger.warning(f"⚠️ 检查/更新 users 表结构失败: {e}")

    # 6. 邀请码表 (第0阶段内测)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS invitation_codes (
            code TEXT PRIMARY KEY,
            type TEXT NOT NULL, -- 'pro_monthly', 'premium_yearly'
            duration_days INTEGER DEFAULT 30,
            is_used BOOLEAN DEFAULT 0,
            used_by_user_id TEXT,
            used_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_invitation_code ON invitation_codes(code)")

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
            model TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (symbol, date)
        )
    """)

    # 7. LLM 调用追踪表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS llm_traces (
            trace_id TEXT PRIMARY KEY,
            symbol TEXT,
            model TEXT,
            system_prompt TEXT,
            user_prompt TEXT,
            response_raw TEXT,
            response_parsed TEXT,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            latency_ms INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            retry_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_llm_traces_symbol ON llm_traces(symbol)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_llm_traces_status ON llm_traces(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_llm_traces_created ON llm_traces(created_at)")

    # 8. Web Push 订阅表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id TEXT PRIMARY KEY, 
            user_id TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP,
            UNIQUE(user_id, endpoint)
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id)")

    # 字段自动升级 (Schema Evolution) - 为了给旧数据库添加字段
    try:
        columns = get_table_columns(cursor, "ai_predictions")
        
        # 定义需要补全的字段及其类型
        expected_ai_columns = {
            "model": "TEXT",
            "created_at": "TIMESTAMP",
            "updated_at": "TIMESTAMP"
        }
        
        for col_name, col_type in expected_ai_columns.items():
            if col_name not in columns:
                logger.info(f"🛠️ 更新数据库: 添加 ai_predictions.{col_name}")
                cursor.execute(f"ALTER TABLE ai_predictions ADD COLUMN {col_name} {col_type}")
                # 为旧数据赋予当前时间作为默认值
                if "at" in col_name:
                    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    cursor.execute(f"UPDATE ai_predictions SET {col_name} = ? WHERE {col_name} IS NULL", (now,))
                
    except Exception as e:
        logger.warning(f"⚠️ 检查/更新 ai_predictions 表结构失败: {e}")
    
    conn.commit()
    # init_db doesn't close the global connection - it will be reused
    logger.info("✅ 数据库结构检查/初始化完成")

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
    # Don't close global connection
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
    # Don't close global connection
    return row
