"""
Weekly acceptance snapshot for two-layer architecture.

Current computable panel:
- Layer-1 direction consistency
- State distribution
- TriggeredLong coverage
- RiskOff coverage
- Watch->TriggeredLong conversion
- Drawdown control (from latest weekly calibration artifact when available)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from utils import send_wecom_notification
from engine.layer1_state import DEFAULT_STRATEGY_VERSION

DEFAULT_CALIBRATION_DIR = os.path.join(os.path.dirname(backend_path), "tmp", "tradeability_calibration")


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


def _load_drawdown_snapshot(market: str, strategy_version: str, calibration_dir: str) -> Optional[Dict[str, float]]:
    artifact = os.path.join(calibration_dir, f"{market.lower()}_weekly_calibration.json")
    if not os.path.exists(artifact):
        return None
    with open(artifact, "r", encoding="utf-8") as f:
        payload = json.load(f)
    for version in payload.get("versions", []):
        if version.get("strategy_version") == strategy_version:
            obs = version.get("observability") or {}
            return {
                "max_drawdown_pct": float(obs.get("max_drawdown_pct", 0.0)),
                "drawdown_controlled": float(obs.get("max_drawdown_pct", 0.0)) <= 80.0,
            }
    return None


def collect(end_date: str, strategy_version: str, market: str, calibration_dir: str) -> Dict[str, Any]:
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    start_dt = end_dt - timedelta(days=6)
    start_date = start_dt.strftime("%Y-%m-%d")

    conn = get_connection()
    try:
        cur = conn.cursor()

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
              AND layer1_strategy_version = ?
            """,
            (start_date, end_date, strategy_version),
        )
        total = int((row[0] if not isinstance(row, dict) else row["total"]) or 0)
        aligned = int((row[1] if not isinstance(row, dict) else row["aligned"]) or 0)
        consistency = (aligned / total * 100.0) if total else 0.0

        row = _fetchone(
            cur,
            """
            SELECT
              COUNT(*) AS total_states,
              SUM(CASE WHEN setup_state='NoSetup' THEN 1 ELSE 0 END) AS nosetup_count,
              SUM(CASE WHEN setup_state='Watch' THEN 1 ELSE 0 END) AS watch_count,
              SUM(CASE WHEN setup_state='TriggeredLong' THEN 1 ELSE 0 END) AS triggered_count,
              SUM(CASE WHEN setup_state='RiskOff' THEN 1 ELSE 0 END) AS riskoff_count
            FROM quant_tradeability_signals
            WHERE date BETWEEN ? AND ?
              AND market = ?
              AND strategy_version = ?
            """,
            (start_date, end_date, market, strategy_version),
        )
        state_total = int((row[0] if not isinstance(row, dict) else row["total_states"]) or 0)
        nosetup = int((row[1] if not isinstance(row, dict) else row["nosetup_count"]) or 0)
        watch = int((row[2] if not isinstance(row, dict) else row["watch_count"]) or 0)
        triggered = int((row[3] if not isinstance(row, dict) else row["triggered_count"]) or 0)
        riskoff = int((row[4] if not isinstance(row, dict) else row["riskoff_count"]) or 0)
        triggered_cov = (triggered / state_total * 100.0) if state_total else 0.0
        riskoff_cov = (riskoff / state_total * 100.0) if state_total else 0.0

        row = _fetchone(
            cur,
            """
            WITH w AS (
              SELECT symbol, date
              FROM quant_tradeability_signals
              WHERE setup_state='Watch'
                AND date BETWEEN ? AND ?
                AND market = ?
                AND strategy_version = ?
            ),
            wt AS (
              SELECT COUNT(*) AS c
              FROM w
              JOIN quant_tradeability_signals t
                ON t.symbol = w.symbol
               AND t.setup_state='TriggeredLong'
               AND t.market = ?
               AND t.strategy_version = ?
               AND julianday(t.date) - julianday(w.date) = 1
            )
            SELECT
              (SELECT COUNT(*) FROM w) AS watch_count,
              (SELECT c FROM wt) AS converted
            """,
            (start_date, end_date, market, strategy_version, market, strategy_version),
        )
        watch_count = int((row[0] if not isinstance(row, dict) else row["watch_count"]) or 0)
        converted = int((row[1] if not isinstance(row, dict) else row["converted"]) or 0)
        watch_to_trigger = (converted / watch_count * 100.0) if watch_count else 0.0
    finally:
        conn.close()

    drawdown = _load_drawdown_snapshot(market=market, strategy_version=strategy_version, calibration_dir=calibration_dir)
    state_distribution_pct = {
        "NoSetup": round((nosetup / state_total * 100.0), 2) if state_total else 0.0,
        "Watch": round((watch / state_total * 100.0), 2) if state_total else 0.0,
        "TriggeredLong": round(triggered_cov, 2),
        "RiskOff": round(riskoff_cov, 2),
    }
    gates = {
        "consistency_gate": consistency >= 99.5,
        "triggered_coverage_gate": 5.0 <= triggered_cov <= 20.0,
        "watch_to_trigger_gate": 15.0 <= watch_to_trigger <= 40.0,
        "drawdown_control_gate": None if drawdown is None else bool(drawdown["drawdown_controlled"]),
    }
    level1_pass = all(v for v in gates.values() if v is not None)

    return {
        "window": {"start_date": start_date, "end_date": end_date},
        "market": market,
        "strategy_version": strategy_version,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "metrics": {
            "consistency_rate_pct": round(consistency, 2),
            "consistency_total": total,
            "consistency_aligned": aligned,
            "triggered_coverage_pct": round(triggered_cov, 2),
            "riskoff_coverage_pct": round(riskoff_cov, 2),
            "state_total": state_total,
            "watch_to_trigger_pct": round(watch_to_trigger, 2),
            "watch_count": watch_count,
            "converted_count": converted,
            "state_distribution_pct": state_distribution_pct,
            "drawdown_control": drawdown,
        },
        "gates": gates,
        "level1_pass": level1_pass,
    }


def to_markdown(report: Dict[str, Any]) -> str:
    w = report["window"]
    m = report["metrics"]
    g = report["gates"]
    drawdown = m["drawdown_control"]
    lines = []
    lines.append(f"# Weekly Acceptance Snapshot ({w['start_date']} ~ {w['end_date']})")
    lines.append("")
    lines.append(f"- Market: `{report['market']}`")
    lines.append(f"- Strategy: `{report['strategy_version']}`")
    lines.append(f"- Level-1 Gate: **{'PASS' if report['level1_pass'] else 'FAIL'}**")
    lines.append(f"- Direction consistency: **{m['consistency_rate_pct']:.2f}%** ({m['consistency_aligned']}/{m['consistency_total']})")
    lines.append(f"- Triggered coverage: **{m['triggered_coverage_pct']:.2f}%**")
    lines.append(f"- RiskOff coverage: **{m['riskoff_coverage_pct']:.2f}%**")
    lines.append(f"- Watch->Triggered: **{m['watch_to_trigger_pct']:.2f}%** ({m['converted_count']}/{m['watch_count']})")
    if drawdown is None:
        lines.append("- Drawdown control: **N/A** (weekly calibration artifact not found)")
    else:
        lines.append(
            f"- Drawdown control: **{'PASS' if drawdown['drawdown_controlled'] else 'FAIL'}** "
            f"(max_drawdown={drawdown['max_drawdown_pct']:.2f}%)"
        )
    lines.append(f"- State distribution: `{json.dumps(m['state_distribution_pct'], ensure_ascii=False)}`")
    lines.append("")
    lines.append("| Gate | Rule | Result |")
    lines.append("|---|---|---|")
    lines.append(f"| consistency_gate | >=99.5% | {'PASS' if g['consistency_gate'] else 'FAIL'} |")
    lines.append(f"| triggered_coverage_gate | 5%~20% | {'PASS' if g['triggered_coverage_gate'] else 'FAIL'} |")
    lines.append(f"| watch_to_trigger_gate | 15%~40% | {'PASS' if g['watch_to_trigger_gate'] else 'FAIL'} |")
    drawdown_result = "N/A" if g["drawdown_control_gate"] is None else ("PASS" if g["drawdown_control_gate"] else "FAIL")
    lines.append(f"| drawdown_control_gate | use latest weekly calibration | {drawdown_result} |")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate weekly acceptance snapshot.")
    parser.add_argument("--week-end", default="", help="Week end date YYYY-MM-DD. Default latest.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--strategy-version", default=DEFAULT_STRATEGY_VERSION)
    parser.add_argument("--calibration-dir", default=DEFAULT_CALIBRATION_DIR)
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

    report = collect(
        end_date=end_date,
        strategy_version=args.strategy_version,
        market=args.market,
        calibration_dir=args.calibration_dir,
    )
    markdown = to_markdown(report)

    if args.output_json:
        os.makedirs(os.path.dirname(args.output_json), exist_ok=True)
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
            f.write("\n")
    if args.output_md:
        os.makedirs(os.path.dirname(args.output_md), exist_ok=True)
        with open(args.output_md, "w", encoding="utf-8") as f:
            f.write(markdown + "\n")

    logger.info(markdown)

    if args.notify:
        m = report["metrics"]
        drawdown = m["drawdown_control"]
        drawdown_line = "N/A" if drawdown is None else f"{drawdown['max_drawdown_pct']:.2f}%"
        content = (
            f"## Weekly Acceptance Snapshot ({report['window']['start_date']}~{report['window']['end_date']})\n"
            f"- Strategy: **{report['strategy_version']}**\n"
            f"- Level-1: **{'PASS' if report['level1_pass'] else 'FAIL'}**\n"
            f"- Consistency: **{m['consistency_rate_pct']:.2f}%**\n"
            f"- Triggered coverage: **{m['triggered_coverage_pct']:.2f}%**\n"
            f"- RiskOff coverage: **{m['riskoff_coverage_pct']:.2f}%**\n"
            f"- Drawdown: **{drawdown_line}**"
        )
        send_wecom_notification(content)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
