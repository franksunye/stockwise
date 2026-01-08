import sqlite3
import os
from pathlib import Path
import json

# Setup paths
BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "data" / "stockwise.db"

def register_local():
    print(f"📦 Registering hunyuan-lite in local DB: {DB_PATH}")
    if not DB_PATH.exists():
        print("❌ Local DB does not exist.")
        return
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    sql = """
    INSERT OR IGNORE INTO prediction_models 
    (model_id, display_name, provider, is_active, priority, config_json, capabilities_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    
    config = {
        "model": "hunyuan-lite",
        "api_key_env": "HUNYUAN_API_KEY",
        "base_url": "https://api.hunyuan.cloud.tencent.com/v1"
    }
    
    capabilities = {"cost": "low"}
    
    try:
        cursor.execute(sql, (
            "hunyuan-lite",
            "腾讯混元 Hunyuan-Lite",
            "adapter-openai",
            1,
            85,
            json.dumps(config),
            json.dumps(capabilities)
        ))
        conn.commit()
        print(f"✅ Success! (Rows affected: {cursor.rowcount})")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    register_local()
