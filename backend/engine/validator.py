import json
from datetime import datetime
from backend.database import get_connection
from backend.logger import logger
from backend.trading_calendar import get_next_trading_day_str, get_market_from_symbol

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
            # We want T+1, T+2, T+3
            window_dates = [t0_date]
            current_t = t0_date
            for _ in range(VALIDATION_WINDOW - 1):
                current_t = get_next_trading_day_str(current_t, market=market)
                window_dates.append(current_t)
            
            # --- 3. Fetch Price Data for Window ---
            # Get T0 price (for baseline comparison)
            # Actually baseline is typically the close of the PREDICTION date (T)
            # but our current 'actual_change' in daily_prices is T relative to T-1.
            # So T+1's change_percent is (T+1_close - T_close) / T_close.
            
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
            # Initialize with 0 instead of extreme values to capture small movements correctly
            max_favorable = 0.0 
            
            final_status = 'Verifying'
            days_evaluated = 0
            
            for d in window_dates:
                if d in price_map:
                    day_change = price_map[d]['change']
                    # Simple additive cumulative change for the window
                    # Professional way: (1 + c1)(1 + c2) - 1
                    # But for 3 days 1% + 1% is approx 2%.
                    # Since we store individual changes, we can be flexible.
                    cumulative_change += day_change
                    days_evaluated += 1
                    
                    if signal == 'Long':
                        max_favorable = max(max_favorable, cumulative_change)
                    elif signal == 'Short':
                        max_favorable = min(max_favorable, cumulative_change)
                    elif signal == 'Side':
                        # For Side, track the largest absolute deviation
                        if abs(cumulative_change) > abs(max_favorable):
                            max_favorable = cumulative_change
                    
                    trajectory.append({
                        "date": d,
                        "change": day_change,
                        "cum_change": round(cumulative_change, 2)
                    })
                else:
                    # Break if we hit a date with no data yet
                    break

            # --- 5. Determine Final Verdict ---
            # Logic: 
            # Long: Peak >= 1.5% OR Final Cumulative > 0
            # Short: Peak <= -1.5% OR Final Cumulative < 0
            # Side: all days within +/- 1.5%
            
            is_final = (days_evaluated == VALIDATION_WINDOW)
            verdict = 'Verifying'
            
            if signal == 'Long':
                # Simplified: Correct if price went up on T+1
                if cumulative_change > 0:
                    verdict = 'Correct'
                elif is_final:
                    verdict = 'Incorrect'
            elif signal == 'Short':
                # Simplified: Correct if price went down on T+1
                if cumulative_change < 0:
                    verdict = 'Correct'
                elif is_final:
                    verdict = 'Incorrect'
            elif signal == 'Side':
                if is_final:
                    # Side is correct if it stayed flat or dropped (avoided loss/stayed out of noise)
                    # Incorrect only if it rallied significantly (missed opportunity)
                    verdict = 'Correct' if cumulative_change <= NOISE_THRESHOLD else 'Incorrect'
            
            # --- 6. Update Database ---
            val_data = {
                "window": VALIDATION_WINDOW,
                "days_evaluated": days_evaluated,
                "trajectory": trajectory,
                "max_perf": round(max_favorable, 2) if abs(max_favorable) < 500 else 0
            }
            
            # Legacy field: actual_change (store T+1 change for backward compatibility)
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
        
    except Exception as e:
        logger.error(f"❌ Batch verification failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()
