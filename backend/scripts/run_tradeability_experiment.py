"""
Tradeability experiment runner.

Purpose:
1) Compare multiple Layer-1 strategy versions on the same historical window.
2) Keep the adjudication interface fixed while surfacing coverage/risk/drawdown differences.
3) Emit JSON/Markdown artifacts for v1/v2 weekly review.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Sequence

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from backend.engine.layer1_state import DEFAULT_STRATEGY_VERSION, list_supported_strategy_versions, load_market_params
from scripts.run_tradeability_weekly_calibration import load_bars_by_market  # type: ignore
from scripts.run_min_tradeability_loop import run_loop  # type: ignore


def _parse_versions(raw: str) -> List[str]:
    versions = [x.strip() for x in raw.split(",") if x.strip()]
    if not versions:
        return [DEFAULT_STRATEGY_VERSION]
    valid = set(list_supported_strategy_versions())
    unknown = [x for x in versions if x not in valid]
    if unknown:
        raise ValueError(f"Unsupported strategy versions: {unknown}. Supported: {sorted(valid)}")
    return versions


def _resolve_single_run_params_file(strategy_versions: Sequence[str], params_file: str) -> str:
    if len(strategy_versions) != 1:
        raise ValueError("--params-file only supports a single strategy version run")
    return params_file


def _evaluate_version(
    market: str,
    strategy_version: str,
    bars_by_symbol: Dict[str, list],
    max_hold_days: int,
    stop_loss_pct: float,
    initial_capital: float,
    max_positions: int,
    fee_bps_each_side: float,
    spread_bps: float,
    slippage_bps: float,
    execution_cost_profile: str,
    params_file: Optional[str] = None,
) -> Dict[str, object]:
    _, params = load_market_params(market=market, strategy_version=strategy_version, params_file=params_file)
    result = run_loop(
        bars_by_symbol=bars_by_symbol,
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
        spread_bps=spread_bps,
        slippage_bps=slippage_bps,
        market=market,
        execution_cost_profile=execution_cost_profile,
    )
    state_metrics = result["state_metrics"]
    trade_metrics = result["trade_metrics"]
    forward_metrics = result["forward_metrics"]
    return {
        "strategy_version": strategy_version,
        "params": params,
        "observability": {
            "direction_consistency_pct": 100.0,
            "triggered_coverage_pct": round(float(state_metrics["trigger_coverage"]) * 100.0, 2),
            "watch_coverage_pct": round(float(state_metrics["watch_coverage"]) * 100.0, 2),
            "risk_off_coverage_pct": round(float(state_metrics.get("risk_off_coverage", 0.0)) * 100.0, 2),
            "watch_to_trigger_pct": round(float(state_metrics["watch_to_trigger_ratio"]) * 100.0, 2),
            "max_drawdown_pct": round(float(trade_metrics["max_drawdown"]) * 100.0, 2),
            "expectancy": round(float(trade_metrics["expectancy"]), 4),
            "payoff": round(float(trade_metrics["payoff"]), 4),
            "t3_win_rate_pct": round(float(forward_metrics["t3_win_rate"]) * 100.0, 2),
            "trade_count": int(trade_metrics["trade_count"]),
        },
    }


def _to_markdown(payload: Dict[str, object]) -> str:
    lines: List[str] = []
    lines.append(f"# Tradeability Experiment ({payload['market']})")
    lines.append("")
    lines.append(f"- Generated at: {payload['run_at']}")
    lines.append(f"- Window: `{payload['window']['start_date']}` ~ `{payload['window']['end_date']}`")
    lines.append("")
    lines.append("| version | trig_cov | riskoff | watch | watch->trigger | max_dd | expectancy | payoff | t3_win | trades |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|")
    for item in payload["results"]:
        obs = item["observability"]
        lines.append(
            f"| {item['strategy_version']} | {obs['triggered_coverage_pct']:.2f}% | {obs['risk_off_coverage_pct']:.2f}% | "
            f"{obs['watch_coverage_pct']:.2f}% | {obs['watch_to_trigger_pct']:.2f}% | {obs['max_drawdown_pct']:.2f}% | "
            f"{obs['expectancy']:.4f} | {obs['payoff']:.4f} | {obs['t3_win_rate_pct']:.2f}% | {obs['trade_count']} |"
        )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run tradeability version experiments.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--strategy-versions", default="tradeability_v1,tradeability_v2")
    parser.add_argument("--start-date", default="")
    parser.add_argument("--end-date", default="")
    parser.add_argument("--max-hold-days", type=int, default=10)
    parser.add_argument("--stop-loss-pct", type=float, default=0.06)
    parser.add_argument("--initial-capital", type=float, default=1_000_000.0)
    parser.add_argument("--max-positions", type=int, default=10)
    parser.add_argument("--fee-bps-each-side", type=float, default=5.0)
    parser.add_argument("--spread-bps", type=float, default=0.0)
    parser.add_argument("--slippage-bps", type=float, default=0.0)
    parser.add_argument("--execution-cost-profile", choices=["fixed", "liquidity_bucketed"], default="fixed")
    parser.add_argument("--params-file", default="")
    parser.add_argument("--output-json", default="")
    parser.add_argument("--output-md", default="")
    args = parser.parse_args()

    bars_by_symbol = load_bars_by_market(args.market, args.start_date or None, args.end_date or None)
    if not bars_by_symbol:
        raise RuntimeError(f"No bars found for market={args.market}")
    all_dates = [bar.date for bars in bars_by_symbol.values() for bar in bars]
    strategy_versions = _parse_versions(args.strategy_versions)
    params_file = _resolve_single_run_params_file(strategy_versions, args.params_file) if args.params_file else ""
    payload = {
        "market": args.market,
        "run_at": datetime.now().isoformat(timespec="seconds"),
        "window": {
            "start_date": args.start_date or min(all_dates),
            "end_date": args.end_date or max(all_dates),
        },
        "results": [
            _evaluate_version(
                market=args.market,
                strategy_version=version,
                bars_by_symbol=bars_by_symbol,
                max_hold_days=args.max_hold_days,
                stop_loss_pct=args.stop_loss_pct,
                initial_capital=args.initial_capital,
                max_positions=args.max_positions,
                fee_bps_each_side=args.fee_bps_each_side,
                spread_bps=args.spread_bps,
                slippage_bps=args.slippage_bps,
                execution_cost_profile=args.execution_cost_profile,
                params_file=params_file or None,
            )
            for version in strategy_versions
        ],
    }

    output_json = args.output_json or f"tmp/tradeability_experiments/{args.market.lower()}_strategy_experiment.json"
    output_md = args.output_md or f"tmp/tradeability_experiments/{args.market.lower()}_strategy_experiment.md"
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(output_md, "w", encoding="utf-8") as f:
        f.write(_to_markdown(payload) + "\n")

    print(
        json.dumps(
            {
                "market": args.market,
                "output_json": os.path.abspath(output_json),
                "output_md": os.path.abspath(output_md),
                "versions": [x["strategy_version"] for x in payload["results"]],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
