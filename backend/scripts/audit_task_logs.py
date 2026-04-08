#!/usr/bin/env python3
"""
StockWise Online Task Audit Tool (DevOps)
Usage: $env:DB_SOURCE="cloud"; python backend/scripts/audit_task_logs.py
"""
import os
import sys
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

try:
    from backend.database import get_connection
    from backend.config import BEIJING_TZ
except ImportError:
    print("❌ Error: Could not import backend modules. Run from project root.")
    sys.exit(1)

# --- Configuration: Expected Task Windows (BJT) ---
# Plan derived from docs/1_Engineering/18_Backend_Workflow_Orchestration_Map.md
EXPECTATIONS = {
    "Full Market Sync (CN)": {"time": "16:00", "window_mins": 60, "type": "Production Core"},
    "AI Analysis (CN)": {"time": "16:10", "window_mins": 60, "type": "Production Core"},
    "Full Market Sync (HK)": {"time": "16:30", "window_mins": 60, "type": "Production Core"},
    "Full Market Sync (US)": {"time": "06:30", "window_mins": 60, "type": "Production Core"},
    "morning_call": {"time": "08:31", "window_mins": 10, "type": "Production Content"},
    "Prediction Verification": {"time": "16:10", "window_mins": 60, "type": "Production Core"},
    "Metadata Sync": {"time": "06:00", "window_mins": 120, "type": "Maintenance"},
}

def fetch_logs(hours=36) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    # Query logs in the last N hours, ordered by created_at desc
    # created_at is already in BJT (datetime('now', '+8 hours')) in our database.py
    query = f"""
    SELECT agent_id, task_name, display_name, status, created_at, start_time, end_time, message 
    FROM task_logs 
    WHERE created_at >= datetime('now', '-{hours} hours', '+8 hours') 
    ORDER BY created_at DESC
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    cols = [d[0] for d in cursor.description]
    conn.close()
    return [dict(zip(cols, r)) for r in rows]

def check_compliance(logs: List[Dict[str, Any]]):
    now_bjt = datetime.now(BEIJING_TZ)
    
    print(f"\n📊 --- StockWise Task Audit Report ({now_bjt.strftime('%Y-%m-%d %H:%M')}) ---")
    print(f"{'Status':<10} | {'Task Name':<25} | {'Real Time (BJT)':<20} | {'Expected':<10} | {'Delay'}")
    print("-" * 85)
    
    # Track which expected tasks were found
    found_tasks = set()
    
    for log in logs:
        name = log['task_name']
        status = log['status']
        created_at = log['created_at']
        
        status_icon = "✅" if status == "success" else "❌" if status == "failed" else "⏳"
        
        if name in EXPECTATIONS:
            found_tasks.add(name)
            expected_time_str = EXPECTATIONS[name]['time']
            
            try:
                log_dt = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
                exp_h, exp_m = map(int, expected_time_str.split(':'))
                exp_dt = log_dt.replace(hour=exp_h, minute=exp_m, second=0)
                
                delay = (log_dt - exp_dt).total_seconds() / 60
                delay_str = f"{delay:+.1f}m" if abs(delay) > 5 else "On Time"
            except:
                delay_str = "N/A"
            
            print(f"{status_icon} {status:<8} | {name[:25]:<25} | {created_at:<20} | {expected_time_str:<10} | {delay_str}")

    print("\n🧐 --- Missing / Not Run Recently ---")
    for name in EXPECTATIONS:
        if name not in found_tasks:
            print(f"⚠️  MISSING: {name} (Expected {EXPECTATIONS[name]['time']})")

    print("\n💡 Tip: Use '$env:DB_SOURCE=\"cloud\"; python backend/scripts/audit_task_logs.py' to refresh.")

if __name__ == "__main__":
    try:
        logs = fetch_logs()
        if not logs:
            print("⚠️ No logs found in the specified range.")
        else:
            check_compliance(logs)
    except Exception as e:
        print(f"❌ Audit Failed: {e}")
