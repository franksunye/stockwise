
import os
import sys
import sqlite3
import pandas as pd
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.database import get_connection
from backend.engine.validator import _calculate_status


def repair_all_data():
    print("🔧 Starting FAST Prediction Data Repair...")
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # --- 1. Load V2 Data ---
        print("\n🔍 Loading ai_predictions_v2...")
        v2_rows = cursor.execute("""
            SELECT symbol, date, target_date, model_id, signal, actual_change
            FROM ai_predictions_v2
        """).fetchall()
        print(f"   Loaded {len(v2_rows)} rows.")

        # --- 2. Load V1 Data ---
        # REMOVED (Legacy V1 Table Deprecated)
        # v1_rows = ...
        v1_rows = []

        # --- 3. Determine Date Range for Prices ---
        # Get all relevant dates
        all_dates = set()
        for r in v2_rows:
            all_dates.add(r[2]) # target_date
        
        v2_min_date = min([r[2] for r in v2_rows]) if v2_rows else '2099-01-01'
        min_date = v2_min_date
        print(f"\n📅 Fetching all price history since {min_date}...")
        
        # --- 4. Load ALL needed Prices in ONE Query ---
        # Fetching all prices is faster than N roundtrips
        price_rows = cursor.execute("""
            SELECT symbol, date, change_percent 
            FROM daily_prices 
            WHERE date >= ?
            ORDER BY date ASC
        """, (min_date,)).fetchall()
        
        # Build Lookup Map: (symbol, date) -> change_percent
        # Also Build Sorted Dates Map: symbol -> [list of (date, change)] for V1 lookup
        price_map = {}
        symbol_price_history = {}
        
        for p_sym, p_date, p_change in price_rows:
            price_map[(p_sym, p_date)] = p_change
            
            if p_sym not in symbol_price_history:
                symbol_price_history[p_sym] = []
            symbol_price_history[p_sym].append((p_date, p_change))
            
        print(f"   Loaded {len(price_rows)} price records.")

        # --- 5. Process V2 Updates (In Memory) ---
        print("\n⚡ Processing V2 Updates...")
        v2_updates = []
        
        for row in v2_rows:
            symbol, p_date, target_date, model_id, signal, old_change = row
            
            # Direct Lookup
            new_change = price_map.get((symbol, target_date))
            
            if new_change is not None:
                new_status = _calculate_status(signal, new_change)
                
                if old_change is None or (old_change is not None and abs(old_change - new_change) > 0.001):
                    # Add to batch: (status, change, symbol, date, model_id)
                    v2_updates.append((new_status, new_change, symbol, p_date, model_id))
        
        if v2_updates:
            print(f"   Committing {len(v2_updates)} updates to ai_predictions_v2...")
            # Use chunks for executemany to avoid packet limits
            chunk_size = 100
            for i in range(0, len(v2_updates), chunk_size):
                chunk = v2_updates[i:i+chunk_size]
                cursor.executemany("""
                    UPDATE ai_predictions_v2
                    SET validation_status = ?, actual_change = ?, updated_at = datetime('now', '+8 hours')
                    WHERE symbol = ? AND date = ? AND model_id = ?
                """, chunk)
                sys.stdout.write(f"\r   Progress: {min(i+chunk_size, len(v2_updates))}/{len(v2_updates)}")
            print("\n   ✅ V2 Done.")
        else:
            print("   ✅ V2 already up to date.")

        # --- 6. Process V1 Updates (In Memory) ---
        # REMOVED (Legacy V1 Table Deprecated)
        print("\n✅ V1 Updates Skipped (Deprecated).")

        conn.commit()
        print("\n🎉 ALL REPAIRS COMPLETED!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    repair_all_data()
