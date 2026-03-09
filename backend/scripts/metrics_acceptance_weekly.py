"""
Weekly acceptance snapshot for two-layer architecture.

Current computable panel:
- Layer-1 direction consistency
- State distribution
- TriggeredLong coverage
- RiskOff coverage
- Watch->TriggeredLong conversion
- Drawdown control (from latest weekly calibration artifact when available)

Enhancements:
- Pull daily traceability history from layer1_daily_reports when available
- Include observability metrics with thresholds and anomaly definitions
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from utils import send_wecom_notification
from engine.layer1_state import DEFAULT_STRATEGY_VERSION

DEFAULT_CALIBRATION_DIR = os.path.join(os.path.dirname(backend_path), "tmp", "tradeability_calibration")

OBS_THRESHOLDS = {
    "api_latency_p95_ms": {"warn": 5000.0, "critical": 8000.0},
    "api_latency_min_samples_24h": 20,
    "confidence_low_ratio_7d": {"warn": 0.35, "critical": 0.50},
    "confidence_min_samples_7d": 50,
    "mode_pipeline_success_rate_14d": {"warn": 0.95, "critical": 0.90},
    "mode_pipeline_min_runs_14d": 3,
}

ANOMALY_DEFINITIONS = {
    "api_latency_p95_ms": "P95 latency exceeds threshold, indicating API degradation risk.",
    "confidence_low_ratio_7d": "Large share of low-confidence outputs (<0.6), indicating model confidence drift.",
    "mode_pipeline_success_rate_14d": "Mode pipeline success rate dropped, indicating production data pipeline instability.",
}


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


def _to_float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None:
            return default
        return float(v)
    except Exception:
        return default


def _to_int(v: Any, default: int = 0) -> int:
    try:
        if v is None:
            return default
        return int(v)
    except Exception:
        return default


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


def _read_daily_traceability(
    cur,
    start_date: str,
    end_date: str,
    strategy_version: str,
    market: str,
) -> Dict[str, Any]:
    try:
        cur.execute(
            """
            SELECT report_date, market, consistency_rate_pct, triggered_long_pct, watch_pct, risk_off_pct, no_setup_pct
            FROM layer1_daily_reports
            WHERE report_date BETWEEN ? AND ?
              AND strategy_version = ?
              AND market IN ('ALL', ?)
            ORDER BY report_date ASC, market ASC
            """,
            (start_date, end_date, strategy_version, market),
        )
        rows = cur.fetchall() or []
    except Exception:
        return {"available": False, "rows": [], "summary": None}

    norm_rows = []
    for r in rows:
        row = dict(r) if isinstance(r, dict) else {
            "report_date": r[0],
            "market": r[1],
            "consistency_rate_pct": r[2],
            "triggered_long_pct": r[3],
            "watch_pct": r[4],
            "risk_off_pct": r[5],
            "no_setup_pct": r[6],
        }
        norm_rows.append(
            {
                "date": str(row["report_date"]),
                "market": str(row["market"]),
                "consistency_rate_pct": round(_to_float(row["consistency_rate_pct"]), 2),
                "triggered_long_pct": round(_to_float(row["triggered_long_pct"]), 2),
                "watch_pct": round(_to_float(row["watch_pct"]), 2),
                "risk_off_pct": round(_to_float(row["risk_off_pct"]), 2),
                "no_setup_pct": round(_to_float(row["no_setup_pct"]), 2),
            }
        )

    market_rows = [x for x in norm_rows if x["market"] == market]
    if not market_rows:
        return {"available": False, "rows": norm_rows, "summary": None}

    n = len(market_rows)
    summary = {
        "days": n,
        "avg_consistency_rate_pct": round(sum(x["consistency_rate_pct"] for x in market_rows) / n, 2),
        "avg_triggered_long_pct": round(sum(x["triggered_long_pct"] for x in market_rows) / n, 2),
        "avg_watch_pct": round(sum(x["watch_pct"] for x in market_rows) / n, 2),
        "avg_risk_off_pct": round(sum(x["risk_off_pct"] for x in market_rows) / n, 2),
        "avg_no_setup_pct": round(sum(x["no_setup_pct"] for x in market_rows) / n, 2),
    }
    return {"available": True, "rows": norm_rows, "summary": summary}


def _metric_state_high_bad(value: float, warn: float, critical: float) -> str:
    if value >= critical:
        return "critical"
    if value >= warn:
        return "warn"
    return "ok"


def _metric_state_low_bad(value: float, warn: float, critical: float) -> str:
    if value <= critical:
        return "critical"
    if value <= warn:
        return "warn"
    return "ok"


def _collect_observability(cur, end_date: str, strategy_version: str) -> Dict[str, Any]:
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    start_24h = (end_dt - timedelta(days=1)).strftime("%Y-%m-%d")
    start_7d = (end_dt - timedelta(days=6)).strftime("%Y-%m-%d")
    start_14d = (end_dt - timedelta(days=13)).strftime("%Y-%m-%d")

    cur.execute(
        """
        SELECT latency_ms
        FROM llm_traces
        WHERE latency_ms > 0
          AND date(created_at) BETWEEN ? AND ?
        """,
        (start_24h, end_date),
    )
    lat_rows = cur.fetchall() or []
    latencies = []
    for r in lat_rows:
        v = r[0] if not isinstance(r, dict) else next(iter(r.values()))
        f = _to_float(v, 0.0)
        if f > 0:
            latencies.append(f)
    latencies.sort()
    p95 = latencies[int((len(latencies) - 1) * 0.95)] if latencies else 0.0

    cur.execute(
        """
        SELECT confidence
        FROM ai_predictions_v2
        WHERE is_primary = 1
          AND confidence IS NOT NULL
          AND date BETWEEN ? AND ?
          AND COALESCE(NULLIF(layer1_strategy_version, ''), 'tradeability_v2') = ?
        """,
        (start_7d, end_date, strategy_version),
    )
    conf_rows = cur.fetchall() or []
    conf_vals = []
    for r in conf_rows:
        v = r[0] if not isinstance(r, dict) else next(iter(r.values()))
        conf_vals.append(_to_float(v, 0.0))
    conf_low_ratio = (sum(1 for x in conf_vals if x < 0.6) / len(conf_vals)) if conf_vals else 0.0

    cur.execute(
        """
        SELECT
          COUNT(*) AS total_runs,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_runs
        FROM task_logs
        WHERE date BETWEEN ? AND ?
          AND (
            task_name LIKE '%Mode Pipeline%'
            OR task_name LIKE '%mode pipeline%'
            OR display_name LIKE '%Mode Pipeline%'
            OR display_name LIKE '%mode pipeline%'
            OR task_name = 'Investment Mode Pipeline'
            OR display_name = 'Investment Mode Pipeline'
          )
        """,
        (start_14d, end_date),
    )
    row = cur.fetchone()
    if isinstance(row, dict):
        total_runs = _to_int(row.get("total_runs"))
        success_runs = _to_int(row.get("success_runs"))
    else:
        total_runs = _to_int(row[0] if row else 0)
        success_runs = _to_int(row[1] if row else 0)
    mode_success_rate = (success_runs / total_runs) if total_runs else 0.0

    latency_state = _metric_state_high_bad(
        p95,
        OBS_THRESHOLDS["api_latency_p95_ms"]["warn"],
        OBS_THRESHOLDS["api_latency_p95_ms"]["critical"],
    )
    conf_state = _metric_state_high_bad(
        conf_low_ratio,
        OBS_THRESHOLDS["confidence_low_ratio_7d"]["warn"],
        OBS_THRESHOLDS["confidence_low_ratio_7d"]["critical"],
    )
    mode_state = _metric_state_low_bad(
        mode_success_rate,
        OBS_THRESHOLDS["mode_pipeline_success_rate_14d"]["warn"],
        OBS_THRESHOLDS["mode_pipeline_success_rate_14d"]["critical"],
    )
    latency_state_final = "warn" if len(latencies) < OBS_THRESHOLDS["api_latency_min_samples_24h"] else latency_state
    conf_state_final = "warn" if len(conf_vals) < OBS_THRESHOLDS["confidence_min_samples_7d"] else conf_state
    mode_state_final = "warn" if total_runs < OBS_THRESHOLDS["mode_pipeline_min_runs_14d"] else mode_state

    states = [latency_state_final, conf_state_final, mode_state_final]
    overall = "critical" if "critical" in states else ("warn" if "warn" in states else "ok")

    alerts = []
    for key, state, value in [
        ("api_latency_p95_ms", latency_state_final, p95),
        ("confidence_low_ratio_7d", conf_state_final, conf_low_ratio),
        ("mode_pipeline_success_rate_14d", mode_state_final, mode_success_rate),
    ]:
        sample_guard = None
        if key == "api_latency_p95_ms":
            sample_guard = {"min_samples": OBS_THRESHOLDS["api_latency_min_samples_24h"], "samples": len(latencies)}
        elif key == "confidence_low_ratio_7d":
            sample_guard = {"min_samples": OBS_THRESHOLDS["confidence_min_samples_7d"], "samples": len(conf_vals)}
        elif key == "mode_pipeline_success_rate_14d":
            sample_guard = {"min_samples": OBS_THRESHOLDS["mode_pipeline_min_runs_14d"], "samples": total_runs}
        alerts.append(
            {
                "metric": key,
                "state": state,
                "value": value,
                "definition": ANOMALY_DEFINITIONS[key],
                "threshold": OBS_THRESHOLDS[key],
                "sample_guard": sample_guard,
            }
        )

    return {
        "overall_state": overall,
        "window": {
            "latency": {"start": start_24h, "end": end_date},
            "confidence": {"start": start_7d, "end": end_date},
            "mode_pipeline": {"start": start_14d, "end": end_date},
        },
        "metrics": {
            "api_latency_p95_ms": round(p95, 2),
            "api_latency_samples": len(latencies),
            "confidence_low_ratio_7d": round(conf_low_ratio, 4),
            "confidence_samples_7d": len(conf_vals),
            "mode_pipeline_success_rate_14d": round(mode_success_rate, 4),
            "mode_pipeline_total_runs_14d": total_runs,
            "mode_pipeline_success_runs_14d": success_runs,
        },
        "thresholds": OBS_THRESHOLDS,
        "anomaly_definitions": ANOMALY_DEFINITIONS,
        "alerts": alerts,
    }


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
              AND COALESCE(NULLIF(layer1_strategy_version, ''), 'tradeability_v2') = ?
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

        daily_trace = _read_daily_traceability(
            cur,
            start_date=start_date,
            end_date=end_date,
            strategy_version=strategy_version,
            market=market,
        )

        observability = _collect_observability(cur, end_date=end_date, strategy_version=strategy_version)
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
        "observability_gate": observability.get("overall_state") == "ok",
    }
    level1_pass = all(v for k, v in gates.items() if k != "observability_gate" and v is not None)

    return {
        "window": {"start_date": start_date, "end_date": end_date},
        "market": market,
        "strategy_version": strategy_version,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
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
        "daily_traceability": daily_trace,
        "observability": observability,
        "gates": gates,
        "level1_pass": level1_pass,
    }


def to_markdown(report: Dict[str, Any]) -> str:
    w = report["window"]
    m = report["metrics"]
    g = report["gates"]
    drawdown = m["drawdown_control"]
    obs = report.get("observability") or {}
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

    lines.append("## Daily Traceability")
    trace = report.get("daily_traceability") or {}
    if not trace.get("available"):
        lines.append("- Daily persistence rows: **N/A** (layer1_daily_reports missing or no rows for this window)")
    else:
        s = trace.get("summary") or {}
        lines.append(f"- Days with persisted rows: **{s.get('days', 0)}**")
        lines.append(f"- Avg consistency (from daily rows): **{s.get('avg_consistency_rate_pct', 0):.2f}%**")
        lines.append(f"- Avg TriggeredLong (from daily rows): **{s.get('avg_triggered_long_pct', 0):.2f}%**")
    lines.append("")

    lines.append("## Observability (R2)")
    lines.append(f"- Overall state: **{obs.get('overall_state', 'unknown').upper()}**")
    om = obs.get("metrics") or {}
    lines.append(f"- API latency P95: **{om.get('api_latency_p95_ms', 0):.2f}ms** (samples={om.get('api_latency_samples', 0)})")
    lines.append(f"- Low-confidence ratio(7d): **{(om.get('confidence_low_ratio_7d', 0.0) * 100.0):.2f}%** (samples={om.get('confidence_samples_7d', 0)})")
    lines.append(f"- Mode pipeline success(14d): **{(om.get('mode_pipeline_success_rate_14d', 0.0) * 100.0):.2f}%** ({om.get('mode_pipeline_success_runs_14d', 0)}/{om.get('mode_pipeline_total_runs_14d', 0)})")
    lines.append("")
    lines.append("| observability_metric | state | value | threshold | sample_guard |")
    lines.append("|---|---|---:|---|---|")
    for a in (obs.get("alerts") or []):
        thr = a.get("threshold") or {}
        sg = a.get("sample_guard") or {}
        lines.append(f"| {a.get('metric')} | {a.get('state')} | {a.get('value')} | {json.dumps(thr)} | {json.dumps(sg)} |")
    lines.append("")

    lines.append("| Gate | Rule | Result |")
    lines.append("|---|---|---|")
    lines.append(f"| consistency_gate | >=99.5% | {'PASS' if g['consistency_gate'] else 'FAIL'} |")
    lines.append(f"| triggered_coverage_gate | 5%~20% | {'PASS' if g['triggered_coverage_gate'] else 'FAIL'} |")
    lines.append(f"| watch_to_trigger_gate | 15%~40% | {'PASS' if g['watch_to_trigger_gate'] else 'FAIL'} |")
    drawdown_result = "N/A" if g["drawdown_control_gate"] is None else ("PASS" if g["drawdown_control_gate"] else "FAIL")
    lines.append(f"| drawdown_control_gate | use latest weekly calibration | {drawdown_result} |")
    lines.append(f"| observability_gate | overall_state == ok | {'PASS' if g['observability_gate'] else 'FAIL'} |")
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
        obs = report.get("observability") or {}
        content = (
            f"## Weekly Acceptance Snapshot ({report['window']['start_date']}~{report['window']['end_date']})\n"
            f"- Strategy: **{report['strategy_version']}**\n"
            f"- Level-1: **{'PASS' if report['level1_pass'] else 'FAIL'}**\n"
            f"- Consistency: **{m['consistency_rate_pct']:.2f}%**\n"
            f"- Triggered coverage: **{m['triggered_coverage_pct']:.2f}%**\n"
            f"- RiskOff coverage: **{m['riskoff_coverage_pct']:.2f}%**\n"
            f"- Drawdown: **{drawdown_line}**\n"
            f"- Observability: **{str(obs.get('overall_state', 'unknown')).upper()}**"
        )
        send_wecom_notification(content)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
