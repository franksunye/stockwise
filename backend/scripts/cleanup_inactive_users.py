import os
import sys
import csv
import json
from datetime import datetime
from typing import List, Tuple

# Ensure we can import from parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import database connection
from database import get_connection

def cleanup_inactive_users(dry_run: bool = True):
    """
    Identifies and purges 'Ghost Users' (Free users, inactive for 30+ days, with no data).
    """
    print(f"--- Ghost User Cleanup ({'DRY RUN' if dry_run else 'EXECUTION MODE'}) ---")
    
    # Force cloud if we're doing maintenance
    if os.environ.get("DB_SOURCE") != "cloud":
         print("Warning: DB_SOURCE is not set to 'cloud'. Only cleaning local DB.")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Identify candidates
    # Criteria: Free users, last_active_at > 30 days ago, 0 watchlist items, 0 investment mode, 0 positions
    query = """
    SELECT user_id, email, locale, created_at, last_active_at 
    FROM users 
    WHERE subscription_tier = 'free'
    AND last_active_at < date('now', '-30 days')
    AND user_id NOT IN (SELECT DISTINCT user_id FROM user_watchlist)
    AND user_id NOT IN (SELECT DISTINCT user_id FROM user_investment_mode)
    AND user_id NOT IN (SELECT DISTINCT user_id FROM user_trade_positions)
    """
    
    cursor.execute(query)
    candidates = cursor.fetchall()
    
    if not candidates:
        print("No ghost users found matching the criteria. Nothing to do.")
        conn.close()
        return

    print(f"Found {len(candidates)} ghost users.")
    
    # 2. Safety Export
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"tmp/ghost_users_backup_{timestamp}.csv"
    os.makedirs("tmp", exist_ok=True)
    
    with open(backup_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['user_id', 'email', 'locale', 'created_at', 'last_active_at'])
        for row in candidates:
            writer.writerow(row)
            
    print(f"Backup exported to: {backup_path}")
    
    if dry_run:
        print("Dry run complete. No deletions performed.")
        conn.close()
        return

    # 3. Purge
    user_ids = [row[0] for row in candidates]
    
    try:
        print(f"Purging {len(user_ids)} users...")
        # Since we use SQLite/Turso, we can use IN clause with placeholders
        placeholders = ', '.join(['?'] * len(user_ids))
        cursor.execute(f"DELETE FROM users WHERE user_id IN ({placeholders})", user_ids)
        
        conn.commit()
        print(f"SUCCESS: {cursor.rowcount} users removed from production.")
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Failed to purge users. Transaction rolled back. {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Clean up inactive ghost users from StockWise.")
    parser.add_argument("--execute", action="store_true", help="Perform actual deletion. Default is dry-run.")
    args = parser.parse_args()
    
    cleanup_inactive_users(dry_run=not args.execute)
