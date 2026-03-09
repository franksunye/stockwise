"""
Daily Layer-1 consistency report.

Checks whether final prediction direction matches Layer-1 mapping:
- TriggeredLong -> Long
- NoSetup/Watch/RiskOff -> Side

Enhancements:
- Four-state coverage metrics
- Strategy-version filter
- Optional persistence for weekly traceability
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from utils import send_wecom_notification
from engine.layer1_state import DEFAULT_STRATEGY_VERSION


def _fetchone_scalar(cur, sql: str, args: tuple = ()) -> Any:
    cur.execute(sql, args)
    row = cur.fetchone()
    if not row:
        return None
    if isinstance(row, dict):
        return next(iter(row.values()))
    return row[0]


def _market_case_sql(alias: str = "symbol") -> str:
    return f"CASE WHEN LENGTH({alias}) = 5 THEN 'HK' ELSE 'CN' END"


def resolve_date(cur, date_arg: str | None) -> str:
    if date_arg:
        return date_arg
    latest = _fetchone_scalar(cur, "SELECT MAX(date) FROM ai_predictions_v2")
    if not latest:
        raise RuntimeError("ai_predictions_v2 has no data.")
    return str(latest)


def ensure_daily_report_table(conn) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS layer1_daily_reports (
            report_date TEXT NOT NULL,
            strategy_version TEXT NOT NULL,
            market TEXT NOT NULL,
            total_predictions INTEGER NOT NULL,
            aligned_predictions INTEGER NOT NULL,
            consistency_rate_pct REAL NOT NULL,
            no_setup_pct REAL NOT NULL,
            watch_pct REAL NOT NULL,
            triggered_long_pct REAL NOT NULL,
            risk_off_pct REAL NOT NULL,
            pass_995 INTEGER NOT NULL,
            report_json TEXT NOT NULL,
            generated_at TEXT NOT NULL,
            PRIMARY KEY (report_date, strategy_version, market)
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_layer1_daily_reports_date ON layer1_daily_reports(report_date DESC, strategy_version, market)"
    )


def _state_coverage_from_rows(rows: List[Dict[str, Any]], total_states: int) -> Dict[str, float]:
    counts = {"NoSetup": 0, "Watch": 0, "TriggeredLong": 0, "RiskOff": 0}
    for r in rows:
        s = str(r.get("setup_state") or "")
        if s in counts:
            counts[s] = int(r.get("cnt") or 0)
    if total_states <= 0:
        return {k: 0.0 for k in counts.keys()}
    return {k: round(v / total_states * 100.0, 2) for k, v in counts.items()}


def collect_metrics(target_date: str, strategy_version: str = DEFAULT_STRATEGY_VERSION) -> Dict[str, Any]:
    conn = get_connection()
    try:
        cur = conn.cursor()

        consistency_sql = """
            SELECT
              {market_case} AS market,
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
              AND is_primary = 1
              AND layer1_status IS NOT NULL
              AND layer1_status <> ''
              AND COALESCE(NULLIF(layer1_strategy_version, ''), 'tradeability_v2') = ?
            GROUP BY {market_case}, model_id
            ORDER BY market, model_id
        """.format(market_case=_market_case_sql("symbol"))
        cur.execute(consistency_sql, (target_date, strategy_version))
        rows = cur.fetchall() or []

        state_sql = """
            SELECT market, setup_state, cnt
            FROM (
              SELECT
                {market_case} AS market,
                layer1_status AS setup_state,
                COUNT(*) AS cnt
              FROM ai_predictions_v2
              WHERE date = ?
                AND is_primary = 1
                AND layer1_status IN ('NoSetup','Watch','TriggeredLong','RiskOff')
                AND COALESCE(NULLIF(layer1_strategy_version, ''), 'tradeability_v2') = ?
              GROUP BY {market_case}, layer1_status
            )
            ORDER BY market, setup_state
        """.format(market_case=_market_case_sql("symbol"))
        cur.execute(state_sql, (target_date, strategy_version))
        state_rows = cur.fetchall() or []
    finally:
        conn.close()

    models: List[Dict[str, Any]] = []
    by_market: Dict[str, Dict[str, Any]] = {}
    total = 0
    aligned = 0

    for r in rows:
        row = dict(r) if isinstance(r, dict) else {
            "market": r[0],
            "model_id": r[1],
            "total": r[2],
            "aligned": r[3] or 0,
            "l1_triggered": r[4] or 0,
            "l1_side_states": r[5] or 0,
        }
        market = str(row.get("market") or "ALL")
        m_total = int(row.get("total") or 0)
        m_aligned = int(row.get("aligned") or 0)
        rate = (m_aligned / m_total * 100.0) if m_total else 0.0

        models.append(
            {
                "market": market,
                "model_id": row.get("model_id"),
                "total": m_total,
                "aligned": m_aligned,
                "consistency_rate_pct": round(rate, 2),
                "layer1_triggered": int(row.get("l1_triggered") or 0),
                "layer1_side_states": int(row.get("l1_side_states") or 0),
            }
        )
        total += m_total
        aligned += m_aligned

        item = by_market.setdefault(market, {"total": 0, "aligned": 0})
        item["total"] += m_total
        item["aligned"] += m_aligned

    overall_rate = (aligned / total * 100.0) if total else 0.0

    state_rows_norm = []
    for r in state_rows:
        row = dict(r) if isinstance(r, dict) else {"market": r[0], "setup_state": r[1], "cnt": r[2]}
        state_rows_norm.append(row)

    all_state_total = int(sum(int(x.get("cnt") or 0) for x in state_rows_norm))
    state_coverage_all = _state_coverage_from_rows(state_rows_norm, all_state_total)

    for market in ["CN", "HK"]:
        rows_m = [x for x in state_rows_norm if str(x.get("market") or "") == market]
        total_m = int(sum(int(x.get("cnt") or 0) for x in rows_m))
        mk = by_market.setdefault(market, {"total": 0, "aligned": 0})
        mk_total = int(mk.get("total") or 0)
        mk_aligned = int(mk.get("aligned") or 0)
        mk["state_total"] = total_m
        mk["state_coverage_pct"] = _state_coverage_from_rows(rows_m, total_m)
        mk["consistency_rate_pct"] = round((mk_aligned / mk_total * 100.0), 2) if mk_total else 0.0
        mk["pass_995"] = bool(mk["consistency_rate_pct"] >= 99.5)

    return {
        "date": target_date,
        "strategy_version": strategy_version,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "overall": {
            "total": total,
            "aligned": aligned,
            "consistency_rate_pct": round(overall_rate, 2),
            "pass_995": overall_rate >= 99.5,
            "state_total": all_state_total,
            "state_coverage_pct": state_coverage_all,
        },
        "by_market": by_market,
        "models": models,
    }


def to_markdown(payload: Dict[str, Any]) -> str:
    lines = []
    lines.append(f"# Layer-1 Consistency Daily Report ({payload['date']})")
    o = payload["overall"]
    lines.append("")
    lines.append(f"- Strategy: `{payload.get('strategy_version', DEFAULT_STRATEGY_VERSION)}`")
    lines.append(f"- Total: **{o['total']}**")
    lines.append(f"- Aligned: **{o['aligned']}**")
    lines.append(f"- Consistency: **{o['consistency_rate_pct']:.2f}%**")
    lines.append(f"- Gate (>=99.5%): **{'PASS' if o['pass_995'] else 'FAIL'}**")
    lines.append(f"- State total: **{o.get('state_total', 0)}**")
    lines.append(f"- State coverage: `{json.dumps(o.get('state_coverage_pct', {}), ensure_ascii=False)}`")
    lines.append("")
    lines.append("| market | total | aligned | consistency | state_total | TriggeredLong | Watch | RiskOff | NoSetup |")
    lines.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for mk in sorted(payload.get("by_market", {}).keys()):
        d = payload["by_market"][mk]
        cov = d.get("state_coverage_pct", {})
        lines.append(
            f"| {mk} | {d.get('total', 0)} | {d.get('aligned', 0)} | {d.get('consistency_rate_pct', 0):.2f}% | "
            f"{d.get('state_total', 0)} | {cov.get('TriggeredLong', 0):.2f}% | {cov.get('Watch', 0):.2f}% | "
            f"{cov.get('RiskOff', 0):.2f}% | {cov.get('NoSetup', 0):.2f}% |"
        )
    lines.append("")
    lines.append("| market | model_id | total | aligned | consistency |")
    lines.append("|---|---|---:|---:|---:|")
    for m in payload["models"]:
        lines.append(
            f"| {m.get('market', 'ALL')} | {m['model_id']} | {m['total']} | {m['aligned']} | {m['consistency_rate_pct']:.2f}% |"
        )
    return "\n".join(lines)


def persist_report(payload: Dict[str, Any]) -> None:
    report_date = str(payload["date"])
    strategy_version = str(payload.get("strategy_version") or DEFAULT_STRATEGY_VERSION)
    generated_at = str(payload.get("generated_at") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    report_json = json.dumps(payload, ensure_ascii=False)
    overall = payload.get("overall", {})
    by_market = payload.get("by_market", {})

    conn = get_connection()
    try:
        ensure_daily_report_table(conn)
        cur = conn.cursor()

        rows = [("ALL", overall)]
        for mk, data in by_market.items():
            rows.append((mk, data))

        for market, data in rows:
            state_cov = data.get("state_coverage_pct", {})
            cur.execute(
                """
                INSERT INTO layer1_daily_reports
                (report_date, strategy_version, market, total_predictions, aligned_predictions, consistency_rate_pct,
                 no_setup_pct, watch_pct, triggered_long_pct, risk_off_pct, pass_995, report_json, generated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(report_date, strategy_version, market) DO UPDATE SET
                  total_predictions=excluded.total_predictions,
                  aligned_predictions=excluded.aligned_predictions,
                  consistency_rate_pct=excluded.consistency_rate_pct,
                  no_setup_pct=excluded.no_setup_pct,
                  watch_pct=excluded.watch_pct,
                  triggered_long_pct=excluded.triggered_long_pct,
                  risk_off_pct=excluded.risk_off_pct,
                  pass_995=excluded.pass_995,
                  report_json=excluded.report_json,
                  generated_at=excluded.generated_at
                """,
                (
                    report_date,
                    strategy_version,
                    market,
                    int(data.get("total", 0)),
                    int(data.get("aligned", 0)),
                    float(data.get("consistency_rate_pct", 0.0)),
                    float(state_cov.get("NoSetup", 0.0)),
                    float(state_cov.get("Watch", 0.0)),
                    float(state_cov.get("TriggeredLong", 0.0)),
                    float(state_cov.get("RiskOff", 0.0)),
                    1 if bool(data.get("pass_995", False)) else 0,
                    report_json,
                    generated_at,
                ),
            )

        conn.commit()
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate daily Layer-1 consistency report.")
    parser.add_argument("--date", default="", help="Target date YYYY-MM-DD. Default latest date.")
    parser.add_argument("--strategy-version", default=DEFAULT_STRATEGY_VERSION, help="Layer1 strategy version filter.")
    parser.add_argument("--output-json", default="", help="Output JSON path.")
    parser.add_argument("--output-md", default="", help="Output Markdown path.")
    parser.add_argument("--persist", action="store_true", help="Persist report into layer1_daily_reports table.")
    parser.add_argument("--notify", action="store_true", help="Send report to webhook (WeCom).")
    args = parser.parse_args()

    conn = get_connection()
    try:
        cur = conn.cursor()
        target_date = resolve_date(cur, args.date.strip() or None)
    finally:
        conn.close()

    report = collect_metrics(target_date, strategy_version=args.strategy_version)
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

    if args.persist:
        persist_report(report)
        logger.info(
            f"Persisted layer1_daily_reports for date={report['date']} strategy={report.get('strategy_version')}"
        )

    if args.notify:
        o = report["overall"]
        cov = o.get("state_coverage_pct", {})
        content = (
            f"## Layer-1 Consistency Daily ({report['date']})\n"
            f"- Strategy: **{report.get('strategy_version', DEFAULT_STRATEGY_VERSION)}**\n"
            f"- Total: **{o['total']}**\n"
            f"- Aligned: **{o['aligned']}**\n"
            f"- Consistency: **{o['consistency_rate_pct']:.2f}%**\n"
            f"- State coverage: TriggeredLong **{cov.get('TriggeredLong', 0):.2f}%**, "
            f"Watch **{cov.get('Watch', 0):.2f}%**, RiskOff **{cov.get('RiskOff', 0):.2f}%**, "
            f"NoSetup **{cov.get('NoSetup', 0):.2f}%**\n"
            f"- Gate(>=99.5%): **{'PASS' if o['pass_995'] else 'FAIL'}**"
        )
        send_wecom_notification(content)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
