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

    # --- 1. Validate Legacy Table (ai_predictions) ---
    try:
        cursor.execute("""
            SELECT date, signal 
            FROM ai_predictions 
            WHERE symbol = ? AND validation_status = 'Pending' AND date < ?
            ORDER BY date DESC LIMIT 1
        """, (symbol, today_str))
        
        row = cursor.fetchone()
        if row:
            pred_date, signal = row
            actual_change = today_data.get('change_percent', 0)
            status = _calculate_status(signal, actual_change)
            
            cursor.execute("""
                UPDATE ai_predictions 
                SET validation_status = ?, actual_change = ?
                WHERE symbol = ? AND date = ?
            """, (status, actual_change, symbol, pred_date))
            
            icon = "✅" if status == "Correct" else "❌"
            print(f"   {icon} Validated [V1] ({pred_date}): Signal={signal}, Change={actual_change:+.2f}%, Result={status}")
    except Exception as e:
        print(f"   ⚠️ Validation V1 Error: {e}")

    # --- 2. Validate Multi-Model Table (ai_predictions_v2) ---
    try:
        # Validate ALL pending models for the previous day
        cursor.execute("""
            SELECT date, model_id, signal 
            FROM ai_predictions_v2 
            WHERE symbol = ? AND validation_status = 'Pending' AND date < ?
            ORDER BY date DESC
        """, (symbol, today_str))
        
        rows = cursor.fetchall()
        if rows:
            actual_change = today_data.get('change_percent', 0)
            validated_count = 0
            
            for r in rows:
                p_date, m_id, sig = r
                status = _calculate_status(sig, actual_change)
                
                cursor.execute("""
                    UPDATE ai_predictions_v2
                    SET validation_status = ?, actual_change = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE symbol = ? AND date = ? AND model_id = ?
                """, (status, actual_change, symbol, p_date, m_id))
                validated_count += 1
                
            print(f"   Note: Validated {validated_count} V2 models for {symbol}")

    except Exception as e:
        print(f"   ⚠️ Validation V2 Error: {e}")
        
    conn.commit()
    conn.close()

def _calculate_status(signal, actual_change):
    """Helper to determine Open/Close/Hold result status"""
    if signal == 'Long':
        return 'Correct' if actual_change > 0 else 'Incorrect'
    elif signal == 'Short':
        return 'Correct' if actual_change < 0 else 'Incorrect'
    elif signal == 'Side':
        if actual_change <= NOISE_THRESHOLD and actual_change >= -NOISE_THRESHOLD:
             return 'Correct'
        # If it dropped significantly, Side was "Correct" (avoided crash)?
        # Original logic: if actual_change <= NOISE_THRESHOLD -> Correct.
        # This implies if it crashed (-5%), Side (Wait) was a good call.
        if actual_change <= NOISE_THRESHOLD:
            return 'Correct'
        else:
            return 'Incorrect' # Missed opportunity (price went up > 1%)
    return 'Incorrect'
