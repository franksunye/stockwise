
import os
import sys
import argparse
from datetime import datetime

# Adjust path to access backend modules
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from database import get_connection
from logger import logger
from backend.engine.task_logger import get_task_logger

def prune_expired_users(dry_run=False):
    """
    Scans for users who have a 'pro' tier but have expired subscription dates.
    Downgrades them to 'free'.
    """
    agent_id = "system_guardian"
    task_name = "user_maintenance"
    
    # Initialize Task Logger
    t_logger = get_task_logger(agent_id, task_name, triggered_by="scheduler")
    
    mode_str = "DRY RUN" if dry_run else "ACTIVE"
    t_logger.start(f"Daily User Maintenance ({mode_str})", "maintenance", dimensions={"mode": mode_str})
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Check affected count first
        check_sql = """
            SELECT COUNT(*), group_concat(user_id) 
            FROM users 
            WHERE subscription_tier IN ('pro', 'premium') 
              AND subscription_expires_at IS NOT NULL 
              AND subscription_expires_at < datetime('now', '+8 hours')
        """
        cursor.execute(check_sql)
        row = cursor.fetchone()
        count = row[0]
        user_ids = row[1]
        
        if count == 0:
            t_logger.success("✅ No expired users found. System healthy.", notify=True)
            return

        logger.info(f"⚠️ Found {count} expired users still marked as PRO: {user_ids}")

        if dry_run:
            t_logger.success(f"🚫 [Dry Run] Found {count} expired users: {user_ids}", notify=True)
            return

        # 2. Execute Update
        # Note: We keep subscription_expires_at as history, only downgrade the tier
        # We use datetime() wrap to handle ISO8601 strings (with 'T') vs SQLite default (space)
        # and compare against UTC 'now' because toISOString() uses UTC.
        update_sql = """
            UPDATE users 
            SET subscription_tier = 'free' 
            WHERE subscription_tier IN ('pro', 'premium') 
              AND subscription_expires_at IS NOT NULL 
              AND datetime(subscription_expires_at) < datetime('now')
        """
        cursor.execute(update_sql)
        conn.commit()
        
        affected = cursor.rowcount
        # Turso/libsql sometimes returns -1 for rowcount depending on driver ver, 
        # but since we did a count check before, we know roughly what happened.
        if affected == -1: 
            affected = count
            
        t_logger.success(f"✅ Successfully pruned {affected} expired users.", notify=True)
        
    except Exception as e:
        t_logger.fail(f"❌ Failed to prune users: {e}", notify=True, rerun_workflow="user_maintenance.yml")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='StockWise User Maintenance')
    parser.add_argument('--dry-run', action='store_true', help='Scan but do not modify')
    args = parser.parse_args()
    
    prune_expired_users(dry_run=args.dry_run)
