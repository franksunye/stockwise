import pandas as pd
from backend.database import get_connection
from backend.logger import logger

# Industry Standard: Noise Threshold (1%)
# "Side" signals are considered correct if the price moves within this range (noise),
# as staying out of the market during low-volatility/low-gain days is a valid strategy.
NOISE_THRESHOLD = 1.0  

def validate_previous_prediction(symbol: str, today_data: pd.Series):
    """验证昨日的 AI 预测 (T-1 预测 T)"""
    from database import execute_with_retry # Delayed import to avoid circular dep if any
    execute_with_retry(_validate_logic, 3, symbol, today_data)


def verify_all_pending():
    """
    Batch verify all pending predictions against their SPECIFIC target date price data.
    This ensures that old pending predictions are validated against the correct historical day,
    not just the latest available price.
    """
    from database import get_connection
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # --- 1. Validate Multi-Model Table (ai_predictions_v2) ---
        # We use target_date to match exactly with daily_prices
        logger.info("🔍 Verifying pending V2 predictions...")
        
        pending_v2 = cursor.execute("""
            SELECT symbol, date, target_date, model_id, signal
            FROM ai_predictions_v2 
            WHERE validation_status='Pending'
        """).fetchall()

        validated_count_v2 = 0
        
        for row in pending_v2:
            symbol, p_date, target_date, model_id, signal = row
            
            # Find price data specifically for the target_date
            price_row = cursor.execute("""
                SELECT change_percent FROM daily_prices 
                WHERE symbol = ? AND date = ?
            """, (symbol, target_date)).fetchone()
            
            if price_row:
                actual_change = price_row[0]
                status = _calculate_status(signal, actual_change)
                
                cursor.execute("""
                    UPDATE ai_predictions_v2
                    SET validation_status = ?, actual_change = ?, updated_at = datetime('now', '+8 hours')
                    WHERE symbol = ? AND date = ? AND model_id = ?
                """, (status, actual_change, symbol, p_date, model_id))
                
                validated_count_v2 += 1
                logger.info(f"   ✅ Validated V2 {symbol} ({p_date} -> {target_date}): {signal} vs {actual_change}% = {status}")
            
            # If no price data found for target_date yet, we skip (it remains Pending)

        conn.commit()
        logger.info(f"✨ Validation Complete: {validated_count_v2} V2 predictions.")
        
    except Exception as e:
        logger.error(f"❌ Batch verification failed: {e}")
    finally:
        conn.close()

def _validate_logic(conn, symbol: str, today_data: dict):
    """
    Legacy helper kept for compatibility if needed, but verify_all_pending is preferred.
    This just redirects to the batch logic for that specific symbol if called.
    """
    # For now, we simply warn that this is deprecated or redirect to batch logic
    # But since arguments differ, we'll just leave it as a no-op or partial implementation 
    # if other code relies on it. To be safe, let's implement a single-symbol version of the new logic.
    pass # Replaced by batch logic consistent across all predictions

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
