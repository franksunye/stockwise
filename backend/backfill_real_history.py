
import os
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Import main with overriden config to ensure local execution
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))
import main
from main import get_connection, generate_ai_prediction, validate_previous_prediction, get_stock_pool

# Force LOCAL mode
main.TURSO_DB_URL = None
main.TURSO_AUTH_TOKEN = None

def backfill_predictions():
    print("🚀 [LOCAL] 开始回溯生成真实的 AI 决策历史...")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # 清理本地旧预测
    print("🧹 清理本地旧预测数据...")
    cursor.execute("DELETE FROM ai_predictions")
    conn.commit()
    
    # 获取所有的活跃股票
    cursor.execute("SELECT symbol FROM global_stock_pool")
    stocks = [row[0] for row in cursor.fetchall()]

    for symbol in stocks:
        print(f"\n📈 处理股票: {symbol}")
        # 获取所有真实价格
        df = pd.read_sql(f"""
            SELECT * FROM daily_prices 
            WHERE symbol = '{symbol}' 
            ORDER BY date ASC
        """, conn)
        
        if df.empty:
            continue

        # 回溯序列
        for i in range(len(df)):
            current_row = df.iloc[i]
            # 1. 验证前一天的预测
            validate_previous_prediction(symbol, current_row)
            # 2. 基于今天生成新预测
            generate_ai_prediction(symbol, current_row)
            
    conn.close()
    print("\n✨ 本地回溯重构完成！")

if __name__ == "__main__":
    backfill_predictions()
