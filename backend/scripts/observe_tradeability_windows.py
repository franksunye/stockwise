"""
Windowed observability report for historical tradeability signals.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Sequence, Tuple

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from scripts.run_tradeability_weekly_calibration import load_bars_by_market  # type: ignore
from scripts.run_min_tradeability_loop import filter_by_date_window, run_loop, split_three_windows  # type: ignore
from backend.engine.layer1_state import DEFAULT_STRATEGY_VERSION, list_supported_strategy_versions, load_market_params


def _parse_versions(raw: str) -> List[str]:
    versions = [x.strip() for x in raw.split(",") if x.strip()]
    if not versions:
        return [DEFAULT_STRATEGY_VERSION]
    valid = set(list_supported_strategy_versions())
    unknown = [x for x in versions if x not in valid]
    if unknown:
        raise ValueError(f"Unsupported strategy versions: {unknown}. Supported: {sorted(valid)}")
    return versions


def _latest_dates(market: str) -> List[str]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        rows = cur.execute(
            """
            SELECT DISTINCT dp.date
            FROM daily_prices dp
            JOIN stock_meta sm ON sm.symbol = dp.symbol
            WHERE sm.market = ?
            ORDER BY dp.date
            """,
            (market,),
        ).fetchall()
        return [str(r[0]) for r in rows]
    finally:
        conn.close()


def _window_ranges(all_dates: Sequence[str], lengths: Sequence[int]) -> List[Tuple[str, str, str]]:
    out: List[Tuple[str, str, str]] = []
    if not all_dates:
        return out
    for length in lengths:
        if len(all_dates) < length:
            continue
        out.append((f"rolling_{length}", all_dates[-length], all_dates[-1]))
    for idx, (start_date, end_date) in enumerate(split_three_windows(all_dates), start=1):
        out.append((f"walk_forward_{idx}", start_date, end_date))
    return out


def _state_distribution(market: str, strategy_version: str, start_date: str, end_date: str) -> Dict[str, float]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        row = cur.execute(
            """
            SELECT
              COUNT(*) AS total_states,
              SUM(CASE WHEN setup_state='NoSetup' THEN 1 ELSE 0 END) AS nosetup_count,
              SUM(CASE WHEN setup_state='Watch' THEN 1 ELSE 0 END) AS watch_count,
              SUM(CASE WHEN setup_state='TriggeredLong' THEN 1 ELSE 0 END) AS triggered_count,
              SUM(CASE WHEN setup_state='RiskOff' THEN 1 ELSE 0 END) AS riskoff_count
            FROM quant_tradeability_signals
            WHERE market = ?
              AND strategy_version = ?
              AND date BETWEEN ? AND ?
            """,
            (market, strategy_version, start_date, end_date),
        ).fetchone()
        total = int(row[0] or 0) if row else 0
        if total == 0:
            return {"NoSetup": 0.0, "Watch": 0.0, "TriggeredLong": 0.0, "RiskOff": 0.0}
        return {
            "NoSetup": round(100.0 * int(row[1] or 0) / total, 2),
            "Watch": round(100.0 * int(row[2] or 0) / total, 2),
            "TriggeredLong": round(100.0 * int(row[3] or 0) / total, 2),
            "RiskOff": round(100.0 * int(row[4] or 0) / total, 2),
        }
    finally:
        conn.close()


def _observe_window(
    market: str,
    strategy_version: str,
    bars_by_symbol: Dict[str, list],
    start_date: str,
    end_date: str,
) -> Dict[str, object]:
    _, params = load_market_params(market=market, strategy_version=strategy_version)
    sub = filter_by_date_window(bars_by_symbol, start_date, end_date)
    result = run_loop(
        bars_by_symbol=sub,
        max_hold_days=10,
        stop_loss_pct=0.06,
        vcp_ratio=float(params["vcp_ratio"]),
        risk_off_ma=int(params["risk_off_ma"]),
        breakout_volume_mult=float(params["breakout_volume_mult"]),
        strong_close_threshold=float(params["strong_close_threshold"]),
        momentum_change_threshold=float(params["momentum_change_threshold"]),
        initial_capital=1_000_000.0,
        max_positions=10,
        fee_bps_each_side=5.0,
        spread_bps=0.0,
        slippage_bps=0.0,
    )
    state_metrics = result["state_metrics"]
    trade_metrics = result["trade_metrics"]
    forward_metrics = result["forward_metrics"]
    return {
        "triggered_coverage_pct": round(float(state_metrics["trigger_coverage"]) * 100.0, 2),
        "watch_coverage_pct": round(float(state_metrics["watch_coverage"]) * 100.0, 2),
        "risk_off_coverage_pct": round(float(state_metrics.get("risk_off_coverage", 0.0)) * 100.0, 2),
        "watch_to_trigger_pct": round(float(state_metrics["watch_to_trigger_ratio"]) * 100.0, 2),
        "max_drawdown_pct": round(float(trade_metrics["max_drawdown"]) * 100.0, 2),
        "expectancy": round(float(trade_metrics["expectancy"]), 4),
        "payoff": round(float(trade_metrics["payoff"]), 4),
        "t3_win_rate_pct": round(float(forward_metrics["t3_win_rate"]) * 100.0, 2),
        "trade_count": int(trade_metrics["trade_count"]),
        "state_distribution_pct": _state_distribution(market, strategy_version, start_date, end_date),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Observe historical tradeability signals with rolling windows.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--strategy-versions", default="tradeability_v1,tradeability_v2")
    parser.add_argument("--window-lengths", default="60,120,250")
    parser.add_argument("--output-json", default="")
    parser.add_argument("--output-md", default="")
    args = parser.parse_args()

    all_dates = _latest_dates(args.market)
    bars_by_symbol = load_bars_by_market(args.market, None, None)
    windows = _window_ranges(all_dates, [int(x) for x in args.window_lengths.split(",") if x.strip()])

    results: List[Dict[str, object]] = []
    for strategy_version in _parse_versions(args.strategy_versions):
        version_windows: List[Dict[str, object]] = []
        for label, start_date, end_date in windows:
            version_windows.append(
                {
                    "label": label,
                    "start_date": start_date,
                    "end_date": end_date,
                    "metrics": _observe_window(args.market, strategy_version, bars_by_symbol, start_date, end_date),
                }
            )
        results.append({"strategy_version": strategy_version, "windows": version_windows})

    payload = {
        "market": args.market,
        "run_at": datetime.now().isoformat(timespec="seconds"),
        "results": results,
    }
    output_json = args.output_json or f"tmp/tradeability_observability/{args.market.lower()}_window_observability.json"
    output_md = args.output_md or f"tmp/tradeability_observability/{args.market.lower()}_window_observability.md"
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    lines: List[str] = [f"# Window Observability ({args.market})", ""]
    for version in results:
        lines.append(f"## {version['strategy_version']}")
        lines.append("")
        lines.append("| window | trig_cov | riskoff | watch | watch->trigger | max_dd | expectancy | payoff | t3_win |")
        lines.append("|---|---|---|---|---|---|---|---|---|")
        for item in version["windows"]:
            m = item["metrics"]
            lines.append(
                f"| {item['label']} | {m['triggered_coverage_pct']:.2f}% | {m['risk_off_coverage_pct']:.2f}% | {m['watch_coverage_pct']:.2f}% | "
                f"{m['watch_to_trigger_pct']:.2f}% | {m['max_drawdown_pct']:.2f}% | {m['expectancy']:.4f} | {m['payoff']:.4f} | {m['t3_win_rate_pct']:.2f}% |"
            )
        lines.append("")
    with open(output_md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(json.dumps({"output_json": os.path.abspath(output_json), "output_md": os.path.abspath(output_md)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
