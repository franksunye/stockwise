"""
Backfill Investment Mode production performance over a historical date range.

Purpose:
1) Rebuild production-facing mode tables after a mode bundle release without waiting for organic daily accrual.
2) Use production data lineage (`ai_predictions_v2` primary dates) instead of research artifacts.
3) Support both local and cloud DB sources via existing `get_connection()` plumbing.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime
from typing import Dict, List, Optional, Sequence

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, ROOT_DIR)

from backend.analysis.mode_pipeline import run_mode_pipeline
from backend.database import get_connection
from backend.job_guard import JobGuard


def _table_exists(conn, table_name: str) -> bool:
    cur = conn.cursor()
    row = cur.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return bool(row)


def resolve_prediction_dates(
    conn,
    *,
    market: str,
    start_date: Optional[str],
    end_date: Optional[str],
) -> List[str]:
    cur = conn.cursor()
    where = ["p.is_primary = 1"]
    params: List[object] = []
    normalized_market = market.strip().upper()

    if start_date:
        where.append("p.date >= ?")
        params.append(start_date)
    if end_date:
        where.append("p.date <= ?")
        params.append(end_date)

    if normalized_market in {"CN", "HK"}:
        if _table_exists(conn, "stock_meta"):
            where.append("sm.market = ?")
            params.append(normalized_market)
            sql = f"""
                SELECT DISTINCT p.date
                FROM ai_predictions_v2 p
                JOIN stock_meta sm ON sm.symbol = p.symbol
                WHERE {' AND '.join(where)}
                ORDER BY p.date
            """
        else:
            symbol_filter = "LENGTH(p.symbol) = 5" if normalized_market == "HK" else "LENGTH(p.symbol) != 5"
            where.append(symbol_filter)
            sql = f"""
                SELECT DISTINCT p.date
                FROM ai_predictions_v2 p
                WHERE {' AND '.join(where)}
                ORDER BY p.date
            """
    else:
        sql = f"""
            SELECT DISTINCT p.date
            FROM ai_predictions_v2 p
            WHERE {' AND '.join(where)}
            ORDER BY p.date
        """

    rows = cur.execute(sql, tuple(params)).fetchall()
    return [str(row[0]) for row in rows]


def backfill_mode_performance(
    *,
    market: str,
    start_date: Optional[str],
    end_date: Optional[str],
    mode_id: Optional[str],
    rule_version: str,
    triggered_by: str,
    params_file: Optional[str],
    dry_run: bool,
) -> Dict[str, object]:
    conn = get_connection()
    try:
        dates = resolve_prediction_dates(conn, market=market, start_date=start_date, end_date=end_date)
    finally:
        conn.close()

    payload: Dict[str, object] = {
        "market": market,
        "start_date": start_date,
        "end_date": end_date,
        "mode_id": mode_id,
        "rule_version": rule_version,
        "triggered_by": triggered_by,
        "date_count": len(dates),
        "dates": dates,
        "dry_run": dry_run,
    }
    if dry_run:
        return payload

    run_rows: List[Dict[str, object]] = []
    aggregate = {"decision_rows": 0, "ledger_rows": 0, "snapshot_rows": 0}

    job = JobGuard("Mode Performance Backfill", task_type="maintenance", triggered_by=triggered_by)
    if dates:
        job.date_str = dates[-1]
    with job:
        job.set_dimensions(market=market, mode_id=mode_id or "ALL")
        base_job_id = job.get_pipeline_run_id()
        for idx, target_date in enumerate(dates, start=1):
            stats = run_mode_pipeline(
                as_of_date=target_date,
                mode_id=mode_id,
                job_id=f"{base_job_id}-{idx:03d}",
                rule_version=rule_version,
                triggered_by=triggered_by,
                params_file=params_file,
            )
            aggregate["decision_rows"] += int(stats.get("decision_rows", 0))
            aggregate["ledger_rows"] += int(stats.get("ledger_rows", 0))
            aggregate["snapshot_rows"] += int(stats.get("snapshot_rows", 0))
            run_rows.append(stats)

        job.set_stats(success=True, **aggregate, date_count=len(dates))

    payload["runs"] = run_rows
    payload["aggregate"] = aggregate
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill mode production performance over historical prediction dates.")
    parser.add_argument("--market", choices=["CN", "HK", "ALL"], default="ALL")
    parser.add_argument("--start-date", default="", help="Inclusive YYYY-MM-DD")
    parser.add_argument("--end-date", default="", help="Inclusive YYYY-MM-DD")
    parser.add_argument("--mode-id", default="", help="Optional single mode_id")
    parser.add_argument("--rule-version", default="mode_sim_v1")
    parser.add_argument("--triggered-by", default="manual:backfill-mode-performance")
    parser.add_argument("--params-file", default="", help="Optional local Layer-1 params override")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--output-json", default="")
    args = parser.parse_args()

    payload = backfill_mode_performance(
        market=args.market,
        start_date=args.start_date or None,
        end_date=args.end_date or None,
        mode_id=args.mode_id or None,
        rule_version=args.rule_version,
        triggered_by=args.triggered_by,
        params_file=args.params_file or None,
        dry_run=args.dry_run,
    )
    payload["run_at"] = datetime.now().isoformat(timespec="seconds")

    if args.output_json:
        output_path = os.path.abspath(args.output_json)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
