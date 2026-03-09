"""
Tradeability Sidecar Runner (non-intrusive).

Purpose:
1) Compute NoSetup/Watch/TriggeredLong/RiskOff on latest market date.
2) Store outputs into quant_tradeability_signals table.
3) Support strategy-version experiments without changing the user-facing structure.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Dict, List, Optional, Sequence
from pathlib import Path

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from backend.engine.layer1_state import (
    DEFAULT_STRATEGY_VERSION,
    evaluate_layer1_state,
    list_supported_strategy_versions,
    load_market_params,
)


def load_symbols_from_manifest(manifest_path: str) -> List[str]:
    payload = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    symbols = [str(item.get("symbol")) for item in payload.get("symbols") or [] if item.get("symbol")]
    if not symbols:
        raise ValueError(f"No symbols found in manifest: {manifest_path}")
    return symbols


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


def resolve_target_date(cursor, market: str, target_date: Optional[str]) -> Optional[str]:
    if target_date:
        return target_date
    row = cursor.execute(
        """
        SELECT MAX(dp.date)
        FROM daily_prices dp
        JOIN stock_meta sm ON sm.symbol = dp.symbol
        WHERE sm.market = ?
        """,
        (market,),
    ).fetchone()
    return row[0] if row and row[0] else None


def fetch_symbols_for_date(cursor, market: str, date_str: str, manifest_path: str = "") -> List[str]:
    manifest_symbols = load_symbols_from_manifest(manifest_path) if manifest_path else []
    args: list[object] = [date_str, market]
    manifest_filter = ""
    if manifest_symbols:
        placeholders = ",".join(["?"] * len(manifest_symbols))
        manifest_filter = f" AND dp.symbol IN ({placeholders})"
        args.extend(manifest_symbols)
    rows = cursor.execute(
        f"""
        SELECT dp.symbol
        FROM daily_prices dp
        JOIN stock_meta sm ON sm.symbol = dp.symbol
        WHERE dp.date = ? AND sm.market = ?
        {manifest_filter}
        ORDER BY dp.symbol
        """,
        tuple(args),
    ).fetchall()
    return [str(r[0]) for r in rows]


def fetch_history(cursor, symbol: str, date_str: str, lookback: int = 25) -> List[Dict[str, object]]:
    rows = cursor.execute(
        """
        SELECT date, high, low, close, volume, ma5, ma10, ma20, macd_hist, change_percent
        FROM daily_prices
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC
        LIMIT ?
        """,
        (symbol, date_str, lookback),
    ).fetchall()
    history: List[Dict[str, object]] = []
    for r in reversed(rows):
        history.append(
            {
                "date": str(r[0]),
                "high": float(r[1]) if r[1] is not None else 0.0,
                "low": float(r[2]) if r[2] is not None else 0.0,
                "close": float(r[3]) if r[3] is not None else 0.0,
                "volume": float(r[4]) if r[4] is not None else 0.0,
                "ma5": float(r[5]) if r[5] is not None else 0.0,
                "ma10": float(r[6]) if r[6] is not None else 0.0,
                "ma20": float(r[7]) if r[7] is not None else 0.0,
                "macd_hist": float(r[8]) if r[8] is not None else 0.0,
                "change_percent": float(r[9]) if r[9] is not None else 0.0,
            }
        )
    return history


def _parse_strategy_versions(raw: str) -> List[str]:
    versions = [x.strip() for x in raw.split(",") if x.strip()]
    if not versions:
        return [DEFAULT_STRATEGY_VERSION]
    valid = set(list_supported_strategy_versions())
    unknown = [x for x in versions if x not in valid]
    if unknown:
        raise ValueError(f"Unsupported strategy versions: {unknown}. Supported: {sorted(valid)}")
    return versions


def _override_params(base_params: Dict[str, float], args: argparse.Namespace) -> Dict[str, float]:
    params = dict(base_params)
    if args.vcp_ratio is not None:
        params["vcp_ratio"] = float(args.vcp_ratio)
    if args.breakout_volume_mult is not None:
        params["breakout_volume_mult"] = float(args.breakout_volume_mult)
    if args.strong_close_threshold is not None:
        params["strong_close_threshold"] = float(args.strong_close_threshold)
    if args.momentum_change_threshold is not None:
        params["momentum_change_threshold"] = float(args.momentum_change_threshold)
    if args.risk_off_ma is not None:
        params["risk_off_ma"] = float(args.risk_off_ma)
    return params


def _upsert_rows(conn, rows: Sequence[tuple]) -> None:
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Run tradeability sidecar and upsert signals.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--date", default="", help="YYYY-MM-DD; default latest in market")
    parser.add_argument("--strategy-version", default=DEFAULT_STRATEGY_VERSION)
    parser.add_argument("--strategy-versions", default="", help="Comma-separated experiment versions, e.g. tradeability_v1,tradeability_v2")
    parser.add_argument("--params-file", default="", help="Optional override for single-version runs")
    parser.add_argument("--research-pool-manifest", default="", help="Optional manifest used to restrict the experiment universe")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--vcp-ratio", type=float, default=None)
    parser.add_argument("--breakout-volume-mult", type=float, default=None)
    parser.add_argument("--strong-close-threshold", type=float, default=None)
    parser.add_argument("--momentum-change-threshold", type=float, default=None)
    parser.add_argument("--risk-off-ma", type=int, choices=[5, 10, 20], default=None)
    args = parser.parse_args()

    strategy_versions = (
        _parse_strategy_versions(args.strategy_versions)
        if args.strategy_versions.strip()
        else _parse_strategy_versions(args.strategy_version)
    )

    conn = get_connection()
    try:
        ensure_sidecar_table(conn)
        cur = conn.cursor()

        target_date = resolve_target_date(cur, args.market, args.date or None)
        if not target_date:
            logger.warning(f"No target date found for market={args.market}")
            return

        symbols = fetch_symbols_for_date(cur, args.market, target_date, args.research_pool_manifest)
        if not symbols:
            logger.warning(f"No symbols found for market={args.market} date={target_date}")
            return

        run_rows: List[tuple] = []
        run_summary: Dict[str, Dict[str, object]] = {}
        for strategy_version in strategy_versions:
            loaded_version, base_params = load_market_params(
                market=args.market,
                params_file=args.params_file or None,
                strategy_version=strategy_version,
            )
            params = _override_params(base_params, args)
            state_counts: Dict[str, int] = {"NoSetup": 0, "Watch": 0, "TriggeredLong": 0, "RiskOff": 0}
            logger.info(
                f"Tradeability sidecar running: market={args.market}, date={target_date}, symbols={len(symbols)}, "
                f"strategy={loaded_version}, dry_run={args.dry_run}, params={params}"
            )

            for symbol in symbols:
                history = fetch_history(cur, symbol, target_date, lookback=25)
                snapshot = evaluate_layer1_state(history, params=params, strategy_version=loaded_version)
                state_counts[snapshot.setup_state] = state_counts.get(snapshot.setup_state, 0) + 1
                run_rows.append(
                    (
                        symbol,
                        target_date,
                        args.market,
                        loaded_version,
                        snapshot.setup_state,
                        round(snapshot.opportunity_score, 2),
                        int(snapshot.trigger_rule_hit),
                        int(snapshot.risk_off_hit),
                        json.dumps(snapshot.payload, ensure_ascii=False),
                    )
                )

            total = sum(state_counts.values())
            run_summary[loaded_version] = {
                "total": total,
                "state_counts": state_counts,
                "triggered_coverage_pct": round(100.0 * state_counts["TriggeredLong"] / total, 2) if total else 0.0,
                "risk_off_pct": round(100.0 * state_counts["RiskOff"] / total, 2) if total else 0.0,
                "params": params,
            }

        if not args.dry_run:
            _upsert_rows(conn, run_rows)

        payload = {
            "market": args.market,
            "date": target_date,
            "dry_run": args.dry_run,
            "research_pool_manifest": args.research_pool_manifest or None,
            "strategies": run_summary,
        }
        logger.info(f"Sidecar done. market={args.market}, date={target_date}, summary={run_summary}, dry_run={args.dry_run}")
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
