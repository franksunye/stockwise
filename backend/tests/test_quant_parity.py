import asyncio
import os
import sys

import pandas as pd

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
backend_path = os.path.join(project_root, "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)

os.environ["DB_SOURCE"] = "local"

from backend.database import get_connection, get_stock_pool
from backend.engine.models.rule_based import RuleAdapter
from backend.quant.engine import QuantEngine


def _latest_daily_row(conn, symbol: str):
    df = pd.read_sql_query(
        "SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1",
        conn,
        params=(symbol,),
    )
    if df.empty:
        return None
    return df.iloc[0]


def _series_from_table(cursor, table: str, symbol: str):
    cursor.execute(f"SELECT * FROM {table} WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
    row = cursor.fetchone()
    if not row:
        return None
    cols = [d[0] for d in cursor.description]
    return pd.Series(dict(zip(cols, row)))


def verify_parity():
    conn = get_connection()
    cursor = conn.cursor()
    pool = get_stock_pool()
    targets = pool[:5] if pool else ["00700"]

    engine = QuantEngine()
    adapter = RuleAdapter(model_id="rule-engine", config={"display_name": "Rule Engine"})

    print(f"🔍 Verifying RuleAdapter parity for {len(targets)} stocks...")
    passed = 0
    failed = 0

    for symbol in targets:
        daily_row = _latest_daily_row(conn, symbol)
        if daily_row is None:
            print(f"⚠️ {symbol}: no daily data, skipping.")
            continue

        weekly_series = _series_from_table(cursor, "weekly_prices", symbol)
        monthly_series = _series_from_table(cursor, "monthly_prices", symbol)
        context = {"daily_row": daily_row, "weekly_row": weekly_series, "monthly_row": monthly_series}

        q_result = engine.run(symbol, context, strategy_name="trend")
        q_signal = q_result.signal.action
        q_conf = q_result.signal.confidence

        adapter_data = {"daily_prices": [daily_row.to_dict()]}
        a_result = asyncio.run(adapter.predict(symbol, str(daily_row["date"]), adapter_data))
        a_signal = a_result.get("signal")
        a_conf = a_result.get("confidence")

        match_signal = q_signal == a_signal
        match_conf = abs(q_conf - a_conf) < 0.001
        if match_signal and match_conf:
            print(f"✅ {symbol}: PASS (signal={q_signal}, conf={q_conf:.3f})")
            passed += 1
        else:
            print(f"❌ {symbol}: FAIL")
            print(f"   Quant   : signal={q_signal}, conf={q_conf:.3f}")
            print(f"   Adapter : signal={a_signal}, conf={a_conf:.3f}")
            failed += 1

    print(f"\n📊 Result: {passed} passed, {failed} failed")
    conn.close()
    return failed == 0


if __name__ == "__main__":
    ok = verify_parity()
    raise SystemExit(0 if ok else 1)
