import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["DB_SOURCE"] = "cloud"

from database import get_connection

def recover_model():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 恢复到之前使用的 Aliyun DashScope QWEN_API_KEY 配置
    aliyun_config = {
        "model": "deepseek-v3.2-exp",
        "api_key_env": "QWEN_API_KEY",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
    
    config_json = json.dumps(aliyun_config)
    
    # Update deepseek-v3.2-exp safe from console quote stripping
    cursor.execute("""
        UPDATE prediction_models 
        SET config_json = ?, is_active = 1 
        WHERE model_id = 'deepseek-v3.2-exp'
    """, (config_json,))
    
    print(f"Recovered deepseek-v3.2-exp config to: {config_json}")
    
    # Verify
    cursor.execute("SELECT config_json FROM prediction_models WHERE model_id = 'deepseek-v3.2-exp'")
    row = cursor.fetchone()
    print("Verification result:", row[0] if row else "Not found")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    recover_model()
