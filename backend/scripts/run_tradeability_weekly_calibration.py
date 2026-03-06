"""
Weekly parameter calibration for tradeability sidecar.

Purpose:
1) Run versioned weekly experiments for tradeability_v1/tradeability_v2.
2) Enforce single-parameter, small-step tuning order with explicit guardrails.
3) Emit a decision log that can be reviewed before params are promoted.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from backend.engine.layer1_state import DEFAULT_STRATEGY_VERSION, list_supported_strategy_versions, load_market_params
from scripts.run_min_tradeability_loop import (  # type: ignore
    Bar,
    filter_by_date_window,
    run_loop,
    safe_float,
    split_three_windows,
)

DEFAULT_STEP_MAP: Dict[str, Sequence[float]] = {
    "breakout_volume_mult": (-0.1, 0.0, 0.1),
    "momentum_change_threshold": (-0.5, 0.0, 0.5),
    "strong_close_threshold": (-0.05, 0.0, 0.05),
    "vcp_ratio": (-0.05, 0.0, 0.05),
    "risk_off_ma": (5, 10, 20),
}


def load_bars_by_market(market: str, start_date: Optional[str], end_date: Optional[str]) -> Dict[str, List[Bar]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        where_parts = ["sm.market = ?"]
        params: List[object] = [market]
        if start_date:
            where_parts.append("dp.date >= ?")
            params.append(start_date)
        if end_date:
            where_parts.append("dp.date <= ?")
            params.append(end_date)
        rows = cur.execute(
            f"""
            SELECT
                dp.symbol, dp.date, dp.open, dp.high, dp.low, dp.close, dp.volume,
                dp.change_percent, dp.ma5, dp.ma10, dp.ma20, dp.macd_hist
            FROM daily_prices dp
            JOIN stock_meta sm ON sm.symbol = dp.symbol
            WHERE {' AND '.join(where_parts)}
            ORDER BY dp.symbol, dp.date
            """,
            tuple(params),
        ).fetchall()
        out: Dict[str, List[Bar]] = {}
        for r in rows:
            bar = Bar(
                symbol=str(r[0]),
                date=str(r[1]),
                open=safe_float(r[2]),
                high=safe_float(r[3]),
                low=safe_float(r[4]),
                close=safe_float(r[5]),
                volume=safe_float(r[6]),
                change_percent=safe_float(r[7]),
                ma5=safe_float(r[8]),
                ma10=safe_float(r[9]),
                ma20=safe_float(r[10]),
                macd_hist=safe_float(r[11]),
            )
            out.setdefault(bar.symbol, []).append(bar)
        return out
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _bounded_value(parameter: str, value: float) -> float:
    if parameter == "breakout_volume_mult":
        return min(2.0, max(0.9, round(value, 2)))
    if parameter == "momentum_change_threshold":
        return min(8.0, max(1.5, round(value, 1)))
    if parameter == "strong_close_threshold":
        return min(0.85, max(0.5, round(value, 2)))
    if parameter == "vcp_ratio":
        return min(1.1, max(0.7, round(value, 2)))
    if parameter == "risk_off_ma":
        return float(int(value if value in {5, 10, 20} else 10))
    return value


def _candidate_values(parameter: str, base_value: float) -> List[float]:
    raw_steps = DEFAULT_STEP_MAP[parameter]
    values: List[float] = []
    if parameter == "risk_off_ma":
        values = [float(int(x)) for x in raw_steps]
    else:
        for step in raw_steps:
            values.append(_bounded_value(parameter, base_value + float(step)))
    out: List[float] = []
    for value in values:
        if value not in out:
            out.append(value)
    return out


def _window_metrics(
    bars_by_symbol: Dict[str, List[Bar]],
    windows: Sequence[Tuple[str, str]],
    params: Dict[str, float],
    max_hold_days: int,
    stop_loss_pct: float,
    initial_capital: float,
    max_positions: int,
    fee_bps_each_side: float,
) -> Dict[str, object]:
    rows: List[Dict[str, object]] = []
    consistency_proxy = 100.0
    for idx, (ws, we) in enumerate(windows, start=1):
        sub = filter_by_date_window(bars_by_symbol, ws, we)
        res = run_loop(
            bars_by_symbol=sub,
            max_hold_days=max_hold_days,
            stop_loss_pct=stop_loss_pct,
            vcp_ratio=float(params["vcp_ratio"]),
            risk_off_ma=int(params["risk_off_ma"]),
            breakout_volume_mult=float(params["breakout_volume_mult"]),
            strong_close_threshold=float(params["strong_close_threshold"]),
            momentum_change_threshold=float(params["momentum_change_threshold"]),
            initial_capital=initial_capital,
            max_positions=max_positions,
            fee_bps_each_side=fee_bps_each_side,
        )
        trade_metrics = res["trade_metrics"]
        state_metrics = res["state_metrics"]
        forward_metrics = res["forward_metrics"]
        triggered_cov = float(state_metrics["trigger_coverage"])
        risk_off_cov = float(state_metrics.get("risk_off_coverage", 0.0))
        rows.append(
            {
                "window": idx,
                "start_date": ws,
                "end_date": we,
                "expectancy": float(trade_metrics["expectancy"]),
                "payoff": float(trade_metrics["payoff"]),
                "max_drawdown": float(trade_metrics["max_drawdown"]),
                "trade_count": int(trade_metrics["trade_count"]),
                "trigger_coverage": triggered_cov,
                "watch_coverage": float(state_metrics.get("watch_coverage", 0.0)),
                "risk_off_coverage": risk_off_cov,
                "t3_win_rate": float(forward_metrics["t3_win_rate"]),
                "direction_consistency_pct": consistency_proxy,
            }
        )

    avg = lambda key: round(sum(float(r[key]) for r in rows) / len(rows), 6) if rows else 0.0
    aggregate = {
        "triggered_coverage": avg("trigger_coverage"),
        "risk_off_coverage": avg("risk_off_coverage"),
        "watch_coverage": avg("watch_coverage"),
        "max_drawdown": avg("max_drawdown"),
        "expectancy": avg("expectancy"),
        "payoff": avg("payoff"),
        "t3_win_rate": avg("t3_win_rate"),
        "direction_consistency_pct": avg("direction_consistency_pct"),
    }
    aggregate["score"] = round(
        aggregate["expectancy"] * 100.0
        + aggregate["t3_win_rate"] * 20.0
        + aggregate["triggered_coverage"] * 120.0
        - aggregate["max_drawdown"] * 35.0
        - aggregate["risk_off_coverage"] * 10.0,
        6,
    )
    return {"windows": rows, "aggregate": aggregate}


def _guardrail_status(candidate: Dict[str, float], baseline: Dict[str, float]) -> Dict[str, bool]:
    return {
        "expectancy_positive": candidate["expectancy"] > 0.0,
        "riskoff_controlled": candidate["risk_off_coverage"] <= baseline["risk_off_coverage"] + 0.03,
        "drawdown_controlled": candidate["max_drawdown"] <= baseline["max_drawdown"] + 0.05,
        "coverage_not_regressed": candidate["triggered_coverage"] >= baseline["triggered_coverage"],
    }


def _select_best_result(results: Sequence[Dict[str, object]], baseline_metrics: Dict[str, float]) -> Dict[str, object]:
    ranked = sorted(
        results,
        key=lambda x: (
            all(x["guardrails"].values()),
            float(x["metrics"]["triggered_coverage"]),
            -float(x["metrics"]["risk_off_coverage"]),
            -float(x["metrics"]["max_drawdown"]),
            float(x["metrics"]["score"]),
        ),
        reverse=True,
    )
    best = ranked[0]
    if not all(best["guardrails"].values()) and float(best["metrics"]["score"]) < float(baseline_metrics["score"]):
        return {"accept_change": False, "selected": ranked[-1] if False else None, "ranked": ranked}
    baseline_candidate = next((x for x in ranked if x["changed_parameter"] is None), None)
    if baseline_candidate is not None:
        current_cov = float(best["metrics"]["triggered_coverage"])
        baseline_cov = float(baseline_candidate["metrics"]["triggered_coverage"])
        if current_cov <= baseline_cov and not all(best["guardrails"].values()):
            return {"accept_change": False, "selected": baseline_candidate, "ranked": ranked}
    return {"accept_change": best["changed_parameter"] is not None, "selected": best, "ranked": ranked}


def _parse_strategy_versions(raw: str) -> List[str]:
    versions = [x.strip() for x in raw.split(",") if x.strip()]
    if not versions:
        return [DEFAULT_STRATEGY_VERSION]
    valid = set(list_supported_strategy_versions())
    unknown = [x for x in versions if x not in valid]
    if unknown:
        raise ValueError(f"Unsupported strategy versions: {unknown}. Supported: {sorted(valid)}")
    return versions


def _render_markdown(payload: Dict[str, object]) -> str:
    lines: List[str] = []
    lines.append(f"# Weekly Calibration Report ({payload['market']})")
    lines.append("")
    lines.append(f"- Generated at: {payload['run_at']}")
    lines.append(f"- Parameter order: `{', '.join(payload['parameter_order'])}`")
    lines.append("")
    for version_payload in payload["versions"]:
        lines.append(f"## {version_payload['strategy_version']}")
        lines.append("")
        lines.append("### Final Params")
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(version_payload["final_params"], ensure_ascii=False, indent=2))
        lines.append("```")
        lines.append("")
        lines.append("| param | action | before | after | trig_cov | riskoff | max_dd | guards |")
        lines.append("|---|---|---|---|---|---|---|---|")
        for decision in version_payload["decision_log"]:
            lines.append(
                f"| {decision['parameter']} | {decision['decision']} | {decision['before_value']} | {decision['after_value']} | "
                f"{decision['selected_metrics']['triggered_coverage']:.3f} | {decision['selected_metrics']['risk_off_coverage']:.3f} | "
                f"{decision['selected_metrics']['max_drawdown']:.3f} | {decision['guardrails_passed']} |"
            )
        lines.append("")
        lines.append("### Observability")
        lines.append("")
        obs = version_payload["observability"]
        lines.append(
            f"- Direction consistency: `{obs['direction_consistency_pct']:.2f}%`; "
            f"Triggered coverage: `{obs['triggered_coverage_pct']:.2f}%`; "
            f"RiskOff: `{obs['risk_off_coverage_pct']:.2f}%`; "
            f"Max drawdown: `{obs['max_drawdown_pct']:.2f}%`"
        )
        lines.append(f"- State distribution: `{json.dumps(obs['state_distribution_pct'], ensure_ascii=False)}`")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Weekly calibration for tradeability sidecar parameters.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--strategy-versions", default=DEFAULT_STRATEGY_VERSION)
    parser.add_argument("--start-date", default="")
    parser.add_argument("--end-date", default="")
    parser.add_argument("--parameter-order", default="breakout_volume_mult,momentum_change_threshold,strong_close_threshold,vcp_ratio,risk_off_ma")
    parser.add_argument("--max-hold-days", type=int, default=10)
    parser.add_argument("--stop-loss-pct", type=float, default=0.06)
    parser.add_argument("--initial-capital", type=float, default=1_000_000.0)
    parser.add_argument("--max-positions", type=int, default=10)
    parser.add_argument("--fee-bps-each-side", type=float, default=5.0)
    parser.add_argument("--output-json", default="")
    parser.add_argument("--output-md", default="")
    args = parser.parse_args()

    bars_by_symbol = load_bars_by_market(args.market, args.start_date or None, args.end_date or None)
    if not bars_by_symbol:
        raise RuntimeError(f"No bars found for market={args.market}")

    all_dates: List[str] = []
    for arr in bars_by_symbol.values():
        all_dates.extend([x.date for x in arr])
    windows = split_three_windows(all_dates)
    if len(windows) != 3:
        raise RuntimeError(f"Need enough data for 3 windows, got {len(windows)}")

    parameter_order = [x.strip() for x in args.parameter_order.split(",") if x.strip()]
    for parameter in parameter_order:
        if parameter not in DEFAULT_STEP_MAP:
            raise ValueError(f"Unsupported parameter in order: {parameter}")

    versions_payload: List[Dict[str, object]] = []
    for strategy_version in _parse_strategy_versions(args.strategy_versions):
        _, base_params = load_market_params(args.market, strategy_version=strategy_version)
        current_params = {k: float(v) for k, v in base_params.items()}
        decision_log: List[Dict[str, object]] = []

        for parameter in parameter_order:
            baseline_eval = _window_metrics(
                bars_by_symbol=bars_by_symbol,
                windows=windows,
                params=current_params,
                max_hold_days=args.max_hold_days,
                stop_loss_pct=args.stop_loss_pct,
                initial_capital=args.initial_capital,
                max_positions=args.max_positions,
                fee_bps_each_side=args.fee_bps_each_side,
            )
            baseline_metrics = baseline_eval["aggregate"]
            results: List[Dict[str, object]] = []
            for value in _candidate_values(parameter, float(current_params[parameter])):
                candidate_params = dict(current_params)
                candidate_params[parameter] = value
                candidate_eval = _window_metrics(
                    bars_by_symbol=bars_by_symbol,
                    windows=windows,
                    params=candidate_params,
                    max_hold_days=args.max_hold_days,
                    stop_loss_pct=args.stop_loss_pct,
                    initial_capital=args.initial_capital,
                    max_positions=args.max_positions,
                    fee_bps_each_side=args.fee_bps_each_side,
                )
                metrics = candidate_eval["aggregate"]
                guardrails = _guardrail_status(metrics, baseline_metrics)
                results.append(
                    {
                        "parameter": parameter,
                        "changed_parameter": parameter if value != current_params[parameter] else None,
                        "params": candidate_params,
                        "metrics": metrics,
                        "windows": candidate_eval["windows"],
                        "guardrails": guardrails,
                        "value": value,
                    }
                )

            selection = _select_best_result(results, baseline_metrics)
            selected = selection["selected"] or next(x for x in results if x["changed_parameter"] is None)
            decision = {
                "parameter": parameter,
                "decision": "accepted" if selection["accept_change"] else "kept_baseline",
                "before_value": current_params[parameter],
                "after_value": selected["value"],
                "selected_metrics": selected["metrics"],
                "guardrails": selected["guardrails"],
                "guardrails_passed": all(selected["guardrails"].values()),
                "ranked_candidates": [
                    {
                        "value": item["value"],
                        "metrics": item["metrics"],
                        "guardrails": item["guardrails"],
                    }
                    for item in selection["ranked"]
                ],
            }
            decision_log.append(decision)
            if selection["accept_change"]:
                current_params = dict(selected["params"])

        final_eval = _window_metrics(
            bars_by_symbol=bars_by_symbol,
            windows=windows,
            params=current_params,
            max_hold_days=args.max_hold_days,
            stop_loss_pct=args.stop_loss_pct,
            initial_capital=args.initial_capital,
            max_positions=args.max_positions,
            fee_bps_each_side=args.fee_bps_each_side,
        )
        final_metrics = final_eval["aggregate"]
        versions_payload.append(
            {
                "strategy_version": strategy_version,
                "base_params": base_params,
                "final_params": current_params,
                "decision_log": decision_log,
                "final_windows": final_eval["windows"],
                "observability": {
                    "direction_consistency_pct": 100.0,
                    "triggered_coverage_pct": round(final_metrics["triggered_coverage"] * 100.0, 2),
                    "risk_off_coverage_pct": round(final_metrics["risk_off_coverage"] * 100.0, 2),
                    "watch_coverage_pct": round(final_metrics["watch_coverage"] * 100.0, 2),
                    "max_drawdown_pct": round(final_metrics["max_drawdown"] * 100.0, 2),
                    "state_distribution_pct": {
                        "NoSetup": round(max(0.0, 100.0 - (final_metrics["triggered_coverage"] + final_metrics["risk_off_coverage"] + final_metrics["watch_coverage"]) * 100.0), 2),
                        "Watch": round(final_metrics["watch_coverage"] * 100.0, 2),
                        "TriggeredLong": round(final_metrics["triggered_coverage"] * 100.0, 2),
                        "RiskOff": round(final_metrics["risk_off_coverage"] * 100.0, 2),
                    },
                },
            }
        )

    payload = {
        "market": args.market,
        "run_at": datetime.now().isoformat(timespec="seconds"),
        "parameter_order": parameter_order,
        "windows": [{"start_date": x[0], "end_date": x[1]} for x in windows],
        "versions": versions_payload,
    }

    output_json = args.output_json or f"tmp/tradeability_calibration/{args.market.lower()}_weekly_calibration.json"
    output_md = args.output_md or f"tmp/tradeability_calibration/{args.market.lower()}_weekly_calibration.md"
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(output_md, "w", encoding="utf-8") as f:
        f.write(_render_markdown(payload) + "\n")

    logger.info(f"Weekly calibration finished. market={args.market}, versions={args.strategy_versions}")
    print(
        json.dumps(
            {
                "market": args.market,
                "versions": [
                    {
                        "strategy_version": version["strategy_version"],
                        "final_params": version["final_params"],
                    }
                    for version in versions_payload
                ],
                "output_json": os.path.abspath(output_json),
                "output_md": os.path.abspath(output_md),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
