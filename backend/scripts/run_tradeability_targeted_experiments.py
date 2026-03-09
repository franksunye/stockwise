"""
Run targeted local tradeability experiments from an explicit scenario manifest.

Purpose:
1) Turn ad-hoc local experiments into a repeatable batch workflow.
2) Compare baseline / mid / active candidates under the same window.
3) Emit a compact JSON + Markdown summary for next-step parameter decisions.
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

from scripts.run_tradeability_weekly_calibration import load_bars_by_market  # type: ignore
from scripts.run_min_tradeability_loop import run_loop  # type: ignore


DEFAULT_MANIFEST = os.path.join(
    os.path.dirname(backend_path),
    "tmp",
    "experiment_candidates",
    "tradeability_round2_manifest.json",
)


def _pct(value: float) -> float:
    return round(float(value) * 100.0, 2)


def _evaluate_scenario(scenario: Dict[str, Any]) -> Dict[str, Any]:
    bars_by_symbol = load_bars_by_market(
        market=str(scenario["market"]),
        start_date=str(scenario["start_date"]),
        end_date=str(scenario["end_date"]),
    )
    if not bars_by_symbol:
        raise RuntimeError(f"No bars found for scenario={scenario['name']}")

    params = scenario["params"]
    result = run_loop(
        bars_by_symbol=bars_by_symbol,
        max_hold_days=int(scenario.get("max_hold_days", 10)),
        stop_loss_pct=float(scenario.get("stop_loss_pct", 0.06)),
        vcp_ratio=float(params["vcp_ratio"]),
        risk_off_ma=int(params["risk_off_ma"]),
        breakout_volume_mult=float(params["breakout_volume_mult"]),
        strong_close_threshold=float(params["strong_close_threshold"]),
        momentum_change_threshold=float(params["momentum_change_threshold"]),
        initial_capital=float(scenario.get("initial_capital", 1_000_000.0)),
        max_positions=int(scenario.get("max_positions", 10)),
        fee_bps_each_side=float(scenario.get("fee_bps_each_side", 5.0)),
    )

    trade = result["trade_metrics"]
    state = result["state_metrics"]
    forward = result["forward_metrics"]
    capital = result["capital_metrics"]
    return {
        "name": scenario["name"],
        "market": scenario["market"],
        "params": params,
        "window": {
            "start_date": scenario["start_date"],
            "end_date": scenario["end_date"],
        },
        "metrics": {
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
        },
    }


def _rank_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        rows,
        key=lambda item: (
            item["market"],
            float(item["metrics"]["t3_win_rate_pct"]),
            float(item["metrics"]["triggered_coverage_pct"]),
            -float(item["metrics"]["max_drawdown_pct"]),
            float(item["metrics"]["payoff"]),
        ),
        reverse=True,
    )


def _to_markdown(payload: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append("# Tradeability Targeted Experiments")
    lines.append("")
    lines.append(f"- Generated at: {payload['generated_at']}")
    lines.append(f"- Window: `{payload['window']['start_date']}` ~ `{payload['window']['end_date']}`")
    lines.append("")
    lines.append("| market | scenario | trig | watch->trigger | t3_win | payoff | max_dd | trades |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for row in payload["ranked_results"]:
        m = row["metrics"]
        lines.append(
            f"| {row['market']} | {row['name']} | {m['triggered_coverage_pct']:.2f}% | "
            f"{m['watch_to_trigger_pct']:.2f}% | {m['t3_win_rate_pct']:.2f}% | "
            f"{m['payoff']:.2f} | {m['max_drawdown_pct']:.2f}% | {m['trade_count']} |"
        )
    lines.append("")
    for market in ("CN", "HK"):
        lines.append(f"## {market}")
        lines.append("")
        market_rows = [row for row in payload["results"] if row["market"] == market]
        for row in market_rows:
            lines.append(f"### {row['name']}")
            lines.append("")
            lines.append("```json")
            lines.append(json.dumps(row["params"], ensure_ascii=False, indent=2))
            lines.append("```")
            lines.append("")
            lines.append(
                f"- 出手率: `{row['metrics']['triggered_coverage_pct']:.2f}%`\n"
                f"- Watch -> Triggered: `{row['metrics']['watch_to_trigger_pct']:.2f}%`\n"
                f"- T+3 胜率: `{row['metrics']['t3_win_rate_pct']:.2f}%`\n"
                f"- 盈亏比: `{row['metrics']['payoff']:.2f}`\n"
                f"- 最大回撤: `{row['metrics']['max_drawdown_pct']:.2f}%`\n"
                f"- 交易数: `{row['metrics']['trade_count']}`"
            )
            lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run targeted local tradeability experiments.")
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    parser.add_argument("--output-json", default="")
    parser.add_argument("--output-md", default="")
    args = parser.parse_args()

    with open(args.manifest, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    results = [_evaluate_scenario(item) for item in manifest["scenarios"]]
    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "window": manifest["window"],
        "results": results,
        "ranked_results": _rank_rows(results),
    }

    default_base = os.path.join(os.path.dirname(backend_path), "tmp", "targeted_experiments", "round2")
    output_json = args.output_json or f"{default_base}_results.json"
    output_md = args.output_md or f"{default_base}_results.md"
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(output_md, "w", encoding="utf-8") as f:
        f.write(_to_markdown(payload) + "\n")

    print(
        json.dumps(
            {
                "manifest": os.path.abspath(args.manifest),
                "output_json": os.path.abspath(output_json),
                "output_md": os.path.abspath(output_md),
                "scenario_count": len(results),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
