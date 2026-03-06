"""
Backfill historical quant_tradeability_signals for versioned Layer-1 strategies.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Sequence

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from backend.engine.layer1_state import DEFAULT_STRATEGY_VERSION, evaluate_layer1_state, list_supported_strategy_versions, load_market_params


def ensure_sidecar_table(conn) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS quant_tradeability_signals (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            market TEXT NOT NULL,
            strategy_version TEXT NOT NULL,
            setup_state TEXT NOT NULL,
            opportunity_score REAL NOT NULL,
            trigger_rule_hit INTEGER DEFAULT 0,
            risk_off_hit INTEGER DEFAULT 0,
            signal_payload TEXT,
            created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
            updated_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
            PRIMARY KEY (symbol, date, market, strategy_version)
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_qts_date_market ON quant_tradeability_signals(date DESC, market, strategy_version)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_qts_state_date ON quant_tradeability_signals(setup_state, date DESC)"
    )
    conn.commit()


def _parse_versions(raw: str) -> List[str]:
    versions = [x.strip() for x in raw.split(",") if x.strip()]
    if not versions:
        return [DEFAULT_STRATEGY_VERSION]
    valid = set(list_supported_strategy_versions())
    unknown = [x for x in versions if x not in valid]
    if unknown:
        raise ValueError(f"Unsupported strategy versions: {unknown}. Supported: {sorted(valid)}")
    return versions


def load_histories(market: str, start_date: str | None, end_date: str | None) -> Dict[str, List[Dict[str, object]]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        where = ["sm.market = ?"]
        params: List[object] = [market]
        if start_date:
            where.append("dp.date >= ?")
            params.append(start_date)
        if end_date:
            where.append("dp.date <= ?")
            params.append(end_date)
        rows = cur.execute(
            f"""
            SELECT
              dp.symbol, dp.date, dp.high, dp.low, dp.close, dp.volume,
              dp.ma5, dp.ma10, dp.ma20, dp.macd_hist, dp.change_percent
            FROM daily_prices dp
            JOIN stock_meta sm ON sm.symbol = dp.symbol
            WHERE {' AND '.join(where)}
            ORDER BY dp.symbol, dp.date
            """,
            tuple(params),
        ).fetchall()
        out: Dict[str, List[Dict[str, object]]] = {}
        for row in rows:
            out.setdefault(str(row[0]), []).append(
                {
                    "date": str(row[1]),
                    "high": float(row[2]) if row[2] is not None else 0.0,
                    "low": float(row[3]) if row[3] is not None else 0.0,
                    "close": float(row[4]) if row[4] is not None else 0.0,
                    "volume": float(row[5]) if row[5] is not None else 0.0,
                    "ma5": float(row[6]) if row[6] is not None else 0.0,
                    "ma10": float(row[7]) if row[7] is not None else 0.0,
                    "ma20": float(row[8]) if row[8] is not None else 0.0,
                    "macd_hist": float(row[9]) if row[9] is not None else 0.0,
                    "change_percent": float(row[10]) if row[10] is not None else 0.0,
                }
            )
        return out
    finally:
        conn.close()


def backfill_history(market: str, strategy_versions: Sequence[str], start_date: str | None, end_date: str | None) -> Dict[str, object]:
    histories = load_histories(market, start_date, end_date)
    if not histories:
        raise RuntimeError(f"No histories found for market={market}")

    version_params = {version: load_market_params(market=market, strategy_version=version)[1] for version in strategy_versions}
    rows: List[tuple] = []
    state_counts: Dict[str, Dict[str, int]] = {version: {} for version in strategy_versions}
    for symbol, history in histories.items():
        for idx in range(len(history)):
            if idx < 20:
                continue
            slice_history = history[: idx + 1]
            latest_date = str(slice_history[-1]["date"])
            for version in strategy_versions:
                snapshot = evaluate_layer1_state(slice_history, params=version_params[version], strategy_version=version)
                state_counts[version][snapshot.setup_state] = state_counts[version].get(snapshot.setup_state, 0) + 1
                rows.append(
                    (
                        symbol,
                        latest_date,
                        market,
                        version,
                        snapshot.setup_state,
                        float(snapshot.opportunity_score),
                        int(snapshot.trigger_rule_hit),
                        int(snapshot.risk_off_hit),
                        json.dumps(snapshot.payload, ensure_ascii=False),
                    )
                )

    conn = get_connection()
    try:
        ensure_sidecar_table(conn)
        cur = conn.cursor()
        cur.executemany(
            """
            INSERT INTO quant_tradeability_signals
            (symbol, date, market, strategy_version, setup_state, opportunity_score, trigger_rule_hit, risk_off_hit, signal_payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(symbol, date, market, strategy_version) DO UPDATE SET
                setup_state = excluded.setup_state,
                opportunity_score = excluded.opportunity_score,
                trigger_rule_hit = excluded.trigger_rule_hit,
                risk_off_hit = excluded.risk_off_hit,
                signal_payload = excluded.signal_payload,
                updated_at = (datetime('now', '+8 hours'))
            """,
            rows,
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "market": market,
        "strategy_versions": list(strategy_versions),
        "rows_written": len(rows),
        "symbols": len(histories),
        "state_counts": state_counts,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill historical quant_tradeability_signals.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--strategy-versions", default="tradeability_v1,tradeability_v2")
    parser.add_argument("--start-date", default="")
    parser.add_argument("--end-date", default="")
    args = parser.parse_args()

    payload = backfill_history(
        market=args.market,
        strategy_versions=_parse_versions(args.strategy_versions),
        start_date=args.start_date or None,
        end_date=args.end_date or None,
    )
    payload["run_at"] = datetime.now().isoformat(timespec="seconds")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
