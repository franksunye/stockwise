"""
Daily Layer-1 consistency report.

Checks whether final prediction direction matches Layer-1 mapping:
- TriggeredLong -> Long
- NoSetup/Watch/RiskOff -> Side
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from utils import send_wecom_notification


def _fetchone_scalar(cur, sql: str, args: tuple = ()) -> Any:
    cur.execute(sql, args)
    row = cur.fetchone()
    if not row:
        return None
    if isinstance(row, dict):
        return next(iter(row.values()))
    return row[0]


def resolve_date(cur, date_arg: str | None) -> str:
    if date_arg:
        return date_arg
    latest = _fetchone_scalar(cur, "SELECT MAX(date) FROM ai_predictions_v2")
    if not latest:
        raise RuntimeError("ai_predictions_v2 has no data.")
    return str(latest)


def collect_metrics(target_date: str) -> Dict[str, Any]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        sql = """
            SELECT
              model_id,
              COUNT(*) AS total,
              SUM(
                CASE
                  WHEN layer1_status = 'TriggeredLong' AND signal = 'Long' THEN 1
                  WHEN layer1_status IN ('NoSetup','Watch','RiskOff') AND signal = 'Side' THEN 1
                  ELSE 0
                END
              ) AS aligned,
              SUM(CASE WHEN layer1_status='TriggeredLong' THEN 1 ELSE 0 END) AS l1_triggered,
              SUM(CASE WHEN layer1_status IN ('NoSetup','Watch','RiskOff') THEN 1 ELSE 0 END) AS l1_side_states
            FROM ai_predictions_v2
            WHERE date = ?
              AND layer1_status IS NOT NULL
              AND layer1_status <> ''
            GROUP BY model_id
            ORDER BY model_id
        """
        cur.execute(sql, (target_date,))
        rows = cur.fetchall() or []
    finally:
        conn.close()

    models: List[Dict[str, Any]] = []
    total = 0
    aligned = 0
    for r in rows:
        row = dict(r) if isinstance(r, dict) else {
            "model_id": r[0],
            "total": r[1],
            "aligned": r[2] or 0,
            "l1_triggered": r[3] or 0,
            "l1_side_states": r[4] or 0,
        }
        m_total = int(row["total"] or 0)
        m_aligned = int(row["aligned"] or 0)
        rate = (m_aligned / m_total * 100.0) if m_total else 0.0
        models.append(
            {
                "model_id": row["model_id"],
                "total": m_total,
                "aligned": m_aligned,
                "consistency_rate_pct": round(rate, 2),
                "layer1_triggered": int(row["l1_triggered"] or 0),
                "layer1_side_states": int(row["l1_side_states"] or 0),
            }
        )
        total += m_total
        aligned += m_aligned

    overall_rate = (aligned / total * 100.0) if total else 0.0
    return {
        "date": target_date,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "overall": {
            "total": total,
            "aligned": aligned,
            "consistency_rate_pct": round(overall_rate, 2),
            "pass_995": overall_rate >= 99.5,
        },
        "models": models,
    }


def to_markdown(payload: Dict[str, Any]) -> str:
    lines = []
    lines.append(f"# Layer-1 Consistency Daily Report ({payload['date']})")
    o = payload["overall"]
    lines.append("")
    lines.append(f"- Total: **{o['total']}**")
    lines.append(f"- Aligned: **{o['aligned']}**")
    lines.append(f"- Consistency: **{o['consistency_rate_pct']:.2f}%**")
    lines.append(f"- Gate (>=99.5%): **{'PASS' if o['pass_995'] else 'FAIL'}**")
    lines.append("")
    lines.append("| model_id | total | aligned | consistency |")
    lines.append("|---|---:|---:|---:|")
    for m in payload["models"]:
        lines.append(
            f"| {m['model_id']} | {m['total']} | {m['aligned']} | {m['consistency_rate_pct']:.2f}% |"
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate daily Layer-1 consistency report.")
    parser.add_argument("--date", default="", help="Target date YYYY-MM-DD. Default latest date.")
    parser.add_argument("--output-json", default="", help="Output JSON path.")
    parser.add_argument("--output-md", default="", help="Output Markdown path.")
    parser.add_argument("--notify", action="store_true", help="Send report to webhook (WeCom).")
    args = parser.parse_args()

    conn = get_connection()
    try:
        cur = conn.cursor()
        target_date = resolve_date(cur, args.date.strip() or None)
    finally:
        conn.close()

    report = collect_metrics(target_date)
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
        o = report["overall"]
        content = (
            f"## Layer-1 一致性日报 ({report['date']})\n"
            f"- 总样本: **{o['total']}**\n"
            f"- 一致样本: **{o['aligned']}**\n"
            f"- 一致率: **{o['consistency_rate_pct']:.2f}%**\n"
            f"- 门槛(>=99.5%): **{'PASS' if o['pass_995'] else 'FAIL'}**"
        )
        send_wecom_notification(content)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
