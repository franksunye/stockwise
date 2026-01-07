import sys
import os
import pandas as pd
# Add project root to path (so 'backend' package is resolvable)
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Also add backend itself for relative imports if needed (legacy)
backend_path = os.path.join(project_root, 'backend')
if backend_path not in sys.path:
    sys.path.append(backend_path)

from backend.database import get_connection, get_stock_pool
from backend.engine.ai_service import _generate_rule_based_prediction
from backend.quant.engine import QuantEngine

def verify_parity():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Select a few random stocks
    pool = get_stock_pool()
    targets = pool[:5] if pool else ['00700']
    
    engine = QuantEngine()
    
    print(f"🔍 Verifying Parity for {len(targets)} stocks...")
    
    passed = 0
    failed = 0
    
    for symbol in targets:
        # Get Daily Data
        query = f"SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1"
        df = pd.read_sql_query(query, conn, params=(symbol,))
        
        if df.empty:
            print(f"⚠️ {symbol}: No data, skipping.")
            continue
            
        today_data = df.iloc[0]
        
        # 1. Run Legacy Logic
        # Note: This function writes to DB, but for verification we just check the return structure or print logs
        # Actually it returns the result dict
        legacy_result = _generate_rule_based_prediction(symbol, today_data)
        
        # 2. Run New Quant Logic
        # We need to manually fetch weekly/monthly context to match what legacy does internally
        cursor.execute("SELECT * FROM monthly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
        m_row = cursor.fetchone()
        if m_row:
             m_cols = [d[0] for d in cursor.description]
             monthly_series = pd.Series(dict(zip(m_cols, m_row)))
        else:
             monthly_series = None
             
        cursor.execute("SELECT * FROM weekly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
        w_row = cursor.fetchone()
        if w_row:
             w_cols = [d[0] for d in cursor.description]
             weekly_series = pd.Series(dict(zip(w_cols, w_row)))
        else:
             weekly_series = None
             
        context = {
            'daily_row': today_data,
            'weekly_row': weekly_series,
            'monthly_row': monthly_series
        }
        
        new_result = engine.run(symbol, context, strategy_name="trend")
        
        # 3. Compare
        l_signal = legacy_result.get('signal')
        n_signal = new_result.signal.action
        
        l_conf = legacy_result.get('confidence')
        n_conf = new_result.signal.confidence
        
        # Floating point comparison
        match_signal = l_signal == n_signal
        match_conf = abs(l_conf - n_conf) < 0.001
        
        if match_signal and match_conf:
            print(f"✅ {symbol}: PASS (Signal={l_signal}, Conf={l_conf})")
            passed += 1
        else:
            print(f"❌ {symbol}: FAIL")
            print(f"   Legacy: Signal={l_signal}, Conf={l_conf}")
            print(f"   New   : Signal={n_signal}, Conf={n_conf}")
            print(f"   New Reason: {new_result.signal.reason}")
            failed += 1
            
    print(f"\n📊 Result: {passed} Passed, {failed} Failed")
    conn.close()

if __name__ == "__main__":
    verify_parity()
