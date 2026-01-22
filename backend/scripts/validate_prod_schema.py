
import sys
import os
import logging

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_connection, get_table_columns
from config import DB_SOURCE, TURSO_DB_URL

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ProdValidator")

def check_table_schema(conn, table_name, expected_columns):
    logger.info(f"🔍 Checking table: {table_name}")
    try:
        actual_columns = get_table_columns(conn.cursor(), table_name)
        if not actual_columns:
            logger.error(f"❌ Table {table_name} DOES NOT EXIST!")
            return False
            
        missing = [col for col in expected_columns if col not in actual_columns]
        if missing:
            logger.error(f"❌ Table {table_name} is missing columns: {missing}")
            logger.info(f"   Actual columns: {actual_columns}")
            return False
        else:
            logger.info(f"✅ Table {table_name} schema matches expectations.")
            return True
    except Exception as e:
        logger.error(f"⚠️ Error checking {table_name}: {e}")
        return False

def main():
    logger.info("🚀 Starting Production Database Schema Validation")
    logger.info(f"ℹ️  DB_SOURCE: {DB_SOURCE}")
    logger.info(f"ℹ️  Target URL: {TURSO_DB_URL[:20]}..." if TURSO_DB_URL else "ℹ️  Target: Local SQLite")

    conn = get_connection()
    try:
        # 1. Check Users
        # Expecting: definition from database.py lines 143 + 299
        users_cols = ["user_id", "registration_type", "subscription_tier", "notification_settings"]
        check_table_schema(conn, "users", users_cols)

        # 2. Check Stock Meta
        meta_cols = ["symbol", "name", "market"]
        check_table_schema(conn, "stock_meta", meta_cols)
        
        # 3. Check AI Predictions V2
        ai_cols = ["symbol", "date", "model_id", "target_date", "signal", "confidence"]
        check_table_schema(conn, "ai_predictions_v2", ai_cols)
        
        # 4. Check Phase 2 Tables
        check_table_schema(conn, "signal_states", ["user_id", "symbol", "last_signal", "last_notified_at"])
        check_table_schema(conn, "notification_logs", ["id", "user_id", "type", "sent_at"])
        
        logger.info("✨ Validation Complete.")
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()
