"""
Project weekly gate metrics for a local shadow universe expansion experiment.

This script does not call external models. It combines:
1) Current primary prediction rows from ai_predictions_v2.
2) Research-side Layer-1 states from quant_tradeability_signals for candidate symbols.

Use it to estimate whether adding a curated symbol set is likely to improve:
- TriggeredLong coverage
- Watch coverage
- Watch -> Triggered conversion
- RiskOff / NoSetup distribution
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "stockwise.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def _load_manifest(path: str) -> List[str]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    symbols = [str(item["symbol"]) for item in payload.get("symbols") or [] if item.get("symbol")]
    if not symbols:
        raise ValueError(f"No symbols found in manifest: {path}")
    return symbols


def _current_primary_counts(conn: sqlite3.Connection, market: str, week_start: str, week_end: str) -> Dict[str, int]:
    rows = conn.execute(
        """
        SELECT p.layer1_status, COUNT(*) AS total
        FROM ai_predictions_v2 p
        JOIN stock_meta m ON m.symbol = p.symbol
        WHERE p.is_primary = 1
          AND p.date BETWEEN ? AND ?
          AND m.market = ?
        GROUP BY p.layer1_status
        """,
        (week_start, week_end, market),
    ).fetchall()
    return {str(row["layer1_status"] or ""): int(row["total"] or 0) for row in rows}


def _candidate_state_counts(
    conn: sqlite3.Connection, market: str, strategy_version: str, week_start: str, week_end: str, symbols: Iterable[str]
) -> Dict[str, int]:
    symbol_list = list(symbols)
    if not symbol_list:
        return {}
    placeholders = ",".join(["?"] * len(symbol_list))
    rows = conn.execute(
        f"""
        SELECT setup_state, COUNT(*) AS total
        FROM quant_tradeability_signals
        WHERE market = ?
          AND strategy_version = ?
          AND date BETWEEN ? AND ?
          AND symbol IN ({placeholders})
        GROUP BY setup_state
        """,
        (market, strategy_version, week_start, week_end, *symbol_list),
    ).fetchall()
    return {str(row["setup_state"] or ""): int(row["total"] or 0) for row in rows}


def _project_watch_to_trigger(
    conn: sqlite3.Connection, market: str, strategy_version: str, week_start: str, week_end: str, symbols: Iterable[str]
) -> Dict[str, int]:
    base_watch_rows = conn.execute(
        """
        SELECT COUNT(*) AS total
        FROM ai_predictions_v2 p
        JOIN stock_meta m ON m.symbol = p.symbol
        WHERE p.is_primary = 1
          AND p.date BETWEEN ? AND ?
          AND m.market = ?
          AND p.layer1_status = 'Watch'
        """,
        (week_start, week_end, market),
    ).fetchone()
    base_watch = int(base_watch_rows["total"] or 0)

    symbol_list = list(symbols)
    if not symbol_list:
        return {
            "base_watch": base_watch,
            "added_watch": 0,
            "added_converted": 0,
            "projected_watch_to_trigger_pct": 0.0,
        }

    placeholders = ",".join(["?"] * len(symbol_list))
    rows = conn.execute(
        f"""
        SELECT symbol, date, setup_state
        FROM quant_tradeability_signals
        WHERE market = ?
          AND strategy_version = ?
          AND date BETWEEN ? AND date(?, '+3 day')
          AND symbol IN ({placeholders})
        ORDER BY symbol, date
        """,
        (market, strategy_version, week_start, week_end, *symbol_list),
    ).fetchall()

    by_symbol = defaultdict(list)
    for row in rows:
        by_symbol[str(row["symbol"])].append((str(row["date"]), str(row["setup_state"])))

    added_watch = 0
    added_converted = 0
    for states in by_symbol.values():
        for idx, (date_str, setup_state) in enumerate(states):
            if date_str < week_start or date_str > week_end or setup_state != "Watch":
                continue
            added_watch += 1
            for _, future_state in states[idx + 1 : idx + 4]:
                if future_state == "TriggeredLong":
                    added_converted += 1
                    break

    projected_watch = base_watch + added_watch
    projected_pct = round(added_converted * 100.0 / projected_watch, 2) if projected_watch else 0.0
    return {
        "base_watch": base_watch,
        "added_watch": added_watch,
        "added_converted": added_converted,
        "projected_watch_to_trigger_pct": projected_pct,
    }


def evaluate_shadow_universe(
    *, market: str, strategy_version: str, week_start: str, week_end: str, manifest_path: str
) -> Dict[str, object]:
    conn = _connect()
    try:
        symbols = _load_manifest(manifest_path)
        base_counts = _current_primary_counts(conn, market, week_start, week_end)
        added_counts = _candidate_state_counts(conn, market, strategy_version, week_start, week_end, symbols)
        watch_projection = _project_watch_to_trigger(conn, market, strategy_version, week_start, week_end, symbols)

        merged = {
            key: int(base_counts.get(key, 0)) + int(added_counts.get(key, 0))
            for key in set(base_counts) | set(added_counts)
        }
        base_total = sum(base_counts.values())
        projected_total = sum(merged.values())

        return {
            "market": market,
            "strategy_version": strategy_version,
            "window": {"start": week_start, "end": week_end},
            "manifest_path": manifest_path,
            "added_symbols": len(symbols),
            "base_counts": base_counts,
            "added_counts": added_counts,
            "projected_counts": merged,
            "base_total": base_total,
            "projected_total": projected_total,
            "projected_triggered_coverage_pct": round(merged.get("TriggeredLong", 0) * 100.0 / projected_total, 2)
            if projected_total
            else 0.0,
            "projected_watch_coverage_pct": round(merged.get("Watch", 0) * 100.0 / projected_total, 2)
            if projected_total
            else 0.0,
            "projected_riskoff_coverage_pct": round(merged.get("RiskOff", 0) * 100.0 / projected_total, 2)
            if projected_total
            else 0.0,
            "projected_nosetup_coverage_pct": round(merged.get("NoSetup", 0) * 100.0 / projected_total, 2)
            if projected_total
            else 0.0,
            "watch_projection": watch_projection,
        }
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a local shadow universe expansion against weekly gate metrics.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--strategy-version", default="tradeability_v2")
    parser.add_argument("--week-start", required=True)
    parser.add_argument("--week-end", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-json", default="")
    args = parser.parse_args()

    result = evaluate_shadow_universe(
        market=args.market,
        strategy_version=args.strategy_version,
        week_start=args.week_start,
        week_end=args.week_end,
        manifest_path=args.manifest,
    )

    if args.output_json:
        output_path = Path(args.output_json)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
