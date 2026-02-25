import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["DB_SOURCE"] = "cloud"

from database import get_connection

def switch_to_official_deepseek_v3():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Disable the aliyun model
    cursor.execute("""
        UPDATE prediction_models 
        SET is_active = 0 
        WHERE model_id = 'deepseek-v3.2-exp'
    """)
    print("Disabled deepseek-v3.2-exp")
    
    # 2. Enable deepseek-v3 and ensure its config format is exactly what you want
    official_config = {
        "model": "deepseek-chat",
        "api_key_env": "DEEPSEEK_API_KEY",
        "base_url_env": "DEEPSEEK_BASE_URL",
        "max_tokens": 8192
    }
    config_json = json.dumps(official_config)
    
    cursor.execute("""
        UPDATE prediction_models 
        SET is_active = 1, config_json = ?, provider = 'adapter-openai'
        WHERE model_id = 'deepseek-v3'
    """, (config_json,))
    
    print(f"Enabled deepseek-v3 with config: {config_json}")
    
    # Verify
    cursor.execute("SELECT is_active, config_json FROM prediction_models WHERE model_id = 'deepseek-v3'")
    row = cursor.fetchone()
    print("Verification result deepseek-v3:", {"is_active": row[0], "config": row[1]} if row else "Not found")
    
    cursor.execute("SELECT is_active, config_json FROM prediction_models WHERE model_id = 'deepseek-v3.2-exp'")
    row = cursor.fetchone()
    print("Verification result deepseek-v3.2-exp:", {"is_active": row[0], "config": row[1]} if row else "Not found")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    switch_to_official_deepseek_v3()
