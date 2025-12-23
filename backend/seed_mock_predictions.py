import sqlite3
import random
from datetime import datetime, timedelta

def seed_mock_data():
    conn = sqlite3.connect('data/stockwise.db')
    cursor = conn.cursor()
    
    # 1. 清理现有预测数据（可选，为了看到整洁的模拟效果）
    # cursor.execute("DELETE FROM ai_predictions")
    
    symbols = ['02171', '02269', '01801', '01024', '02015']
    today = datetime.now()
    
    signals = ['Long', 'Short', 'Side']
    statuses = ['Correct', 'Incorrect', 'Neutral']
    
    print("🚀 开始注入模拟预测数据...")
    
    for symbol in symbols:
        count = 20 if symbol == '02171' else 5
        for i in range(count):
            # 生成过去日期
            date_dt = today - timedelta(days=i+1)
            date_str = date_dt.strftime('%Y-%m-%d')
            target_date_str = (date_dt + timedelta(days=1)).strftime('%Y-%m-%d')
            
            signal = random.choice(signals)
            confidence = round(random.uniform(0.6, 0.95), 2)
            support_price = round(random.uniform(10, 50), 2)
            
            # 根据信号模拟结果
            if signal == 'Side':
                status = 'Neutral'
                actual_change = round(random.uniform(-0.5, 0.5), 2)
            else:
                status = random.choice(['Correct', 'Incorrect'])
                if status == 'Correct':
                    # 如果看多且正确，涨幅为正；如果看空且正确，涨幅为负
                    actual_change = round(random.uniform(1.0, 5.0), 2) if signal == 'Long' else round(random.uniform(-5.0, -1.0), 2)
                else:
                    # 如果看多但错误，跌幅为负；如果看空但错误，涨幅为正
                    actual_change = round(random.uniform(-4.0, -0.5), 2) if signal == 'Long' else round(random.uniform(0.5, 4.0), 2)
            
            reasoning = f"模拟分析: 基于昨日成交量放缩以及 RSI 指标共振判断，预计次日走势为 {signal}。"
            
            cursor.execute("""
                INSERT INTO ai_predictions (
                    symbol, date, target_date, signal, confidence, 
                    support_price, ai_reasoning, validation_status, actual_change
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (symbol, date_str, target_date_str, signal, confidence, 
                  support_price, reasoning, status, actual_change))
            
    conn.commit()
    conn.close()
    print("✅ 模拟数据注入完成！请刷新复盘页面查看效果。")

if __name__ == "__main__":
    seed_mock_data()
