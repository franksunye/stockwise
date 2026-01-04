import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_connection

def verify():
    conn = get_connection()
    cursor = conn.cursor()
    
    print("--- Prediction Models ---")
    cursor.execute("SELECT model_id, display_name, priority FROM prediction_models")
    for row in cursor.fetchall():
        print(row)
        
    print("\n--- AI Predictions V2 (First 5) ---")
    cursor.execute("SELECT symbol, date, model_id, is_primary FROM ai_predictions_v2 LIMIT 5")
    rows = cursor.fetchall()
    for row in rows:
        print(row)
        
    if not rows:
        print("⚠️ No data in ai_predictions_v2!")
        
    conn.close()

if __name__ == "__main__":
    verify()
