import json
from datetime import datetime
from backend.database import get_connection
from backend.logger import logger
from backend.trading_calendar import get_next_trading_day_str, get_market_from_symbol, is_trading_day

# Industry Standard: Noise Threshold (1%)
# "Side" signals are considered correct if the price moves within this range (noise),
# as staying out of the market during low-volatility/low-gain days is a valid strategy.
NOISE_THRESHOLD = 1.0  
VALIDATION_WINDOW = 1 # Reverted to 1-day (Daily) validation

def validate_previous_prediction(symbol: str, today_data: any):
    """
    Legacy compatibility wrapper. 
    New multi-day validation is handled by verify_all_pending().
    """
    pass

def verify_all_pending(force: bool = False, target_date: str = None):
    """
    Batch verify predictions against a multi-day window (default 3 days).
    Stores trajectory in validation_data JSON.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # --- 1. Filter Predictions ---
        conditions = []
        if not force:
            # We also re-verify 'Pending' or previously 'Incorrect' if still within window?
            # For simplicity, let's re-verify anything that isn't 'Correct' if it's within the last week.
            conditions.append("(validation_status = 'Pending' OR validation_status = 'Verifying' OR validation_status = 'Incorrect')")
        
        if target_date:
            conditions.append(f"target_date='{target_date}'")
            logger.info(f"🔍 Verifying V2 predictions for target date: {target_date}...")
        else:
            # Only look at recent predictions (last 10 days) to avoid heavy scans
            conditions.append("date >= date('now', '-10 days')")
            logger.info("🔍 Verifying recent V2 predictions (Daily mode)...")

        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        pending_v2 = cursor.execute(f"""
            SELECT symbol, date, target_date, model_id, signal, confidence
            FROM ai_predictions_v2 
            WHERE {where_clause}
        """).fetchall()

        validated_count = 0
        
        for row in pending_v2:
            symbol, p_date, t0_date, model_id, signal, confidence = row
            market = get_market_from_symbol(symbol)
            
            # --- 2. Calculate Window Dates ---
            # Window starts at target_date (T+1 relative to prediction date T)
            start_date = t0_date
            if not is_trading_day(start_date, market=market):
                start_date = get_next_trading_day_str(start_date, market=market)

            window_dates = [start_date]
            current_t = start_date
            for _ in range(VALIDATION_WINDOW - 1):
                current_t = get_next_trading_day_str(current_t, market=market)
                window_dates.append(current_t)
            
            # --- 3. Fetch Price Data for Window ---
            price_map = {}
            for d in window_dates:
                p_row = cursor.execute("SELECT change_percent, close FROM daily_prices WHERE symbol=? AND date=?", (symbol, d)).fetchone()
                if p_row:
                    price_map[d] = {"change": p_row[0], "close": p_row[1]}

            if not price_map:
                continue

            # --- 4. Evaluate Trajectory ---
            trajectory = []
            cumulative_change = 0.0
            max_favorable = 0.0 
            days_evaluated = 0
            
            for d in window_dates:
                if d in price_map:
                    day_change = price_map[d]['change']
                    cumulative_change += day_change
                    days_evaluated += 1
                    
                    if signal == 'Long':
                        max_favorable = max(max_favorable, cumulative_change)
                    elif signal == 'Short':
                        max_favorable = min(max_favorable, cumulative_change)
                    elif signal == 'Side':
                        if abs(cumulative_change) > abs(max_favorable):
                            max_favorable = cumulative_change
                    
                    trajectory.append({
                        "date": d,
                        "change": day_change,
                        "cum_change": round(cumulative_change, 2)
                    })
                else:
                    break

            # --- 5. Determine Final Verdict ---
            is_final = (days_evaluated == VALIDATION_WINDOW)
            verdict = 'Verifying'
            
            if signal == 'Long':
                if cumulative_change > 0:
                    verdict = 'Correct'
                elif is_final:
                    verdict = 'Incorrect'
            elif signal == 'Short':
                if cumulative_change < 0:
                    verdict = 'Correct'
                elif is_final:
                    verdict = 'Incorrect'
            elif signal == 'Side':
                if is_final:
                    verdict = 'Correct' if cumulative_change <= NOISE_THRESHOLD else 'Incorrect'
            
            # --- 6. Update Database ---
            val_data = {
                "window": VALIDATION_WINDOW,
                "days_evaluated": days_evaluated,
                "trajectory": trajectory,
                "max_perf": round(max_favorable, 2) if abs(max_favorable) < 500 else 0
            }
            
            t1_change = trajectory[0]['change'] if trajectory else 0.0

            cursor.execute("""
                UPDATE ai_predictions_v2
                SET validation_status = ?, 
                    actual_change = ?, 
                    validation_data = ?, 
                    max_perf_in_window = ?,
                    updated_at = datetime('now', '+8 hours')
                WHERE symbol = ? AND date = ? AND model_id = ?
            """, (verdict, t1_change, json.dumps(val_data), val_data['max_perf'], symbol, p_date, model_id))
            
            validated_count += 1
            if verdict != 'Verifying':
                logger.info(f"   ✅ {symbol} ({p_date}) -> {verdict} (Peak: {val_data['max_perf']}%, Days: {days_evaluated})")

        conn.commit()
        logger.info(f"✨ Validation Complete: {validated_count} predictions updated.")
        
        return {
            "validated_count": validated_count,
            "target_date_filter": target_date or "Recent 10 Days",
            "condition": "Pending/Verifying" if not force else "All"
        }
        
    except Exception as e:
        logger.error(f"❌ Batch verification failed: {e}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        conn.close()
