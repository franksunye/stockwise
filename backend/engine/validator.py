import pandas as pd
from database import get_connection

# Industry Standard: Noise Threshold (1%)
# "Side" signals are considered correct if the price moves within this range (noise),
# as staying out of the market during low-volatility/low-gain days is a valid strategy.
NOISE_THRESHOLD = 1.0  

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
    
    # Validation Logic (Industry Standard / Fuzzy Matching)
    # Avoid "Strict Binary" validation which penalizes correct strategic caution.
    
    status = 'Incorrect' # Default
    
    if signal == 'Long':
        # Long is correct if we made money.
        # Future improvement: Consider Transaction Costs (e.g., > 0.1%)
        status = 'Correct' if actual_change > 0 else 'Incorrect'
        
    elif signal == 'Short':
        # Short is correct if price dropped.
        status = 'Correct' if actual_change < 0 else 'Incorrect'
        
    elif signal == 'Side':
        # Side (Wait) is correct if:
        # 1. Price dropped (Avoided Loss) -> Correct
        # 2. Price flat or small noise (Avoided Waste of Time/Fees) -> Correct (within Threshold)
        # 3. Price rallied significantly (Missed Opportunity) -> Incorrect
        if actual_change <= NOISE_THRESHOLD:
            status = 'Correct' 
        else:
            status = 'Incorrect'
    
    else:
        status = 'Incorrect'  # Unknown signal

    cursor.execute("""
        UPDATE ai_predictions 
        SET validation_status = ?, actual_change = ?
        WHERE symbol = ? AND date = ?
    """, (status, actual_change, symbol, pred_date))
    
    conn.commit()
    conn.close()
    
    # Visual feedback in logs
    icon = "✅" if status == "Correct" else "❌"
    print(f"   {icon} Validated ({pred_date}): Signal={signal}, Change={actual_change:+.2f}%, Result={status}")
