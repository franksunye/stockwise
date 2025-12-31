import sys
import io
import time
from database import get_connection
from engine.validator import validate_previous_prediction
import pandas as pd
from logger import logger

# Fix encoding
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except:
        pass

def backfill_validation(days=7):
    """
    Backfill validation status for predictions in the last N days.
    It iterates through available daily prices and attempts to validate 
    the PREVIOUS day's prediction.
    """
    conn = get_connection()
    
    # Get recent dates with price data
    query = """
    SELECT DISTINCT date FROM daily_prices 
    WHERE date >= date('now', '-{} days')
    ORDER BY date ASC
    """.format(days + 2) # Buffer
    
    df_dates = pd.read_sql_query(query, conn)
    dates = df_dates['date'].tolist()
    
    print(f"🔍 Found price dates: {dates}")
    
    total_validated = 0
    
    for date_str in dates:
        print(f"\n📅 Processing date: {date_str} (Validating predictions from T-1)")
        
        # Get all prices for this date
        prices_query = "SELECT * FROM daily_prices WHERE date = ?"
        df_prices = pd.read_sql_query(prices_query, conn, params=(date_str,))
        
        for _, row in df_prices.iterrows():
            symbol = row['symbol']
            try:
                # validating prediction made for T-1 (using T's data)
                # validate_previous_prediction checks for 'Pending' predictions < T
                validate_previous_prediction(symbol, row)
                # We can't easily know if it actually validated something or found nothing 
                # without modifying the validator to return bool, but it logs output.
            except Exception as e:
                logger.error(f"Error validating {symbol} on {date_str}: {e}")

    conn.close()
    print("\n✅ Validation backfill complete.")

if __name__ == "__main__":
    backfill_validation(days=10)
