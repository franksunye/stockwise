"""
StockWise SQL Query Registry.
Centralized location for all raw SQL statements to ensure consistency and easier auditing.
"""

# --- Market Data (Prices) ---
LAST_DATE_QUERY = "SELECT MAX(date) FROM {table} WHERE symbol = ?"
CLEANUP_PERIOD_QUERY = "DELETE FROM {table} WHERE symbol = ? AND date >= ?"
SAVE_PRICES_QUERY = """
    INSERT OR REPLACE INTO {table} 
    (symbol, date, open, high, low, close, volume, change_percent,
     ma5, ma10, ma20, ma60, macd, macd_signal, macd_hist,
     boll_upper, boll_mid, boll_lower, rsi, kdj_k, kdj_d, kdj_j, ai_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""
FETCH_HISTORY_QUERY = "SELECT * FROM {table} WHERE symbol = ? ORDER BY date DESC LIMIT ?"

# --- Stock Metadata ---
GET_STOCK_NAME_QUERY = "SELECT name FROM stock_meta WHERE symbol = ?"
GET_STOCK_PROFILE_QUERY = "SELECT industry, main_business, description FROM stock_meta WHERE symbol = ?"
GET_STOCK_POOL_QUERY = "SELECT symbol FROM global_stock_pool WHERE watchers_count > 0 ORDER BY watchers_count DESC"
UPDATE_STOCK_PROFILE_QUERY = """
    UPDATE stock_meta 
    SET industry = ?, main_business = ?, description = ?
    WHERE symbol = ?
"""
BULK_INSERT_STOCK_META_BASE = "INSERT OR REPLACE INTO stock_meta (symbol, name, market, last_updated, pinyin, pinyin_abbr) VALUES"

# --- User & Watchlist ---
CHECK_PRO_WATCHER_QUERY = """
    SELECT COUNT(*) FROM users u
    JOIN user_watchlist w ON u.user_id = w.user_id
    WHERE w.symbol = ? 
    AND u.subscription_tier IN ('pro', 'premium')
    AND (u.subscription_expires_at IS NULL OR u.subscription_expires_at > ?)
"""
GET_USER_WATCHLIST_QUERY = "SELECT symbol FROM user_watchlist WHERE user_id = ?"
GET_USER_TIER_QUERY = "SELECT subscription_tier FROM users WHERE user_id = ?"
GET_USER_NOTIF_SETTINGS_QUERY = "SELECT notification_settings FROM users WHERE user_id = ?"

# --- AI & Predictions ---
SAVE_PREDICTION_V2_QUERY = """
    INSERT OR REPLACE INTO ai_predictions_v2 
    (symbol, date, model_id, target_date, signal, confidence, 
     support_price, pressure_price, ai_reasoning, prompt_version,
     token_usage_input, token_usage_output, execution_time_ms,
     is_primary, trace_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))
"""
CHECK_PREDICTION_V2_EXISTS_QUERY = "SELECT 1 FROM ai_predictions_v2 WHERE symbol = ? AND date = ? AND model_id = ? LIMIT 1"
FETCH_PREDICTION_HISTORY_QUERY = "SELECT date, signal, confidence, ai_reasoning, validation_status, actual_change, model_id FROM ai_predictions_v2 WHERE symbol = ? AND {filter_sql} AND validation_status != 'Pending' AND date < ? ORDER BY date DESC LIMIT ?"
FETCH_ACCURACY_STATS_QUERY = """
    SELECT COUNT(*) as total,
           SUM(CASE WHEN validation_status = 'Correct' THEN 1 ELSE 0 END) as correct
    FROM ai_predictions_v2 
    WHERE symbol = ? AND {filter_sql} AND validation_status != 'Pending' AND date < ?
"""
FETCH_LATEST_PREDICTION_QUERY = "SELECT * FROM ai_predictions_v2 WHERE symbol = ? AND model_id = ? ORDER BY date DESC LIMIT 1"

# --- Notifications ---
SAVE_NOTIFICATION_LOG_QUERY = """
    INSERT INTO notification_logs (id, user_id, type, related_symbols, title, body, url, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'))
"""
GET_SIGNAL_STATE_QUERY = "SELECT last_signal, last_confidence, last_notified_at FROM signal_states WHERE user_id = ? AND symbol = ?"
UPDATE_SIGNAL_STATE_QUERY = """
    INSERT OR REPLACE INTO signal_states (user_id, symbol, last_signal, last_confidence, last_notified_at)
    VALUES (?, ?, ?, ?, ?)
"""

# --- Helper Functions for Dynamic Tables ---
def get_save_prices_sql(table: str) -> str:
    return SAVE_PRICES_QUERY.format(table=table)

def get_cleanup_sql(table: str) -> str:
    return CLEANUP_PERIOD_QUERY.format(table=table)

def get_last_date_sql(table: str) -> str:
    return LAST_DATE_QUERY.format(table=table)

def get_fetch_history_sql(table: str) -> str:
    return FETCH_HISTORY_QUERY.format(table=table)
