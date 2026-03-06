"""
Weekly acceptance snapshot for two-layer architecture.

Current computable gates:
- Layer-1 direction consistency (>=99.5%)
- TriggeredLong coverage (5%~20%) from quant_tradeability_signals
- Watch->TriggeredLong conversion (15%~40%) from consecutive daily states
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Any, Dict

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from utils import send_wecom_notification


def _fetchone(cur, sql: str, args: tuple = ()) -> Any:
    cur.execute(sql, args)
    return cur.fetchone()


def _resolve_end_date(cur, end_date: str | None) -> str:
    if end_date:
        return end_date
    row = _fetchone(cur, "SELECT MAX(date) FROM ai_predictions_v2")
    if not row:
        raise RuntimeError("No data in ai_predictions_v2.")
    return str(row[0] if not isinstance(row, dict) else next(iter(row.values())))


def _to_float(x: Any) -> float:
    try:
        return float(x)
    except Exception:
        return 0.0


def collect(end_date: str) -> Dict[str, Any]:
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    start_dt = end_dt - timedelta(days=6)
    start_date = start_dt.strftime("%Y-%m-%d")

    conn = get_connection()
    try:
        cur = conn.cursor()

        # 1) Consistency
        row = _fetchone(
            cur,
            """
            SELECT
              COUNT(*) AS total,
              SUM(
                CASE
                  WHEN layer1_status = 'TriggeredLong' AND signal = 'Long' THEN 1
                  WHEN layer1_status IN ('NoSetup','Watch','RiskOff') AND signal = 'Side' THEN 1
                  ELSE 0
                END
              ) AS aligned
            FROM ai_predictions_v2
            WHERE date BETWEEN ? AND ?
              AND layer1_status IS NOT NULL
              AND layer1_status <> ''
            """,
            (start_date, end_date),
        )
        total = int((row[0] if not isinstance(row, dict) else row["total"]) or 0)
        aligned = int((row[1] if not isinstance(row, dict) else row["aligned"]) or 0)
        consistency = (aligned / total * 100.0) if total else 0.0

        # 2) TriggeredLong coverage from sidecar states
        row = _fetchone(
            cur,
            """
            SELECT
              COUNT(*) AS total_states,
              SUM(CASE WHEN setup_state='TriggeredLong' THEN 1 ELSE 0 END) AS triggered
            FROM quant_tradeability_signals
            WHERE date BETWEEN ? AND ?
            """,
            (start_date, end_date),
        )
        state_total = int((row[0] if not isinstance(row, dict) else row["total_states"]) or 0)
        triggered = int((row[1] if not isinstance(row, dict) else row["triggered"]) or 0)
        triggered_cov = (triggered / state_total * 100.0) if state_total else 0.0

        # 3) Watch -> TriggeredLong conversion (next day)
        row = _fetchone(
            cur,
            """
            WITH w AS (
              SELECT symbol, date
              FROM quant_tradeability_signals
              WHERE setup_state='Watch' AND date BETWEEN ? AND ?
            ),
            wt AS (
              SELECT COUNT(*) AS c
              FROM w
              JOIN quant_tradeability_signals t
                ON t.symbol = w.symbol
               AND t.setup_state='TriggeredLong'
               AND julianday(t.date) - julianday(w.date) = 1
            )
            SELECT
              (SELECT COUNT(*) FROM w) AS watch_count,
              (SELECT c FROM wt) AS converted
            """,
            (start_date, end_date),
        )
        watch_count = int((row[0] if not isinstance(row, dict) else row["watch_count"]) or 0)
        converted = int((row[1] if not isinstance(row, dict) else row["converted"]) or 0)
        watch_to_trigger = (converted / watch_count * 100.0) if watch_count else 0.0

    finally:
        conn.close()

    gates = {
        "consistency_gate": consistency >= 99.5,
        "triggered_coverage_gate": 5.0 <= triggered_cov <= 20.0,
        "watch_to_trigger_gate": 15.0 <= watch_to_trigger <= 40.0,
    }
    level1_pass = all(gates.values())

    return {
        "window": {"start_date": start_date, "end_date": end_date},
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "metrics": {
            "consistency_rate_pct": round(consistency, 2),
            "consistency_total": total,
            "consistency_aligned": aligned,
            "triggered_coverage_pct": round(triggered_cov, 2),
            "state_total": state_total,
            "triggered_count": triggered,
            "watch_to_trigger_pct": round(watch_to_trigger, 2),
            "watch_count": watch_count,
            "converted_count": converted,
        },
        "gates": gates,
        "level1_pass": level1_pass,
        "notes": [
            "Expectancy/Payoff/MDD should be added in a dedicated PnL pipeline.",
            "Current weekly report focuses on architecture-consistency and trigger behavior.",
        ],
    }


def to_markdown(report: Dict[str, Any]) -> str:
    w = report["window"]
    m = report["metrics"]
    g = report["gates"]
    lines = []
    lines.append(f"# Weekly Acceptance Snapshot ({w['start_date']} ~ {w['end_date']})")
    lines.append("")
    lines.append(f"- Level-1 Gate: **{'PASS' if report['level1_pass'] else 'FAIL'}**")
    lines.append(f"- Consistency: **{m['consistency_rate_pct']:.2f}%** ({m['consistency_aligned']}/{m['consistency_total']})")
    lines.append(f"- Triggered Coverage: **{m['triggered_coverage_pct']:.2f}%** ({m['triggered_count']}/{m['state_total']})")
    lines.append(f"- Watch->Triggered: **{m['watch_to_trigger_pct']:.2f}%** ({m['converted_count']}/{m['watch_count']})")
    lines.append("")
    lines.append("| Gate | Rule | Result |")
    lines.append("|---|---|---|")
    lines.append(f"| consistency_gate | >=99.5% | {'PASS' if g['consistency_gate'] else 'FAIL'} |")
    lines.append(f"| triggered_coverage_gate | 5%~20% | {'PASS' if g['triggered_coverage_gate'] else 'FAIL'} |")
    lines.append(f"| watch_to_trigger_gate | 15%~40% | {'PASS' if g['watch_to_trigger_gate'] else 'FAIL'} |")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate weekly acceptance snapshot.")
    parser.add_argument("--week-end", default="", help="Week end date YYYY-MM-DD. Default latest.")
    parser.add_argument("--output-json", default="", help="Output JSON path.")
    parser.add_argument("--output-md", default="", help="Output Markdown path.")
    parser.add_argument("--notify", action="store_true", help="Send summary to webhook (WeCom).")
    args = parser.parse_args()

    conn = get_connection()
    try:
        cur = conn.cursor()
        end_date = _resolve_end_date(cur, args.week_end.strip() or None)
    finally:
        conn.close()

    report = collect(end_date)
    markdown = to_markdown(report)

    if args.output_json:
        os.makedirs(os.path.dirname(args.output_json), exist_ok=True)
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
    if args.output_md:
        os.makedirs(os.path.dirname(args.output_md), exist_ok=True)
        with open(args.output_md, "w", encoding="utf-8") as f:
            f.write(markdown + "\n")

    logger.info(markdown)

    if args.notify:
        m = report["metrics"]
        content = (
            f"## 周验收快照 ({report['window']['start_date']}~{report['window']['end_date']})\n"
            f"- Level-1: **{'PASS' if report['level1_pass'] else 'FAIL'}**\n"
            f"- 一致率: **{m['consistency_rate_pct']:.2f}%**\n"
            f"- Triggered覆盖: **{m['triggered_coverage_pct']:.2f}%**\n"
            f"- Watch转化: **{m['watch_to_trigger_pct']:.2f}%**"
        )
        send_wecom_notification(content)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
