"""
Weekly parameter calibration for tradeability sidecar.

Purpose:
1) Evaluate parameter candidates on 3 walk-forward windows.
2) Select robust params for each market (CN/HK) from local/cloud daily_prices.
3) Output JSON/Markdown artifacts for human review before rollout.
"""

from __future__ import annotations

import argparse
import itertools
import json
import os
import statistics
import sys
from dataclasses import asdict
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple

# Add backend to path (legacy support)
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
# Add project root to path (support 'backend.*' imports)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from scripts.run_min_tradeability_loop import (  # type: ignore
    Bar,
    filter_by_date_window,
    run_loop,
    safe_float,
    split_three_windows,
)

PARAMS_FILE_DEFAULT = os.path.join(
    os.path.dirname(backend_path), "backend", "strategy_config", "tradeability_params_v1.json"
)


def load_market_params(params_file: str, market: str) -> Dict[str, float]:
    defaults = {
        "vcp_ratio": 0.9,
        "breakout_volume_mult": 1.1,
        "strong_close_threshold": 0.65,
        "momentum_change_threshold": 4.0,
        "risk_off_ma": 10,
    }
    try:
        with open(params_file, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        market_cfg = (cfg.get("markets") or {}).get(market) or {}
        for k in defaults:
            if k in market_cfg:
                defaults[k] = market_cfg[k]
    except Exception as e:
        logger.warning(f"Failed to load params file ({params_file}), fallback to defaults: {e}")
    return defaults


def bounded_values(base: float, deltas: Sequence[float], low: float, high: float, digits: int = 2) -> List[float]:
    out: List[float] = []
    for d in deltas:
        v = round(base + d, digits)
        if v < low:
            v = low
        if v > high:
            v = high
        if v not in out:
            out.append(v)
    return sorted(out)


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
        where_sql = " AND ".join(where_parts)
        rows = cur.execute(
            f"""
            SELECT
                dp.symbol, dp.date, dp.open, dp.high, dp.low, dp.close, dp.volume,
                dp.change_percent, dp.ma5, dp.ma10, dp.ma20, dp.macd_hist
            FROM daily_prices dp
            JOIN stock_meta sm ON sm.symbol = dp.symbol
            WHERE {where_sql}
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


def make_candidates(base_params: Dict[str, float]) -> List[Dict[str, float]]:
    vcp_values = bounded_values(float(base_params["vcp_ratio"]), [-0.10, 0.0, 0.10], 0.70, 1.10)
    bvm_values = bounded_values(float(base_params["breakout_volume_mult"]), [-0.20, 0.0, 0.20], 1.00, 2.00)
    strong_values = bounded_values(float(base_params["strong_close_threshold"]), [-0.05, 0.0, 0.05], 0.55, 0.85)
    momo_values = bounded_values(float(base_params["momentum_change_threshold"]), [-1.0, 0.0, 1.0], 2.0, 8.0, digits=1)
    risk_values = [5, 10, 20]

    out: List[Dict[str, float]] = []
    for vcp, bvm, strong, momo, risk_ma in itertools.product(
        vcp_values, bvm_values, strong_values, momo_values, risk_values
    ):
        out.append(
            {
                "vcp_ratio": float(vcp),
                "breakout_volume_mult": float(bvm),
                "strong_close_threshold": float(strong),
                "momentum_change_threshold": float(momo),
                "risk_off_ma": int(risk_ma),
            }
        )
    return out


def window_score(
    expectancy: float,
    t3_win_rate: float,
    max_drawdown: float,
    trade_count: int,
    trigger_coverage: float,
    min_trades_per_window: int,
) -> float:
    score = expectancy * 100.0 + t3_win_rate * 20.0 - max_drawdown * 35.0
    if trade_count < min_trades_per_window:
        score -= 20.0 * (min_trades_per_window - trade_count) / float(max(1, min_trades_per_window))
    if trigger_coverage < 0.005 or trigger_coverage > 0.35:
        score -= 8.0
    return score


def evaluate_candidate(
    bars_by_symbol: Dict[str, List[Bar]],
    windows: Sequence[Tuple[str, str]],
    candidate: Dict[str, float],
    max_hold_days: int,
    stop_loss_pct: float,
    initial_capital: float,
    max_positions: int,
    fee_bps_each_side: float,
    min_trades_per_window: int,
) -> Dict[str, object]:
    rows: List[Dict[str, object]] = []
    scores: List[float] = []
    pass_count = 0

    for idx, (ws, we) in enumerate(windows, start=1):
        sub = filter_by_date_window(bars_by_symbol, ws, we)
        res = run_loop(
            bars_by_symbol=sub,
            max_hold_days=max_hold_days,
            stop_loss_pct=stop_loss_pct,
            vcp_ratio=float(candidate["vcp_ratio"]),
            risk_off_ma=int(candidate["risk_off_ma"]),
            breakout_volume_mult=float(candidate["breakout_volume_mult"]),
            strong_close_threshold=float(candidate["strong_close_threshold"]),
            momentum_change_threshold=float(candidate["momentum_change_threshold"]),
            initial_capital=initial_capital,
            max_positions=max_positions,
            fee_bps_each_side=fee_bps_each_side,
        )
        trade_metrics = res["trade_metrics"]
        forward_metrics = res["forward_metrics"]
        state_metrics = res["state_metrics"]
        expectancy = float(trade_metrics["expectancy"])
        t3_win_rate = float(forward_metrics["t3_win_rate"])
        max_dd = float(trade_metrics["max_drawdown"])
        trade_count = int(trade_metrics["trade_count"])
        trig_cov = float(state_metrics["trigger_coverage"])
        score = window_score(expectancy, t3_win_rate, max_dd, trade_count, trig_cov, min_trades_per_window)
        scores.append(score)

        window_pass = expectancy > 0 and t3_win_rate >= 0.5 and trade_count >= min_trades_per_window
        if window_pass:
            pass_count += 1

        rows.append(
            {
                "window": idx,
                "start_date": ws,
                "end_date": we,
                "expectancy": expectancy,
                "t3_win_rate": t3_win_rate,
                "max_drawdown": max_dd,
                "trade_count": trade_count,
                "trigger_coverage": trig_cov,
                "score": score,
                "window_pass": window_pass,
            }
        )

    avg_score = statistics.fmean(scores) if scores else -999.0
    std_score = statistics.pstdev(scores) if len(scores) > 1 else 0.0
    robust_score = avg_score - 0.6 * std_score + pass_count * 3.0
    return {
        "candidate": candidate,
        "windows": rows,
        "avg_score": avg_score,
        "std_score": std_score,
        "robust_score": robust_score,
        "pass_windows": pass_count,
    }


def write_markdown_report(
    output_md: str,
    market: str,
    strategy_version: str,
    total_candidates: int,
    base_eval: Dict[str, object],
    best_eval: Dict[str, object],
    top_ranked: Sequence[Dict[str, object]],
) -> None:
    def row_line(x: Dict[str, object]) -> str:
        c = x["candidate"]
        return (
            f"| {float(x['robust_score']):.3f} | {int(x['pass_windows'])}/3 | "
            f"{c['vcp_ratio']} | {c['breakout_volume_mult']} | {c['strong_close_threshold']} | "
            f"{c['momentum_change_threshold']} | {c['risk_off_ma']} |"
        )

    lines: List[str] = []
    lines.append(f"# Weekly Calibration Report ({market})")
    lines.append("")
    lines.append(f"- Generated at: {datetime.now().isoformat(timespec='seconds')}")
    lines.append(f"- Strategy version: `{strategy_version}`")
    lines.append(f"- Candidate count: {total_candidates}")
    lines.append("")
    lines.append("## Best Params")
    lines.append("")
    lines.append("```json")
    lines.append(json.dumps(best_eval["candidate"], ensure_ascii=False, indent=2))
    lines.append("```")
    lines.append("")
    lines.append("## Base vs Best")
    lines.append("")
    lines.append(f"- Base robust score: `{float(base_eval['robust_score']):.3f}`")
    lines.append(f"- Best robust score: `{float(best_eval['robust_score']):.3f}`")
    lines.append(f"- Base pass windows: `{int(base_eval['pass_windows'])}/3`")
    lines.append(f"- Best pass windows: `{int(best_eval['pass_windows'])}/3`")
    lines.append("")
    lines.append("## Top Candidates")
    lines.append("")
    lines.append("| robust_score | pass_windows | vcp | vol_mult | strong_close | momentum | risk_off_ma |")
    lines.append("|---|---|---|---|---|---|---|")
    for x in top_ranked:
        lines.append(row_line(x))
    lines.append("")
    lines.append("## Window Detail (Best)")
    lines.append("")
    lines.append("| window | range | expectancy | t3_win | max_dd | trades | trig_cov | pass |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for w in best_eval["windows"]:
        lines.append(
            f"| {w['window']} | {w['start_date']}~{w['end_date']} | {float(w['expectancy']):.4f} | "
            f"{float(w['t3_win_rate']):.3f} | {float(w['max_drawdown']):.3f} | {int(w['trade_count'])} | "
            f"{float(w['trigger_coverage']):.3f} | {bool(w['window_pass'])} |"
        )
    lines.append("")

    os.makedirs(os.path.dirname(output_md), exist_ok=True)
    with open(output_md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).strip() + "\n")


def maybe_write_updated_params(
    params_file: str,
    output_params_file: str,
    market: str,
    strategy_version: str,
    candidate: Dict[str, float],
) -> None:
    cfg: Dict[str, object] = {"strategy_version": strategy_version, "markets": {}}
    if os.path.exists(params_file):
        with open(params_file, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    if "markets" not in cfg or not isinstance(cfg["markets"], dict):
        cfg["markets"] = {}
    markets = cfg["markets"]
    assert isinstance(markets, dict)
    markets[market] = candidate
    cfg["strategy_version"] = strategy_version

    os.makedirs(os.path.dirname(output_params_file), exist_ok=True)
    with open(output_params_file, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Weekly calibration for tradeability sidecar parameters.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--strategy-version", default="tradeability_v1")
    parser.add_argument("--params-file", default=PARAMS_FILE_DEFAULT)
    parser.add_argument("--start-date", default="")
    parser.add_argument("--end-date", default="")
    parser.add_argument("--max-hold-days", type=int, default=10)
    parser.add_argument("--stop-loss-pct", type=float, default=0.06)
    parser.add_argument("--initial-capital", type=float, default=1_000_000.0)
    parser.add_argument("--max-positions", type=int, default=10)
    parser.add_argument("--fee-bps-each-side", type=float, default=5.0)
    parser.add_argument("--min-trades-per-window", type=int, default=6)
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--output-json", default="")
    parser.add_argument("--output-md", default="")
    parser.add_argument("--emit-updated-params", default="", help="Optional output file of updated params JSON")
    args = parser.parse_args()

    start_date = args.start_date or None
    end_date = args.end_date or None

    bars_by_symbol = load_bars_by_market(args.market, start_date, end_date)
    if not bars_by_symbol:
        raise RuntimeError(f"No bars found for market={args.market}, start={start_date}, end={end_date}")

    all_dates: List[str] = []
    for arr in bars_by_symbol.values():
        all_dates.extend([x.date for x in arr])
    windows = split_three_windows(all_dates)
    if len(windows) != 3:
        raise RuntimeError(f"Need enough data for 3 windows, got {len(windows)}")

    base_params = load_market_params(args.params_file, args.market)
    candidates = make_candidates(base_params)
    logger.info(f"Weekly calibration: market={args.market}, candidates={len(candidates)}, windows={windows}")

    evaluations: List[Dict[str, object]] = []
    for idx, c in enumerate(candidates, start=1):
        ev = evaluate_candidate(
            bars_by_symbol=bars_by_symbol,
            windows=windows,
            candidate=c,
            max_hold_days=args.max_hold_days,
            stop_loss_pct=args.stop_loss_pct,
            initial_capital=args.initial_capital,
            max_positions=args.max_positions,
            fee_bps_each_side=args.fee_bps_each_side,
            min_trades_per_window=args.min_trades_per_window,
        )
        evaluations.append(ev)
        if idx % 25 == 0:
            logger.info(f"Calibration progress: {idx}/{len(candidates)}")

    evaluations.sort(key=lambda x: (int(x["pass_windows"]), float(x["robust_score"])), reverse=True)
    best_eval = evaluations[0]

    base_candidate = {
        "vcp_ratio": float(base_params["vcp_ratio"]),
        "breakout_volume_mult": float(base_params["breakout_volume_mult"]),
        "strong_close_threshold": float(base_params["strong_close_threshold"]),
        "momentum_change_threshold": float(base_params["momentum_change_threshold"]),
        "risk_off_ma": int(base_params["risk_off_ma"]),
    }
    base_eval = evaluate_candidate(
        bars_by_symbol=bars_by_symbol,
        windows=windows,
        candidate=base_candidate,
        max_hold_days=args.max_hold_days,
        stop_loss_pct=args.stop_loss_pct,
        initial_capital=args.initial_capital,
        max_positions=args.max_positions,
        fee_bps_each_side=args.fee_bps_each_side,
        min_trades_per_window=args.min_trades_per_window,
    )

    output_json = args.output_json or f"tmp/tradeability_calibration/{args.market.lower()}_weekly_calibration.json"
    output_md = args.output_md or f"tmp/tradeability_calibration/{args.market.lower()}_weekly_calibration.md"
    payload = {
        "market": args.market,
        "strategy_version": args.strategy_version,
        "run_at": datetime.now().isoformat(timespec="seconds"),
        "run_config": {
            "start_date": start_date,
            "end_date": end_date,
            "max_hold_days": args.max_hold_days,
            "stop_loss_pct": args.stop_loss_pct,
            "initial_capital": args.initial_capital,
            "max_positions": args.max_positions,
            "fee_bps_each_side": args.fee_bps_each_side,
            "min_trades_per_window": args.min_trades_per_window,
            "top_k": args.top_k,
            "params_file": args.params_file,
        },
        "windows": [{"start_date": x[0], "end_date": x[1]} for x in windows],
        "base_eval": base_eval,
        "best_eval": best_eval,
        "top_ranked": evaluations[: max(1, args.top_k)],
    }

    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    write_markdown_report(
        output_md=output_md,
        market=args.market,
        strategy_version=args.strategy_version,
        total_candidates=len(candidates),
        base_eval=base_eval,
        best_eval=best_eval,
        top_ranked=evaluations[: max(1, args.top_k)],
    )

    if args.emit_updated_params:
        maybe_write_updated_params(
            params_file=args.params_file,
            output_params_file=args.emit_updated_params,
            market=args.market,
            strategy_version=args.strategy_version,
            candidate=best_eval["candidate"],
        )

    print(
        json.dumps(
            {
                "market": args.market,
                "best_candidate": best_eval["candidate"],
                "best_robust_score": best_eval["robust_score"],
                "base_robust_score": base_eval["robust_score"],
                "best_pass_windows": best_eval["pass_windows"],
                "base_pass_windows": base_eval["pass_windows"],
                "output_json": os.path.abspath(output_json),
                "output_md": os.path.abspath(output_md),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
