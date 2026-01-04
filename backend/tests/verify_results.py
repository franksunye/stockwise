import os
import sys
import json

# Add project root to path
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(root_dir)
sys.path.append(os.path.join(root_dir, 'backend'))

from backend.database import get_connection

def verify_data():
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT p.model_id, m.display_name, p.date, p.target_date, p.is_primary 
        FROM ai_predictions_v2 p 
        LEFT JOIN prediction_models m ON p.model_id = m.model_id 
        WHERE p.symbol = '00700' AND p.date = '2026-01-02'
        ORDER BY p.created_at DESC
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    
    print(f"{'Model ID':<20} | {'Display Name':<20} | {'Date':<12} | {'Target Date':<12} | {'Primary':<7}")
    print("-" * 80)
    
    for row in rows:
        # Access by index is most robust across different DB adapters
        mid = row[0]
        name = row[1]
        date = row[2]
        target = row[3]
        pri = row[4]
            
        print(f"{str(mid):<20} | {str(name):<20} | {str(date):<12} | {str(target):<12} | {str(pri):<7}")

    conn.close()

if __name__ == "__main__":
    verify_data()
