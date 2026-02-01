import sys
import os
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.db_repo.queries import (
    get_save_prices_sql, 
    get_cleanup_sql, 
    get_last_date_sql,
    FETCH_HISTORY_QUERY,
    GET_STOCK_NAME_QUERY,
    CHECK_PRO_WATCHER_QUERY
)

def test_sql_parity():
    print("🔍 Testing SQL Parity...")
    
    # Test 1: Save Prices SQL
    table = "daily_prices"
    expected_save = f"""
    INSERT OR REPLACE INTO {table} 
    (symbol, date, open, high, low, close, volume, change_percent,
     ma5, ma10, ma20, ma60, macd, macd_signal, macd_hist,
     boll_upper, boll_mid, boll_lower, rsi, kdj_k, kdj_d, kdj_j, ai_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""
    actual_save = get_save_prices_sql(table)
    # Strip whitespace for comparison
    if actual_save.strip() == expected_save.strip():
        print("✅ Save Prices SQL matches.")
    else:
        print("❌ Save Prices SQL MISMATCH!")
        print(f"Expected: {expected_save.strip()}")
        print(f"Actual:   {actual_save.strip()}")

    # Test 2: Cleanup SQL
    expected_cleanup = f"DELETE FROM {table} WHERE symbol = ? AND date >= ?"
    actual_cleanup = get_cleanup_sql(table)
    if actual_cleanup == expected_cleanup:
        print("✅ Cleanup SQL matches.")
    else:
        print("❌ Cleanup SQL MISMATCH!")

    # Test 3: Last Date SQL
    expected_last_date = f"SELECT MAX(date) FROM {table} WHERE symbol = ?"
    actual_last_date = get_last_date_sql(table)
    if actual_last_date == expected_last_date:
        print("✅ Last Date SQL matches.")
    else:
        print("❌ Last Date SQL MISMATCH!")

    # Test 4: Static Queries
    if "SELECT name FROM stock_meta" in GET_STOCK_NAME_QUERY:
        print("✅ Stock Name Query found.")
    if "subscription_tier" in CHECK_PRO_WATCHER_QUERY:
        print("✅ Pro Watcher Query found.")

if __name__ == "__main__":
    test_sql_parity()
