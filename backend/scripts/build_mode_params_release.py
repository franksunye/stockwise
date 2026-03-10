"""
Build a promotable mode-params release artifact from local backtest candidates.

Purpose:
1) Evaluate candidate params for steady / balanced / aggressive modes on one historical window.
2) Pick the best candidate per mode using mode-specific objectives.
3) Emit a release artifact that can be applied by promote_mode_params_release.py.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from scripts.run_tradeability_targeted_experiments import _pct  # type: ignore
from scripts.run_tradeability_weekly_calibration import load_bars_by_market  # type: ignore
from scripts.run_min_tradeability_loop import run_loop  # type: ignore

ROOT_DIR = os.path.dirname(os.path.dirname(backend_path))
DEFAULT_INPUT_CONFIG = os.path.join(backend_path, "strategy_config", "mode_params_bundles_v1.json")
DEFAULT_OUTPUT_DIR = os.path.join(ROOT_DIR, "tmp", "mode_backtest")
DEFAULT_OUTPUT_JSON = os.path.join(DEFAULT_OUTPUT_DIR, "best_release.json")
DEFAULT_OUTPUT_MD = os.path.join(DEFAULT_OUTPUT_DIR, "best_release.md")
CORE_MODES: Dict[str, str] = {
    "steady_v1": "steady",
    "balanced_v1": "balanced",
    "aggressive_v1": "aggressive",
}
OBJECTIVE_WEIGHTS: Dict[str, Dict[str, float]] = {
    "steady": {
        "expectancy": 80.0,
        "payoff": 18.0,
        "t3_win_rate": 22.0,
        "triggered_coverage": 18.0,
        "watch_to_trigger": 8.0,
        "risk_off_coverage": -12.0,
        "max_drawdown": -60.0,
        "trade_count": 0.04,
    },
    "balanced": {
        "expectancy": 120.0,
        "payoff": 20.0,
        "t3_win_rate": 28.0,
        "triggered_coverage": 32.0,
        "watch_to_trigger": 12.0,
        "risk_off_coverage": -12.0,
        "max_drawdown": -55.0,
        "trade_count": 0.03,
    },
    "aggressive": {
        "expectancy": 85.0,
        "payoff": 12.0,
        "t3_win_rate": 24.0,
        "triggered_coverage": 50.0,
        "watch_to_trigger": 14.0,
        "risk_off_coverage": -8.0,
        "max_drawdown": -40.0,
        "trade_count": 0.03,
    },
}


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _mode_label(mode_id: str) -> str:
    if mode_id == "steady_v1":
        return "稳健"
    if mode_id == "aggressive_v1":
        return "进取"
    return "平衡"


def _get_latest_mode_effect(mode_id: str, as_of_date: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        row = cur.execute(
            """
            SELECT mode_id, horizon, hit_rate, max_drawdown, sample_size, payoff_ratio, stability_score, as_of_date
            FROM mode_performance_snapshot
            WHERE scope = 'universal'
              AND mode_id = ?
              AND horizon = '30d'
              AND as_of_date <= ?
            ORDER BY as_of_date DESC
            LIMIT 1
            """,
            (mode_id, as_of_date),
        ).fetchone()
        if not row:
            return None
        return {
            "mode_id": str(row[0]),
            "horizon": str(row[1]),
            "hit_rate": float(row[2] or 0.0),
            "max_drawdown": float(row[3] or 0.0),
            "sample_size": int(row[4] or 0),
            "payoff_ratio": None if row[5] is None else float(row[5]),
            "stability_score": None if row[6] is None else float(row[6]),
            "as_of_date": str(row[7]),
        }
    except sqlite3.OperationalError:
        return None
    finally:
        conn.close()


def _normalize_metrics(result: Dict[str, Any]) -> Dict[str, Any]:
    trade = result["trade_metrics"]
    state = result["state_metrics"]
    forward = result["forward_metrics"]
    capital = result["capital_metrics"]
    return {
        "trade_count": int(trade["trade_count"]),
        "expectancy": round(float(trade["expectancy"]), 6),
        "payoff": round(float(trade["payoff"]), 6),
        "win_rate_pct": _pct(float(trade["win_rate"])),
        "max_drawdown_pct": _pct(float(capital["max_drawdown"])),
        "triggered_coverage_pct": _pct(float(state["trigger_coverage"])),
        "watch_coverage_pct": _pct(float(state["watch_coverage"])),
        "risk_off_coverage_pct": _pct(float(state.get("risk_off_coverage", 0.0))),
        "watch_to_trigger_pct": _pct(float(state["watch_to_trigger_ratio"])),
        "t3_win_rate_pct": _pct(float(forward["t3_win_rate"])),
        "sample_watch_days": int(state["watch_days"]),
        "sample_triggered_days": int(state["triggered_days"]),
        "sample_riskoff_days": int(state["risk_off_days"]),
    }


def _score_candidate(metrics: Dict[str, Any], objective: str, weights_override: Optional[Dict[str, float]] = None) -> float:
    weights = {**OBJECTIVE_WEIGHTS[objective], **(weights_override or {})}
    raw = {
        "expectancy": float(metrics["expectancy"]),
        "payoff": float(metrics["payoff"]),
        "t3_win_rate": float(metrics["t3_win_rate_pct"]) / 100.0,
        "triggered_coverage": float(metrics["triggered_coverage_pct"]) / 100.0,
        "watch_to_trigger": float(metrics["watch_to_trigger_pct"]) / 100.0,
        "risk_off_coverage": float(metrics["risk_off_coverage_pct"]) / 100.0,
        "max_drawdown": float(metrics["max_drawdown_pct"]) / 100.0,
        "trade_count": float(metrics["trade_count"]),
    }
    score = 0.0
    for key, weight in weights.items():
        score += raw[key] * float(weight)
    return round(score, 6)


def _evaluate_candidate(
    *,
    bars_by_symbol: Dict[str, List[Any]],
    market: str,
    common: Dict[str, Any],
    candidate: Dict[str, Any],
    objective: str,
    weights_override: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    params = dict(candidate["params"])
    result = run_loop(
        bars_by_symbol=bars_by_symbol,
        max_hold_days=int(candidate.get("max_hold_days", common.get("max_hold_days", 10))),
        stop_loss_pct=float(candidate.get("stop_loss_pct", common.get("stop_loss_pct", 0.06))),
        vcp_ratio=float(params["vcp_ratio"]),
        risk_off_ma=int(params["risk_off_ma"]),
        breakout_volume_mult=float(params["breakout_volume_mult"]),
        strong_close_threshold=float(params["strong_close_threshold"]),
        momentum_change_threshold=float(params["momentum_change_threshold"]),
        initial_capital=float(candidate.get("initial_capital", common.get("initial_capital", 1_000_000.0))),
        max_positions=int(candidate.get("max_positions", common.get("max_positions", 10))),
        fee_bps_each_side=float(candidate.get("fee_bps_each_side", common.get("fee_bps_each_side", 5.0))),
        spread_bps=float(candidate.get("spread_bps", common.get("spread_bps", 0.0))),
        slippage_bps=float(candidate.get("slippage_bps", common.get("slippage_bps", 0.0))),
        market=market,
        execution_cost_profile=str(candidate.get("execution_cost_profile", common.get("execution_cost_profile", "fixed"))),
    )
    metrics = _normalize_metrics(result)
    score = _score_candidate(metrics, objective=objective, weights_override=weights_override)
    return {
        "name": str(candidate["name"]),
        "params": params,
        "metrics": metrics,
        "score": score,
    }


def _rank_mode_candidates(rows: List[Dict[str, Any]], objective: str) -> List[Dict[str, Any]]:
    if objective == "steady":
        key_fn = lambda item: (
            float(item["score"]),
            -float(item["metrics"]["max_drawdown_pct"]),
            float(item["metrics"]["payoff"]),
            float(item["metrics"]["t3_win_rate_pct"]),
        )
    elif objective == "aggressive":
        key_fn = lambda item: (
            float(item["score"]),
            float(item["metrics"]["triggered_coverage_pct"]),
            float(item["metrics"]["trade_count"]),
            float(item["metrics"]["t3_win_rate_pct"]),
        )
    else:
        key_fn = lambda item: (
            float(item["score"]),
            float(item["metrics"]["t3_win_rate_pct"]),
            float(item["metrics"]["triggered_coverage_pct"]),
            -float(item["metrics"]["max_drawdown_pct"]),
        )
    return sorted(rows, key=key_fn, reverse=True)


def _merge_bundle_release(
    current_config: Dict[str, Any],
    *,
    bundle_name: str,
    market: str,
    params: Dict[str, Any],
) -> Dict[str, Any]:
    current_bundle = dict(((current_config.get("bundles") or {}).get(bundle_name)) or {})
    current_markets = dict(current_bundle.get("markets") or {})
    current_markets[market.upper()] = params
    return {
        "default": dict(current_bundle.get("default") or {}),
        **({"markets": current_markets} if current_markets else {}),
    }


def build_release_payload(
    manifest: Dict[str, Any],
    *,
    current_config: Dict[str, Any],
    manifest_path: str,
    output_json_path: str,
    include_production_effect: bool = True,
) -> Dict[str, Any]:
    market = str(manifest["market"]).upper()
    window = dict(manifest["window"])
    bars_by_symbol = load_bars_by_market(
        market=market,
        start_date=str(window["start_date"]),
        end_date=str(window["end_date"]),
    )
    if not bars_by_symbol:
        raise RuntimeError(f"No bars found for market={market}, window={window}")

    common = dict(manifest.get("common") or {})
    selected_modes: Dict[str, Any] = {}
    bundles_payload: Dict[str, Any] = {}
    production_effects: Dict[str, Any] = {}

    for mode_payload in manifest["modes"]:
        mode_id = str(mode_payload["mode_id"])
        bundle_name = str(mode_payload.get("bundle_name") or CORE_MODES.get(mode_id) or "")
        if not bundle_name:
            raise ValueError(f"Unknown bundle for mode_id={mode_id}")
        objective = str(mode_payload.get("objective") or bundle_name)
        weights_override = dict(mode_payload.get("objective_weights") or {})
        candidates = [
            _evaluate_candidate(
                bars_by_symbol=bars_by_symbol,
                market=market,
                common=common,
                candidate=dict(candidate),
                objective=objective,
                weights_override=weights_override,
            )
            for candidate in mode_payload["candidates"]
        ]
        ranked = _rank_mode_candidates(candidates, objective=objective)
        selected = ranked[0]
        selected_modes[mode_id] = {
            "mode_id": mode_id,
            "mode_name": _mode_label(mode_id),
            "bundle_name": bundle_name,
            "objective": objective,
            "selected_candidate": selected,
            "ranked_candidates": ranked,
        }
        bundles_payload[bundle_name] = _merge_bundle_release(
            current_config,
            bundle_name=bundle_name,
            market=market,
            params=dict(selected["params"]),
        )
        if include_production_effect:
            production_effects[mode_id] = _get_latest_mode_effect(mode_id, str(window["end_date"]))

    observe_only_bundle = dict(((current_config.get("bundles") or {}).get("observe_only")) or {"default": {}})
    bundles_payload["observe_only"] = {
        "default": dict(observe_only_bundle.get("default") or {}),
        **({"markets": dict(observe_only_bundle.get("markets") or {})} if observe_only_bundle.get("markets") else {}),
    }

    return {
        "config_version": str(current_config.get("config_version") or "mode_params_bundles_v1"),
        "strategy_version": str(manifest.get("strategy_version") or current_config.get("strategy_version") or "tradeability_v2"),
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": {
            "market": market,
            "method": "local_backtest",
            "manifest": os.path.relpath(manifest_path, ROOT_DIR),
            "artifact": os.path.relpath(output_json_path, ROOT_DIR),
        },
        "window": window,
        "selection_summary": selected_modes,
        "production_effect": production_effects if include_production_effect else {},
        "bundles": bundles_payload,
    }


def _to_markdown(payload: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append("# Mode Params Backtest Release")
    lines.append("")
    lines.append(f"- Market: `{payload['source']['market']}`")
    lines.append(f"- Strategy: `{payload['strategy_version']}`")
    lines.append(f"- Window: `{payload['window']['start_date']}` ~ `{payload['window']['end_date']}`")
    lines.append(f"- Generated at: `{payload['generated_at']}`")
    lines.append("")
    lines.append("| mode | selected | score | trig | t3_win | payoff | max_dd | trades |")
    lines.append("|---|---|---:|---:|---:|---:|---:|---:|")
    for mode_id, summary in payload["selection_summary"].items():
        selected = summary["selected_candidate"]
        metrics = selected["metrics"]
        lines.append(
            f"| {summary['mode_name']} | {selected['name']} | {selected['score']:.2f} | "
            f"{metrics['triggered_coverage_pct']:.2f}% | {metrics['t3_win_rate_pct']:.2f}% | "
            f"{metrics['payoff']:.2f} | {metrics['max_drawdown_pct']:.2f}% | {metrics['trade_count']} |"
        )
    lines.append("")

    for mode_id, summary in payload["selection_summary"].items():
        lines.append(f"## {summary['mode_name']} ({mode_id})")
        lines.append("")
        effect = (payload.get("production_effect") or {}).get(mode_id)
        if effect:
            lines.append(
                f"- 当前生产快照: hit_rate=`{effect['hit_rate']:.2%}`, max_drawdown=`{effect['max_drawdown']:.2%}`, "
                f"sample_size=`{effect['sample_size']}`"
            )
            lines.append("")
        lines.append("| candidate | score | trig | t3_win | payoff | max_dd | trades |")
        lines.append("|---|---:|---:|---:|---:|---:|---:|")
        for candidate in summary["ranked_candidates"]:
            metrics = candidate["metrics"]
            lines.append(
                f"| {candidate['name']} | {candidate['score']:.2f} | {metrics['triggered_coverage_pct']:.2f}% | "
                f"{metrics['t3_win_rate_pct']:.2f}% | {metrics['payoff']:.2f} | "
                f"{metrics['max_drawdown_pct']:.2f}% | {metrics['trade_count']} |"
            )
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(summary["selected_candidate"]["params"], ensure_ascii=False, indent=2))
        lines.append("```")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a mode params release artifact from local backtests.")
    parser.add_argument("--manifest", required=True, help="Candidate manifest json path.")
    parser.add_argument("--current-config", default=DEFAULT_INPUT_CONFIG, help="Current mode params config path.")
    parser.add_argument("--output-json", default=DEFAULT_OUTPUT_JSON, help="Release artifact json output path.")
    parser.add_argument("--output-md", default=DEFAULT_OUTPUT_MD, help="Release summary markdown path.")
    parser.add_argument("--skip-production-effect", action="store_true", help="Do not query mode_performance_snapshot.")
    args = parser.parse_args()

    manifest_path = os.path.abspath(args.manifest)
    output_json = os.path.abspath(args.output_json)
    output_md = os.path.abspath(args.output_md)
    os.makedirs(os.path.dirname(output_json), exist_ok=True)

    payload = build_release_payload(
        _load_json(manifest_path),
        current_config=_load_json(os.path.abspath(args.current_config)),
        manifest_path=manifest_path,
        output_json_path=output_json,
        include_production_effect=not args.skip_production_effect,
    )

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    with open(output_md, "w", encoding="utf-8") as f:
        f.write(_to_markdown(payload) + "\n")

    print(
        json.dumps(
            {
                "manifest": manifest_path,
                "output_json": output_json,
                "output_md": output_md,
                "selected_modes": {
                    mode_id: summary["selected_candidate"]["name"]
                    for mode_id, summary in payload["selection_summary"].items()
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
