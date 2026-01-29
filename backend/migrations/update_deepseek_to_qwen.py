import sys
import os
import json

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_connection
from logger import logger

def update_model_config():
    # Force Cloud
    os.environ["DB_SOURCE"] = "cloud"
    from config import TURSO_DB_URL
    logger.info(f"🚀 Adding 'deepseek-aliyun' configuration to: {TURSO_DB_URL}")
    
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # New configuration for Aliyun DeepSeek
        aliyun_config = {
            "model": "deepseek-v3", # Aliyun uses same model name usually, or explicit params
            "api_key_env": "QWEN_API_KEY", 
            "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"
        }
        
        aliyun_config_json = json.dumps(aliyun_config)
        capabilities_json = json.dumps({"cost": "low", "speed": "fast"})
        
        # INSERT new model record
        # Set priority higher (e.g., 110) to make it default over standard deepseek-v3 (100)
        cursor.execute("""
            INSERT OR REPLACE INTO prediction_models 
            (model_id, display_name, provider, is_active, priority, config_json, capabilities_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            'deepseek-aliyun', 
            'DeepSeek V3 (Aliyun)', 
            'adapter-openai', 
            1, 
            110, # Higher priority
            aliyun_config_json,
            capabilities_json
        ))
        
        logger.info("✅ Successfully added/updated 'deepseek-aliyun' in database.")
        
        # Optional: Disable or Lower priority of original deepseek-v3? 
        # For now, let's keep it active but lower priority effectively since 110 > 100.
        
        # Verify
        cursor.execute("SELECT model_id, priority, config_json FROM prediction_models WHERE model_id = 'deepseek-aliyun'")
        row = cursor.fetchone()
        logger.info(f"🔎 Added Model: {row[0]} (Priority: {row[1]})")

        conn.commit()

    except Exception as e:
        logger.error(f"❌ Update failed: {e}")
        conn.close()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    update_model_config()
