"""
Minimal tradeability loop using local daily_prices data.

Purpose:
1) Verify Watch/TriggeredLong/RiskOff can run end-to-end on local DB.
2) Produce evaluation metrics aligned with docs/2_Intelligence/27_Acceptance_Criteria_v1.md.

This is intentionally small and deterministic for fast iteration.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple


@dataclass
class Bar:
    symbol: str
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    change_percent: float
    ma10: float
    ma20: float
    ma5: float
    macd_hist: float


@dataclass
class Trade:
    symbol: str
    setup_date: str
    entry_date: str
    entry_price: float
    exit_date: str
    exit_price: float
    holding_days: int
    exit_reason: str
    ret: float


@dataclass
class SimPosition:
    symbol: str
    entry_date: str
    exit_date: str
    entry_price: float
    shares: float


def safe_float(v: Optional[float]) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def load_bars(conn: sqlite3.Connection, start_date: Optional[str], end_date: Optional[str]) -> Dict[str, List[Bar]]:
    where_parts = []
    params: List[str] = []
    if start_date:
        where_parts.append("date >= ?")
        params.append(start_date)
    if end_date:
        where_parts.append("date <= ?")
        params.append(end_date)

    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
    query = f"""
        SELECT symbol, date, open, high, low, close, volume, change_percent, ma5, ma10, ma20, macd_hist
        FROM daily_prices
        {where_sql}
        ORDER BY symbol, date
    """
    cur = conn.cursor()
    cur.execute(query, tuple(params))

    out: Dict[str, List[Bar]] = {}
    for row in cur.fetchall():
        bar = Bar(
            symbol=str(row[0]),
            date=str(row[1]),
            open=safe_float(row[2]),
            high=safe_float(row[3]),
            low=safe_float(row[4]),
            close=safe_float(row[5]),
            volume=safe_float(row[6]),
            change_percent=safe_float(row[7]),
            ma5=safe_float(row[8]),
            ma10=safe_float(row[9]),
            ma20=safe_float(row[10]),
            macd_hist=safe_float(row[11]),
        )
        out.setdefault(bar.symbol, []).append(bar)
    return out


def mean(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / float(len(values))


def calc_amp(bar: Bar) -> float:
    if bar.close <= 0:
        return 0.0
    return (bar.high - bar.low) / bar.close


def calc_signal_features(
    history: Sequence[Bar],
    i: int,
    vcp_ratio: float,
    breakout_volume_mult: float,
    strong_close_threshold: float,
    momentum_change_threshold: float,
) -> Tuple[bool, bool, bool, bool]:
    """Return cond1..cond4 for day i."""
    bar = history[i]
    prev = history[i - 1]

    amp5 = mean([calc_amp(x) for x in history[i - 4 : i + 1]])
    amp20 = mean([calc_amp(x) for x in history[i - 19 : i + 1]])
    prev_vol5 = mean([x.volume for x in history[i - 5 : i]])

    cond1_vcp_like = amp20 > 0 and amp5 < amp20 * vcp_ratio
    cond2_breakout = (
        prev_vol5 > 0
        and bar.volume > breakout_volume_mult * prev_vol5
        and bar.close > bar.ma10
        and bar.close > bar.ma20
    )
    denom = bar.high - bar.low
    cond3_strong_close = denom > 0 and ((bar.close - bar.low) / denom) >= strong_close_threshold
    cond4_momentum = bar.change_percent > momentum_change_threshold or bar.macd_hist > prev.macd_hist
    return cond1_vcp_like, cond2_breakout, cond3_strong_close, cond4_momentum


def summarize_trades(trades: Sequence[Trade]) -> Dict[str, float]:
    rets = [t.ret for t in trades]
    wins = [r for r in rets if r > 0]
    losses = [r for r in rets if r <= 0]
    avg_win = mean(wins)
    avg_loss = mean(losses)
    payoff = (avg_win / abs(avg_loss)) if avg_loss < 0 else 0.0
    expectancy = mean(rets)

    equity = 1.0
    peak = 1.0
    max_drawdown = 0.0
    for r in rets:
        equity *= (1.0 + r)
        if equity > peak:
            peak = equity
        dd = (peak - equity) / peak if peak > 0 else 0.0
        if dd > max_drawdown:
            max_drawdown = dd

    return {
        "trade_count": float(len(trades)),
        "avg_return": expectancy,
        "win_rate": (len(wins) / len(rets)) if rets else 0.0,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "payoff": payoff,
        "expectancy": expectancy,
        "max_drawdown": max_drawdown,
    }


def simulate_capital_curve_legacy(
    trades: Sequence[Trade],
    initial_capital: float,
    max_positions: int,
    fee_bps_each_side: float,
) -> Dict[str, float]:
    """Legacy simplified capital curve: no daily MTM, realized PnL at exit only."""
    if not trades:
        return {
            "initial_capital": initial_capital,
            "final_capital": initial_capital,
            "total_return": 0.0,
            "cagr": 0.0,
            "max_drawdown": 0.0,
            "trade_count": 0,
            "max_positions": max_positions,
            "fee_bps_each_side": fee_bps_each_side,
        }

    fee = fee_bps_each_side / 10000.0
    equity = initial_capital
    peak = initial_capital
    max_dd = 0.0

    ordered = sorted(trades, key=lambda x: x.exit_date)
    for t in ordered:
        gross = 1.0 + t.ret
        net = (1.0 - fee) * gross * (1.0 - fee)
        equity *= net
        if equity > peak:
            peak = equity
        dd = (peak - equity) / peak if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd

    d0 = datetime.strptime(min(t.entry_date for t in trades), "%Y-%m-%d")
    d1 = datetime.strptime(max(t.exit_date for t in trades), "%Y-%m-%d")
    days = max(1, (d1 - d0).days)
    cagr = (equity / initial_capital) ** (365.0 / days) - 1.0 if initial_capital > 0 else 0.0
    return {
        "initial_capital": initial_capital,
        "final_capital": equity,
        "total_return": (equity / initial_capital) - 1.0 if initial_capital > 0 else 0.0,
        "cagr": cagr,
        "max_drawdown": max_dd,
        "trade_count": len(trades),
        "max_positions": max_positions,
        "fee_bps_each_side": fee_bps_each_side,
    }


def simulate_capital_curve_mtm(
    trades: Sequence[Trade],
    bars_by_symbol: Dict[str, List[Bar]],
    initial_capital: float,
    max_positions: int,
    fee_bps_each_side: float,
) -> Dict[str, float]:
    """Daily mark-to-market capital curve with entry/exit costs."""
    if not trades:
        return {
            "initial_capital": initial_capital,
            "final_capital": initial_capital,
            "total_return": 0.0,
            "cagr": 0.0,
            "max_drawdown": 0.0,
            "trade_count": 0,
            "max_positions": max_positions,
            "fee_bps_each_side": fee_bps_each_side,
            "equity_points": 0,
        }

    fee = fee_bps_each_side / 10000.0
    entries_by_date: Dict[str, List[Trade]] = {}
    for t in trades:
        entries_by_date.setdefault(t.entry_date, []).append(t)

    date_to_closes: Dict[str, Dict[str, float]] = {}
    for symbol, arr in bars_by_symbol.items():
        for b in arr:
            date_to_closes.setdefault(b.date, {})[symbol] = b.close
    all_dates = sorted(date_to_closes.keys())
    if not all_dates:
        return {
            "initial_capital": initial_capital,
            "final_capital": initial_capital,
            "total_return": 0.0,
            "cagr": 0.0,
            "max_drawdown": 0.0,
            "trade_count": len(trades),
            "max_positions": max_positions,
            "fee_bps_each_side": fee_bps_each_side,
            "equity_points": 0,
        }

    cash = initial_capital
    active: List[SimPosition] = []
    last_close: Dict[str, float] = {}
    peak = initial_capital
    max_dd = 0.0
    equity_curve: List[Tuple[str, float]] = []
    daily_holdings: List[Dict[str, object]] = []

    for d in all_dates:
        today_close = date_to_closes.get(d, {})
        last_close.update(today_close)

        todays_entries = entries_by_date.get(d, [])
        for t in sorted(todays_entries, key=lambda x: x.symbol):
            if len(active) >= max_positions or cash <= 0 or t.entry_price <= 0:
                continue

            cur_equity = cash
            for p in active:
                cur_equity += p.shares * last_close.get(p.symbol, p.entry_price)

            alloc = min(cash, cur_equity / max_positions)
            if alloc <= 0:
                continue
            shares = (alloc * (1.0 - fee)) / t.entry_price
            if shares <= 0:
                continue
            cash -= alloc
            active.append(
                SimPosition(
                    symbol=t.symbol,
                    entry_date=t.entry_date,
                    exit_date=t.exit_date,
                    entry_price=t.entry_price,
                    shares=shares,
                )
            )

        still_active: List[SimPosition] = []
        for p in active:
            if p.exit_date == d:
                exit_px = last_close.get(p.symbol, p.entry_price)
                cash += p.shares * exit_px * (1.0 - fee)
            else:
                still_active.append(p)
        active = still_active

        held_symbols = sorted({p.symbol for p in active})
        daily_holdings.append(
            {
                "date": d,
                "holding_count": len(held_symbols),
                "symbols": held_symbols,
            }
        )

        equity = cash
        for p in active:
            equity += p.shares * last_close.get(p.symbol, p.entry_price)
        equity_curve.append((d, equity))

        if equity > peak:
            peak = equity
        dd = (peak - equity) / peak if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd

    final_capital = equity_curve[-1][1] if equity_curve else initial_capital
    total_return = (final_capital / initial_capital) - 1.0 if initial_capital > 0 else 0.0
    d0 = datetime.strptime(all_dates[0], "%Y-%m-%d")
    d1 = datetime.strptime(all_dates[-1], "%Y-%m-%d")
    days = max(1, (d1 - d0).days)
    cagr = (final_capital / initial_capital) ** (365.0 / days) - 1.0 if initial_capital > 0 else 0.0
    return {
        "initial_capital": initial_capital,
        "final_capital": final_capital,
        "total_return": total_return,
        "cagr": cagr,
        "max_drawdown": max_dd,
        "trade_count": len(trades),
        "max_positions": max_positions,
        "fee_bps_each_side": fee_bps_each_side,
        "equity_points": len(equity_curve),
        "daily_holdings": daily_holdings,
    }


def run_loop(
    bars_by_symbol: Dict[str, List[Bar]],
    max_hold_days: int,
    stop_loss_pct: float,
    vcp_ratio: float,
    risk_off_ma: int,
    breakout_volume_mult: float,
    strong_close_threshold: float,
    momentum_change_threshold: float,
    initial_capital: float,
    max_positions: int,
    fee_bps_each_side: float,
) -> Dict[str, object]:
    watch_days = 0
    triggered_days = 0
    eligible_days = 0
    t1_total = 0
    t1_win = 0
    t3_total = 0
    t3_win = 0
    trades: List[Trade] = []

    for symbol, history in bars_by_symbol.items():
        if len(history) < 26:
            continue

        i = 20
        while i < len(history) - 1:
            eligible_days += 1
            c1, c2, c3, c4 = calc_signal_features(
                history, i, vcp_ratio, breakout_volume_mult, strong_close_threshold, momentum_change_threshold
            )
            watch = c1 and c2
            trigger = watch and c3 and c4

            if watch:
                watch_days += 1
            if not trigger:
                i += 1
                continue

            triggered_days += 1

            if i + 1 < len(history):
                t1_total += 1
                t1_ret = (history[i + 1].close / history[i].close) - 1.0 if history[i].close > 0 else 0.0
                if t1_ret > 0:
                    t1_win += 1
            if i + 3 < len(history):
                t3_total += 1
                t3_ret = (history[i + 3].close / history[i].close) - 1.0 if history[i].close > 0 else 0.0
                if t3_ret > 0:
                    t3_win += 1

            entry_idx = i + 1
            entry_bar = history[entry_idx]
            entry_price = entry_bar.open if entry_bar.open > 0 else entry_bar.close
            if entry_price <= 0:
                i += 1
                continue

            exit_idx = min(entry_idx + max_hold_days, len(history) - 1)
            exit_reason = "TIMEOUT"

            k = entry_idx
            while k <= min(entry_idx + max_hold_days, len(history) - 1):
                kb = history[k]
                if kb.close > 0 and kb.close <= entry_price * (1.0 - stop_loss_pct):
                    exit_idx = k
                    exit_reason = "STOP_LOSS"
                    break
                ma_line = kb.ma10
                ma_name = "MA10"
                if risk_off_ma == 5:
                    ma_line = kb.ma5
                    ma_name = "MA5"
                elif risk_off_ma == 20:
                    ma_line = kb.ma20
                    ma_name = "MA20"
                if kb.close > 0 and ma_line > 0 and kb.close < ma_line:
                    exit_idx = k
                    exit_reason = f"RISK_OFF_{ma_name}"
                    break
                k += 1

            exit_bar = history[exit_idx]
            exit_price = exit_bar.close if exit_bar.close > 0 else entry_price
            ret = (exit_price / entry_price) - 1.0
            trades.append(
                Trade(
                    symbol=symbol,
                    setup_date=history[i].date,
                    entry_date=entry_bar.date,
                    entry_price=entry_price,
                    exit_date=exit_bar.date,
                    exit_price=exit_price,
                    holding_days=max(0, exit_idx - entry_idx),
                    exit_reason=exit_reason,
                    ret=ret,
                )
            )

            i = exit_idx + 1

    trade_summary = summarize_trades(trades)
    capital_summary = simulate_capital_curve_mtm(
        trades,
        bars_by_symbol=bars_by_symbol,
        initial_capital=initial_capital,
        max_positions=max_positions,
        fee_bps_each_side=fee_bps_each_side,
    )
    capital_legacy = simulate_capital_curve_legacy(
        trades,
        initial_capital=initial_capital,
        max_positions=max_positions,
        fee_bps_each_side=fee_bps_each_side,
    )
    coverage_watch = (watch_days / eligible_days) if eligible_days else 0.0
    coverage_trigger = (triggered_days / eligible_days) if eligible_days else 0.0
    watch_to_trigger = (triggered_days / watch_days) if watch_days else 0.0

    exit_counts: Dict[str, int] = {}
    for t in trades:
        exit_counts[t.exit_reason] = exit_counts.get(t.exit_reason, 0) + 1

    return {
        "data_scope": {
            "symbols": len(bars_by_symbol),
            "eligible_days": eligible_days,
        },
        "state_metrics": {
            "watch_days": watch_days,
            "triggered_days": triggered_days,
            "watch_coverage": coverage_watch,
            "trigger_coverage": coverage_trigger,
            "watch_to_trigger_ratio": watch_to_trigger,
        },
        "forward_metrics": {
            "t1_win_rate": (t1_win / t1_total) if t1_total else 0.0,
            "t3_win_rate": (t3_win / t3_total) if t3_total else 0.0,
            "t1_samples": t1_total,
            "t3_samples": t3_total,
        },
        "trade_metrics": trade_summary,
        "capital_metrics": capital_summary,
        "capital_metrics_legacy": capital_legacy,
        "exit_reason_breakdown": exit_counts,
        "all_trades": [t.__dict__ for t in trades],
        "sample_trades": [t.__dict__ for t in trades[:20]],
    }


def run_baseline_ma20(
    bars_by_symbol: Dict[str, List[Bar]],
    max_hold_days: int,
    stop_loss_pct: float,
    initial_capital: float,
    max_positions: int,
    fee_bps_each_side: float,
) -> Dict[str, object]:
    """Simple baseline: enter when close > ma20 and previous close <= previous ma20."""
    trades: List[Trade] = []

    for symbol, history in bars_by_symbol.items():
        if len(history) < 22:
            continue
        i = 1
        while i < len(history) - 1:
            cur = history[i]
            prev = history[i - 1]
            trigger = cur.close > cur.ma20 and prev.close <= prev.ma20 and cur.ma20 > 0
            if not trigger:
                i += 1
                continue

            entry_idx = i + 1
            entry_bar = history[entry_idx]
            entry_price = entry_bar.open if entry_bar.open > 0 else entry_bar.close
            if entry_price <= 0:
                i += 1
                continue

            exit_idx = min(entry_idx + max_hold_days, len(history) - 1)
            exit_reason = "TIMEOUT"

            k = entry_idx
            while k <= min(entry_idx + max_hold_days, len(history) - 1):
                kb = history[k]
                if kb.close > 0 and kb.close <= entry_price * (1.0 - stop_loss_pct):
                    exit_idx = k
                    exit_reason = "STOP_LOSS"
                    break
                if kb.close > 0 and kb.ma20 > 0 and kb.close < kb.ma20:
                    exit_idx = k
                    exit_reason = "RISK_OFF_MA20"
                    break
                k += 1

            exit_bar = history[exit_idx]
            exit_price = exit_bar.close if exit_bar.close > 0 else entry_price
            trades.append(
                Trade(
                    symbol=symbol,
                    setup_date=cur.date,
                    entry_date=entry_bar.date,
                    entry_price=entry_price,
                    exit_date=exit_bar.date,
                    exit_price=exit_price,
                    holding_days=max(0, exit_idx - entry_idx),
                    exit_reason=exit_reason,
                    ret=(exit_price / entry_price) - 1.0,
                )
            )
            i = exit_idx + 1

    return {
        "trade_metrics": summarize_trades(trades),
        "capital_metrics": simulate_capital_curve_mtm(
            trades,
            bars_by_symbol=bars_by_symbol,
            initial_capital=initial_capital,
            max_positions=max_positions,
            fee_bps_each_side=fee_bps_each_side,
        ),
        "trade_count": len(trades),
    }


def split_three_windows(all_dates: Sequence[str]) -> List[Tuple[str, str]]:
    unique_dates = sorted(set(all_dates))
    if len(unique_dates) < 30:
        return []
    n = len(unique_dates)
    step = n // 3
    windows: List[Tuple[str, str]] = []
    for w in range(3):
        s_idx = w * step
        e_idx = (w + 1) * step - 1 if w < 2 else n - 1
        windows.append((unique_dates[s_idx], unique_dates[e_idx]))
    return windows


def filter_by_date_window(
    bars_by_symbol: Dict[str, List[Bar]],
    start_date: str,
    end_date: str,
) -> Dict[str, List[Bar]]:
    out: Dict[str, List[Bar]] = {}
    for symbol, arr in bars_by_symbol.items():
        sub = [x for x in arr if start_date <= x.date <= end_date]
        if sub:
            out[symbol] = sub
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Run minimal tradeability loop on local daily_prices.")
    parser.add_argument("--db-path", default="data/stockwise.db")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD")
    parser.add_argument("--max-hold-days", type=int, default=10)
    parser.add_argument("--stop-loss-pct", type=float, default=0.06)
    parser.add_argument("--vcp-ratio", type=float, default=0.8)
    parser.add_argument("--risk-off-ma", type=int, default=10, choices=[5, 10, 20])
    parser.add_argument("--breakout-volume-mult", type=float, default=1.5)
    parser.add_argument("--strong-close-threshold", type=float, default=0.7)
    parser.add_argument("--momentum-change-threshold", type=float, default=5.0)
    parser.add_argument("--initial-capital", type=float, default=1_000_000.0)
    parser.add_argument("--max-positions", type=int, default=10)
    parser.add_argument("--fee-bps-each-side", type=float, default=5.0)
    parser.add_argument("--output-json", default="tmp/min_tradeability_loop_result.json")
    parser.add_argument("--with-baseline", action="store_true")
    parser.add_argument("--walk-forward-3", action="store_true")
    args = parser.parse_args()

    db_path = os.path.abspath(args.db_path)
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"DB not found: {db_path}")

    conn = sqlite3.connect(db_path)
    try:
        bars_by_symbol = load_bars(conn, args.start_date, args.end_date)
    finally:
        conn.close()

    result = run_loop(
        bars_by_symbol=bars_by_symbol,
        max_hold_days=args.max_hold_days,
        stop_loss_pct=args.stop_loss_pct,
        vcp_ratio=args.vcp_ratio,
        risk_off_ma=args.risk_off_ma,
        breakout_volume_mult=args.breakout_volume_mult,
        strong_close_threshold=args.strong_close_threshold,
        momentum_change_threshold=args.momentum_change_threshold,
        initial_capital=args.initial_capital,
        max_positions=args.max_positions,
        fee_bps_each_side=args.fee_bps_each_side,
    )
    if args.with_baseline:
        result["baseline_ma20"] = run_baseline_ma20(
            bars_by_symbol=bars_by_symbol,
            max_hold_days=args.max_hold_days,
            stop_loss_pct=args.stop_loss_pct,
            initial_capital=args.initial_capital,
            max_positions=args.max_positions,
            fee_bps_each_side=args.fee_bps_each_side,
        )

    if args.walk_forward_3:
        all_dates: List[str] = []
        for arr in bars_by_symbol.values():
            all_dates.extend([x.date for x in arr])
        windows = split_three_windows(all_dates)
        wf_rows = []
        for idx, (ws, we) in enumerate(windows, start=1):
            sub = filter_by_date_window(bars_by_symbol, ws, we)
            main_res = run_loop(
                sub,
                args.max_hold_days,
                args.stop_loss_pct,
                args.vcp_ratio,
                args.risk_off_ma,
                args.breakout_volume_mult,
                args.strong_close_threshold,
                args.momentum_change_threshold,
                args.initial_capital,
                args.max_positions,
                args.fee_bps_each_side,
            )
            row: Dict[str, object] = {
                "window": idx,
                "start_date": ws,
                "end_date": we,
                "state_metrics": main_res["state_metrics"],
                "forward_metrics": main_res["forward_metrics"],
                "trade_metrics": main_res["trade_metrics"],
            }
            if args.with_baseline:
                row["baseline_ma20"] = run_baseline_ma20(
                    sub,
                    args.max_hold_days,
                    args.stop_loss_pct,
                    args.initial_capital,
                    args.max_positions,
                    args.fee_bps_each_side,
                )
            wf_rows.append(row)
        result["walk_forward_3"] = wf_rows

    result["run_config"] = {
        "db_path": db_path,
        "start_date": args.start_date,
        "end_date": args.end_date,
        "max_hold_days": args.max_hold_days,
        "stop_loss_pct": args.stop_loss_pct,
        "vcp_ratio": args.vcp_ratio,
        "risk_off_ma": args.risk_off_ma,
        "breakout_volume_mult": args.breakout_volume_mult,
        "strong_close_threshold": args.strong_close_threshold,
        "momentum_change_threshold": args.momentum_change_threshold,
        "initial_capital": args.initial_capital,
        "max_positions": args.max_positions,
        "fee_bps_each_side": args.fee_bps_each_side,
        "with_baseline": args.with_baseline,
        "walk_forward_3": args.walk_forward_3,
        "run_at": datetime.now().isoformat(timespec="seconds"),
    }

    out_path = os.path.abspath(args.output_json)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Result written to: {out_path}")
    print(json.dumps(result["state_metrics"], ensure_ascii=False, indent=2))
    print(json.dumps(result["forward_metrics"], ensure_ascii=False, indent=2))
    print(json.dumps(result["trade_metrics"], ensure_ascii=False, indent=2))
    print(json.dumps(result["capital_metrics"], ensure_ascii=False, indent=2))
    print("capital_metrics_legacy:")
    print(json.dumps(result["capital_metrics_legacy"], ensure_ascii=False, indent=2))
    if args.with_baseline and "baseline_ma20" in result:
        print("baseline_ma20:")
        print(json.dumps(result["baseline_ma20"]["trade_metrics"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
