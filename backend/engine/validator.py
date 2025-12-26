import pandas as pd
from database import get_connection

def validate_previous_prediction(symbol: str, today_data: pd.Series):
    """验证昨日的 AI 预测 (T-1 预测 T)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    today_str = today_data['date']
    cursor.execute("""
        SELECT date, signal, support_price 
        FROM ai_predictions 
        WHERE symbol = ? AND validation_status = 'Pending' AND date < ?
        ORDER BY date DESC LIMIT 1
    """, (symbol, today_str))
    
    row = cursor.fetchone()
    if not row:
        conn.close()
        return
        
    pred_date, signal, support_price = row
    actual_change = today_data.get('change_percent', 0)
    
    status = 'Neutral'
    if signal == 'Long':
        status = 'Correct' if actual_change > 0 else 'Incorrect'
    elif signal == 'Short':
        status = 'Correct' if actual_change < 0 else 'Incorrect'
    elif signal == 'Side':
        status = 'Neutral'

    cursor.execute("""
        UPDATE ai_predictions 
        SET validation_status = ?, actual_change = ?
        WHERE symbol = ? AND date = ?
    """, (status, actual_change, symbol, pred_date))
    
    conn.commit()
    conn.close()
    print(f"   🔎 验证前期预测 ({pred_date}): 信号={signal}, 涨幅={actual_change}%, 结论={status}")
