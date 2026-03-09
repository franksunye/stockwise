"""
Tradeability promotion verdict generator.

Purpose:
1) Turn weekly acceptance from a report into a promotion decision artifact.
2) Evaluate rolling 2~4 week windows for candidate vs baseline versions.
3) Emit a single go / no-go verdict for promotion review.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from logger import logger
DEFAULT_EXPERIMENT_DIR = os.path.join(os.path.dirname(backend_path), "tmp", "tradeability_experiments")
DEFAULT_CALIBRATION_DIR = os.path.join(os.path.dirname(backend_path), "tmp", "tradeability_calibration")
PRODUCT_EFFECT_DEFAULT_MODE = "balanced_v1"
PRODUCT_EFFECT_DEFAULT_HORIZON = "30d"
PRODUCT_EFFECT_MAX_STALENESS_DAYS = 7
CORE_PRODUCT_EFFECT_MODES = ("steady_v1", "balanced_v1", "aggressive_v1")
OBSERVE_ONLY_MODE = "observe_only_v1"
PRODUCT_EFFECT_THRESHOLDS = {
    "sample_size_min": 20,
    "hit_rate_min": 0.50,
    "max_drawdown_floor": -0.12,
    "payoff_ratio_min": 0.90,
    "stability_score_min": 0.35,
}


def _get_connection():
    try:
        from database import get_connection as get_db_connection  # type: ignore
        return get_db_connection()
    except ModuleNotFoundError as exc:
        if exc.name != "libsql":
            raise
        return sqlite3.connect(os.environ.get("DB_PATH") or ":memory:")


def _send_wecom_notification(content: str) -> None:
    from utils import send_wecom_notification  # type: ignore
    send_wecom_notification(content)


def _collect_acceptance(*, end_date: str, strategy_version: str, market: str, calibration_dir: str) -> Dict[str, Any]:
    from scripts.metrics_acceptance_weekly import collect as collect_acceptance  # type: ignore
    return collect_acceptance(
        end_date=end_date,
        strategy_version=strategy_version,
        market=market,
        calibration_dir=calibration_dir,
    )


def _resolve_week_end(week_end: Optional[str]) -> str:
    if week_end:
        return week_end
    conn = _get_connection()
    try:
        cur = conn.cursor()
        row = cur.execute("SELECT MAX(date) FROM ai_predictions_v2").fetchone()
        value = row[0] if row and not isinstance(row, dict) else (row.get("MAX(date)") if row else None)
        if not value:
            raise RuntimeError("No latest date found in ai_predictions_v2.")
        return str(value)
    finally:
        conn.close()


def _load_latest_experiment(market: str, experiment_dir: str) -> Optional[Dict[str, Any]]:
    path = os.path.join(experiment_dir, f"{market.lower()}_strategy_experiment.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _find_experiment_result(payload: Optional[Dict[str, Any]], strategy_version: str) -> Optional[Dict[str, Any]]:
    if not payload:
      return None
    for item in payload.get("results", []):
        if item.get("strategy_version") == strategy_version:
            return item
    return None


def _load_mode_effect(
    market: str,
    end_date: str,
    *,
    mode_id: str = PRODUCT_EFFECT_DEFAULT_MODE,
    horizon: str = PRODUCT_EFFECT_DEFAULT_HORIZON,
) -> Optional[Dict[str, Any]]:
    conn = _get_connection()
    try:
        cur = conn.cursor()
        row = cur.execute(
            """
            SELECT mode_id, horizon, hit_rate, max_drawdown, sample_size, payoff_ratio, stability_score, as_of_date
            FROM mode_performance_snapshot
            WHERE scope = 'universal'
              AND mode_id = ?
              AND horizon = ?
              AND as_of_date <= ?
            ORDER BY as_of_date DESC
            LIMIT 1
            """,
            (mode_id, horizon, end_date),
        ).fetchone()
        if not row:
            return None
        if isinstance(row, dict):
            raw = row
        else:
            raw = {
                "mode_id": row[0],
                "horizon": row[1],
                "hit_rate": row[2],
                "max_drawdown": row[3],
                "sample_size": row[4],
                "payoff_ratio": row[5],
                "stability_score": row[6],
                "as_of_date": row[7],
            }
        return {
            "market": market,
            "mode_id": str(raw["mode_id"]),
            "horizon": str(raw["horizon"]),
            "hit_rate": float(raw["hit_rate"] or 0.0),
            "max_drawdown": float(raw["max_drawdown"] or 0.0),
            "sample_size": int(raw["sample_size"] or 0),
            "payoff_ratio": None if raw["payoff_ratio"] is None else float(raw["payoff_ratio"]),
            "stability_score": None if raw["stability_score"] is None else float(raw["stability_score"]),
            "as_of_date": str(raw["as_of_date"]),
        }
    finally:
        conn.close()


def _mode_effect_gates(mode_effect: Optional[Dict[str, Any]], end_date: str) -> Tuple[Dict[str, Optional[bool]], List[str]]:
    if not mode_effect:
        return (
            {
                "mode_effect_present": False,
                "mode_effect_fresh": False,
                "mode_sample_size_ok": False,
                "mode_hit_rate_ok": False,
                "mode_drawdown_ok": False,
                "mode_payoff_ok": False,
                "mode_stability_ok": False,
            },
            ["latest product effect snapshot missing"],
        )

    freshness_days = (datetime.strptime(end_date, "%Y-%m-%d") - datetime.strptime(mode_effect["as_of_date"], "%Y-%m-%d")).days
    gates: Dict[str, Optional[bool]] = {
        "mode_effect_present": True,
        "mode_effect_fresh": freshness_days <= PRODUCT_EFFECT_MAX_STALENESS_DAYS,
        "mode_sample_size_ok": int(mode_effect["sample_size"]) >= PRODUCT_EFFECT_THRESHOLDS["sample_size_min"],
        "mode_hit_rate_ok": float(mode_effect["hit_rate"]) >= PRODUCT_EFFECT_THRESHOLDS["hit_rate_min"],
        "mode_drawdown_ok": float(mode_effect["max_drawdown"]) >= PRODUCT_EFFECT_THRESHOLDS["max_drawdown_floor"],
        "mode_payoff_ok": (
            None
            if mode_effect["payoff_ratio"] is None
            else float(mode_effect["payoff_ratio"]) >= PRODUCT_EFFECT_THRESHOLDS["payoff_ratio_min"]
        ),
        "mode_stability_ok": (
            None
            if mode_effect["stability_score"] is None
            else float(mode_effect["stability_score"]) >= PRODUCT_EFFECT_THRESHOLDS["stability_score_min"]
        ),
    }
    reasons: List[str] = []
    if gates["mode_effect_fresh"] is False:
        reasons.append(
            f"product effect snapshot stale by {freshness_days}d (max {PRODUCT_EFFECT_MAX_STALENESS_DAYS}d)"
        )
    if gates["mode_sample_size_ok"] is False:
        reasons.append(
            f"product effect sample_size {mode_effect['sample_size']} is below {PRODUCT_EFFECT_THRESHOLDS['sample_size_min']}"
        )
    if gates["mode_hit_rate_ok"] is False:
        reasons.append(
            f"product effect hit_rate {mode_effect['hit_rate']:.3f} is below {PRODUCT_EFFECT_THRESHOLDS['hit_rate_min']:.2f}"
        )
    if gates["mode_drawdown_ok"] is False:
        reasons.append(
            f"product effect max_drawdown {mode_effect['max_drawdown']:.3f} is worse than {PRODUCT_EFFECT_THRESHOLDS['max_drawdown_floor']:.2f}"
        )
    if gates["mode_payoff_ok"] is False:
        reasons.append(
            f"product effect payoff_ratio {mode_effect['payoff_ratio']:.3f} is below {PRODUCT_EFFECT_THRESHOLDS['payoff_ratio_min']:.2f}"
        )
    if gates["mode_stability_ok"] is False:
        reasons.append(
            f"product effect stability_score {mode_effect['stability_score']:.3f} is below {PRODUCT_EFFECT_THRESHOLDS['stability_score_min']:.2f}"
        )
    return gates, reasons


def _load_core_mode_effects(
    market: str,
    end_date: str,
    *,
    horizon: str = PRODUCT_EFFECT_DEFAULT_HORIZON,
) -> Dict[str, Optional[Dict[str, Any]]]:
    return {
        mode_id: _load_mode_effect(market, end_date, mode_id=mode_id, horizon=horizon)
        for mode_id in CORE_PRODUCT_EFFECT_MODES
    }


def _build_core_mode_effect_summary(
    market: str,
    end_date: str,
    *,
    horizon: str = PRODUCT_EFFECT_DEFAULT_HORIZON,
) -> Tuple[Dict[str, Dict[str, Any]], bool, List[str]]:
    summary: Dict[str, Dict[str, Any]] = {}
    overall_pass = True
    blocking_reasons: List[str] = []

    for mode_id, mode_effect in _load_core_mode_effects(market, end_date, horizon=horizon).items():
        gates, reasons = _mode_effect_gates(mode_effect, end_date)
        mode_pass = all(value is not False for value in gates.values())
        summary[mode_id] = {
            "mode_id": mode_id,
            "is_core_mode": True,
            "is_default_mode": mode_id == PRODUCT_EFFECT_DEFAULT_MODE,
            "effect": mode_effect,
            "gates": gates,
            "gate_pass": mode_pass,
            "blocking_reasons": reasons,
        }
        if not mode_pass:
            overall_pass = False
            blocking_reasons.extend(f"{mode_id}: {reason}" for reason in reasons)

    summary[OBSERVE_ONLY_MODE] = {
        "mode_id": OBSERVE_ONLY_MODE,
        "is_core_mode": False,
        "is_default_mode": False,
        "excluded_from_promotion": True,
        "reason": "observe_only_mode_excluded_from_core_governance",
    }

    return summary, overall_pass, blocking_reasons


def _write_promotion_audit(
    *,
    event_type: str,
    market: str,
    candidate_version: str,
    baseline_version: str,
    outcome_status: str,
    summary: Dict[str, Any],
) -> None:
    conn = _get_connection()
    try:
        cur = conn.cursor()
        created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS promotion_audit_log (
                audit_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                market TEXT,
                candidate_version TEXT,
                baseline_version TEXT,
                outcome_status TEXT NOT NULL,
                source_verdict_path TEXT,
                execution_mode TEXT,
                actor TEXT,
                summary_json TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )
            """
        )
        cur.execute(
            """
            INSERT INTO promotion_audit_log
            (audit_id, event_type, market, candidate_version, baseline_version, outcome_status,
             source_verdict_path, execution_mode, actor, summary_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                event_type,
                market,
                candidate_version,
                baseline_version,
                outcome_status,
                str(summary.get("source_verdict_path") or ""),
                str(summary.get("execution_mode") or ""),
                str(summary.get("actor") or "system:metrics_tradeability_promotion"),
                json.dumps(summary, ensure_ascii=False),
                created_at,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def _comparative_gates(candidate: Dict[str, Any], baseline: Dict[str, Any]) -> Dict[str, Optional[bool]]:
    cm = candidate["metrics"]
    bm = baseline["metrics"]
    cg = {
        "coverage_not_worse": float(cm["triggered_coverage_pct"]) >= float(bm["triggered_coverage_pct"]),
        "riskoff_not_worse": float(cm["riskoff_coverage_pct"]) <= float(bm["riskoff_coverage_pct"]) + 2.0,
        "consistency_not_worse": float(cm["consistency_rate_pct"]) >= float(bm["consistency_rate_pct"]),
        "watch_to_trigger_not_looser": float(cm["watch_to_trigger_pct"]) <= float(bm["watch_to_trigger_pct"]) + 5.0,
        "drawdown_not_worse": None,
    }
    cdd = cm.get("drawdown_control") or {}
    bdd = bm.get("drawdown_control") or {}
    if cdd and bdd and cdd.get("max_drawdown_pct") is not None and bdd.get("max_drawdown_pct") is not None:
        cg["drawdown_not_worse"] = float(cdd["max_drawdown_pct"]) <= float(bdd["max_drawdown_pct"]) + 5.0
    return cg


def _weekly_pass(candidate: Dict[str, Any], comparative: Dict[str, Optional[bool]]) -> bool:
    if not candidate.get("level1_pass"):
        return False
    if (candidate.get("observability") or {}).get("overall_state") != "ok":
        return False
    for value in comparative.values():
        if value is False:
            return False
    return True


def _build_blocking_reasons(
    weekly_reports: List[Dict[str, Any]],
    min_pass_weeks: int,
    core_mode_effects: Optional[Dict[str, Dict[str, Any]]] = None,
    core_mode_reasons: Optional[List[str]] = None,
) -> List[str]:
    reasons: List[str] = []
    if not weekly_reports:
        return ["no weekly reports available"]

    latest = weekly_reports[0]
    candidate = latest["candidate"]
    baseline = latest["baseline"]
    comparative = latest["comparative_gates"]
    gates = candidate["gates"]

    if not candidate.get("level1_pass"):
        failed = [name for name, value in gates.items() if value is False]
        if failed:
            reasons.append(f"latest weekly acceptance failed: {', '.join(failed)}")
    if (candidate.get("observability") or {}).get("overall_state") != "ok":
        reasons.append("latest observability gate is not ok")
    failed_compare = [name for name, value in comparative.items() if value is False]
    if failed_compare:
        reasons.append(f"candidate underperforms baseline on: {', '.join(failed_compare)}")

    streak = 0
    for report in weekly_reports:
        if report["weekly_pass"]:
            streak += 1
        else:
            break
    if streak < min_pass_weeks:
        reasons.append(f"pass streak {streak}w is below required {min_pass_weeks}w")

    if float(candidate["metrics"]["triggered_coverage_pct"]) <= 0.0:
        reasons.append("candidate has zero triggered coverage in latest window")
    if float(baseline["metrics"]["triggered_coverage_pct"]) <= 0.0:
        reasons.append("baseline coverage data missing in latest window")

    if core_mode_effects:
        failed_modes = [
            mode_id
            for mode_id, payload in core_mode_effects.items()
            if payload.get("is_core_mode") and payload.get("gate_pass") is False
        ]
        if failed_modes:
            reasons.append(f"core mode product effect failed on: {', '.join(failed_modes)}")
    if core_mode_reasons:
        reasons.extend(core_mode_reasons)

    return reasons


def build_verdict(
    *,
    market: str,
    candidate_version: str,
    baseline_version: str,
    week_end: str,
    lookback_weeks: int,
    min_pass_weeks: int,
    calibration_dir: str,
    experiment_dir: str,
) -> Dict[str, Any]:
    end_dt = datetime.strptime(week_end, "%Y-%m-%d")
    weekly_reports: List[Dict[str, Any]] = []

    for index in range(lookback_weeks):
        current_end = (end_dt - timedelta(days=7 * index)).strftime("%Y-%m-%d")
        candidate = _collect_acceptance(
            end_date=current_end,
            strategy_version=candidate_version,
            market=market,
            calibration_dir=calibration_dir,
        )
        baseline = _collect_acceptance(
            end_date=current_end,
            strategy_version=baseline_version,
            market=market,
            calibration_dir=calibration_dir,
        )
        comparative = _comparative_gates(candidate, baseline)
        weekly_reports.append(
            {
                "week_end": current_end,
                "candidate": candidate,
                "baseline": baseline,
                "comparative_gates": comparative,
                "weekly_pass": _weekly_pass(candidate, comparative),
            }
        )

    pass_streak_weeks = 0
    for report in weekly_reports:
        if report["weekly_pass"]:
            pass_streak_weeks += 1
        else:
            break

    experiment_payload = _load_latest_experiment(market, experiment_dir)
    core_mode_effects, core_mode_gate_pass, core_mode_reasons = _build_core_mode_effect_summary(market, week_end)
    default_mode_effect = core_mode_effects.get(PRODUCT_EFFECT_DEFAULT_MODE, {}).get("effect")
    default_mode_gates = core_mode_effects.get(PRODUCT_EFFECT_DEFAULT_MODE, {}).get("gates", {})
    promotion_gate_pass = (
        pass_streak_weeks >= min_pass_weeks
        and all(r["weekly_pass"] for r in weekly_reports[:min_pass_weeks])
        and core_mode_gate_pass
    )
    blocking_reasons = _build_blocking_reasons(
        weekly_reports,
        min_pass_weeks,
        core_mode_effects=core_mode_effects,
        core_mode_reasons=core_mode_reasons,
    )

    verdict = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "market": market,
        "candidate_version": candidate_version,
        "baseline_version": baseline_version,
        "window": {
            "latest_week_end": week_end,
            "lookback_weeks": lookback_weeks,
            "min_pass_weeks": min_pass_weeks,
        },
        "promotion_gate_pass": promotion_gate_pass,
        "pass_streak_weeks": pass_streak_weeks,
        "recommended_action": "promote_candidate" if promotion_gate_pass else "hold_and_observe",
        "blocking_reasons": [] if promotion_gate_pass else blocking_reasons,
        "latest_experiment": {
            "window": experiment_payload.get("window") if experiment_payload else None,
            "candidate": _find_experiment_result(experiment_payload, candidate_version),
            "baseline": _find_experiment_result(experiment_payload, baseline_version),
        },
        "default_mode_id": PRODUCT_EFFECT_DEFAULT_MODE,
        "latest_mode_effect": default_mode_effect,
        "latest_mode_effect_gates": default_mode_gates,
        "core_mode_effects": core_mode_effects,
        "core_mode_gate_pass": core_mode_gate_pass,
        "product_effect_thresholds": PRODUCT_EFFECT_THRESHOLDS,
        "weekly_reports": weekly_reports,
    }
    return verdict


def to_markdown(verdict: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append(f"# Tradeability Promotion Verdict ({verdict['market']})")
    lines.append("")
    lines.append(f"- Candidate: `{verdict['candidate_version']}`")
    lines.append(f"- Baseline: `{verdict['baseline_version']}`")
    lines.append(f"- Latest week end: `{verdict['window']['latest_week_end']}`")
    lines.append(f"- Lookback weeks: **{verdict['window']['lookback_weeks']}**")
    lines.append(f"- Pass streak: **{verdict['pass_streak_weeks']}w**")
    lines.append(f"- Promotion Gate: **{'PASS' if verdict['promotion_gate_pass'] else 'FAIL'}**")
    lines.append(f"- Recommended Action: **{verdict['recommended_action']}**")
    lines.append("")

    if verdict["blocking_reasons"]:
        lines.append("## Blocking Reasons")
        for reason in verdict["blocking_reasons"]:
            lines.append(f"- {reason}")
        lines.append("")

    lines.append("## Rolling Weekly Verdict")
    lines.append("")
    lines.append("| week_end | candidate_gate | observability | coverage | riskoff | watch->trigger | baseline_coverage | weekly_pass |")
    lines.append("|---|---|---|---:|---:|---:|---:|---|")
    for item in verdict["weekly_reports"]:
        c = item["candidate"]
        b = item["baseline"]
        cm = c["metrics"]
        bm = b["metrics"]
        obs = (c.get("observability") or {}).get("overall_state", "unknown")
        lines.append(
            f"| {item['week_end']} | {'PASS' if c['level1_pass'] else 'FAIL'} | {str(obs).upper()} | "
            f"{cm['triggered_coverage_pct']:.2f}% | {cm['riskoff_coverage_pct']:.2f}% | {cm['watch_to_trigger_pct']:.2f}% | "
            f"{bm['triggered_coverage_pct']:.2f}% | {'PASS' if item['weekly_pass'] else 'FAIL'} |"
        )
    lines.append("")

    exp = verdict.get("latest_experiment") or {}
    if exp.get("candidate") and exp.get("baseline"):
        lines.append("## Latest Experiment Snapshot")
        lines.append("")
        lines.append(f"- Experiment window: `{exp.get('window', {}).get('start_date')}` ~ `{exp.get('window', {}).get('end_date')}`")
        for label, item in [("Candidate", exp["candidate"]), ("Baseline", exp["baseline"])]:
            obs = item.get("observability") or {}
            lines.append(
                f"- {label} `{item['strategy_version']}`: "
                f"triggered={obs.get('triggered_coverage_pct', 0):.2f}% / "
                f"riskoff={obs.get('risk_off_coverage_pct', 0):.2f}% / "
                f"max_dd={obs.get('max_drawdown_pct', 0):.2f}% / "
                f"payoff={obs.get('payoff', 0):.4f}"
            )
        lines.append("")

    mode_effect = verdict.get("latest_mode_effect")
    if mode_effect:
        lines.append("## Default Mode Product Effect Snapshot")
        lines.append("")
        lines.append(
            f"- Mode `{mode_effect['mode_id']}` {mode_effect['horizon']} as of `{mode_effect['as_of_date']}`: "
            f"hit_rate={mode_effect['hit_rate']:.2f}, max_drawdown={mode_effect['max_drawdown']:.2f}, "
            f"sample_size={mode_effect['sample_size']}, payoff_ratio={mode_effect['payoff_ratio']}, "
            f"stability_score={mode_effect['stability_score']}"
        )
        lines.append("")
        gates = verdict.get("latest_mode_effect_gates") or {}
        if gates:
            lines.append("## Default Mode Product Effect Gates")
            lines.append("")
            for key, value in gates.items():
                lines.append(f"- `{key}`: **{value}**")
            lines.append("")

    core_mode_effects = verdict.get("core_mode_effects") or {}
    if core_mode_effects:
        lines.append("## Core Mode Governance")
        lines.append("")
        lines.append("| mode_id | role | gate_pass | as_of_date | hit_rate | max_drawdown | sample_size |")
        lines.append("|---|---|---|---|---:|---:|---:|")
        for mode_id in CORE_PRODUCT_EFFECT_MODES:
            payload = core_mode_effects.get(mode_id) or {}
            effect = payload.get("effect") or {}
            role = "default" if payload.get("is_default_mode") else "core"
            lines.append(
                f"| {mode_id} | {role} | {'PASS' if payload.get('gate_pass') else 'FAIL'} | "
                f"{effect.get('as_of_date', '--')} | "
                f"{float(effect.get('hit_rate') or 0.0):.2f} | "
                f"{float(effect.get('max_drawdown') or 0.0):.2f} | "
                f"{int(effect.get('sample_size') or 0)} |"
            )
        lines.append("")
        observe = core_mode_effects.get(OBSERVE_ONLY_MODE) or {}
        if observe:
            lines.append(
                f"- `{OBSERVE_ONLY_MODE}` excluded from core governance: "
                f"{observe.get('reason', 'observe_only_mode_excluded')}"
            )

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate tradeability promotion verdict.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--candidate-version", default="tradeability_v2")
    parser.add_argument("--baseline-version", default="tradeability_v1")
    parser.add_argument("--week-end", default="", help="Week end date YYYY-MM-DD. Default latest.")
    parser.add_argument("--lookback-weeks", type=int, default=4)
    parser.add_argument("--min-pass-weeks", type=int, default=2)
    parser.add_argument("--calibration-dir", default=DEFAULT_CALIBRATION_DIR)
    parser.add_argument("--experiment-dir", default=DEFAULT_EXPERIMENT_DIR)
    parser.add_argument("--output-json", default="", help="Output JSON path.")
    parser.add_argument("--output-md", default="", help="Output Markdown path.")
    parser.add_argument("--notify", action="store_true", help="Send summary to webhook.")
    args = parser.parse_args()

    week_end = _resolve_week_end(args.week_end.strip() or None)
    verdict = build_verdict(
        market=args.market,
        candidate_version=args.candidate_version,
        baseline_version=args.baseline_version,
        week_end=week_end,
        lookback_weeks=max(2, args.lookback_weeks),
        min_pass_weeks=max(1, min(args.min_pass_weeks, max(2, args.lookback_weeks))),
        calibration_dir=args.calibration_dir,
        experiment_dir=args.experiment_dir,
    )
    markdown = to_markdown(verdict)

    if args.output_json:
        os.makedirs(os.path.dirname(args.output_json), exist_ok=True)
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(verdict, f, ensure_ascii=False, indent=2)
            f.write("\n")
    if args.output_md:
        os.makedirs(os.path.dirname(args.output_md), exist_ok=True)
        with open(args.output_md, "w", encoding="utf-8") as f:
            f.write(markdown + "\n")

    logger.info(markdown)
    _write_promotion_audit(
        event_type="verdict",
        market=verdict["market"],
        candidate_version=verdict["candidate_version"],
        baseline_version=verdict["baseline_version"],
        outcome_status="pass" if verdict["promotion_gate_pass"] else "fail",
        summary={
            "promotion_gate_pass": verdict["promotion_gate_pass"],
            "pass_streak_weeks": verdict["pass_streak_weeks"],
            "recommended_action": verdict["recommended_action"],
            "blocking_reasons": verdict["blocking_reasons"],
            "latest_week_end": verdict["window"]["latest_week_end"],
            "lookback_weeks": verdict["window"]["lookback_weeks"],
            "min_pass_weeks": verdict["window"]["min_pass_weeks"],
            "latest_mode_effect": verdict.get("latest_mode_effect"),
            "latest_mode_effect_gates": verdict.get("latest_mode_effect_gates"),
            "core_mode_effects": verdict.get("core_mode_effects"),
            "core_mode_gate_pass": verdict.get("core_mode_gate_pass"),
            "default_mode_id": verdict.get("default_mode_id"),
            "execution_mode": "verdict_only",
            "actor": "system:metrics_tradeability_promotion",
            "source_verdict_path": args.output_json,
        },
    )

    if args.notify:
        content = (
            f"## Tradeability Promotion Verdict ({verdict['market']})\n"
            f"- Candidate: **{verdict['candidate_version']}**\n"
            f"- Baseline: **{verdict['baseline_version']}**\n"
            f"- Gate: **{'PASS' if verdict['promotion_gate_pass'] else 'FAIL'}**\n"
            f"- Pass streak: **{verdict['pass_streak_weeks']}w**\n"
            f"- Action: **{verdict['recommended_action']}**"
        )
        if verdict["blocking_reasons"]:
            content += "\n- Blocking: " + "；".join(verdict["blocking_reasons"][:3])
        _send_wecom_notification(content)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
