import json
import sqlite3
import os
import sys

# Add project root to path
# __file__ is /home/.../StockWise/backend/migrations/fix_registry.py
# parent is migrations, parent of parent is backend
# wait, backend is a package inside StockWise
# So root is /home/.../StockWise
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(root_dir)
# Also add backend dir to support relative imports like 'from config import ...' in database.py
sys.path.append(os.path.join(root_dir, 'backend'))
from backend.database import get_connection

def fix_registry():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Gemini (uses local LLM proxy)
    gemini_config = {
        "model": "gpt-3.5-turbo",
        "api_key_env": "LLM_API_KEY",
        "base_url_env": "LLM_BASE_URL"
    }
    cursor.execute("""
        UPDATE prediction_models 
        SET config_json = ?, capabilities_json = ?, display_name = ?
        WHERE model_id = 'gemini-3-flash'
    """, (json.dumps(gemini_config), '{"cost": "low"}', "Gemini 3 Flash"))
    
    # DeepSeek
    deepseek_config = {
        "model": "deepseek-chat",
        "api_key_env": "DEEPSEEK_API_KEY",
        "base_url": "https://api.deepseek.com/v1"
    }
    cursor.execute("""
        UPDATE prediction_models 
        SET config_json = ?, display_name = ?, priority = 100
        WHERE model_id = 'deepseek-v3'
    """, (json.dumps(deepseek_config), "DeepSeek V3", 100))
    
    conn.commit()
    conn.close()
    print("✅ Prediction models registry fixed.")

if __name__ == "__main__":
    fix_registry()
