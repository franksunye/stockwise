#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import date
import json
import math
import os
import sqlite3
import statistics
import sys
from pathlib import Path


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("DB_SOURCE", "local")

from backend.management.policies.base import PolicyContext
from backend.management.policies.policy_registry import build_default_policies
from backend.management.research.case_sets import get_case_set
from backend.management.research.lanes import route_case_lanes
from backend.management.research.market_routing import (
    MARKET_ROUTING_CONFIGS,
    TradeManagementMarketRoutingConfig,
    market_routing_config_to_dict,
)
from backend.management.state.snapshot_builder import build_position_snapshots


BENCHMARK_BY_MARKET = {
    "CN": {"symbol": "510300", "name": "沪深300ETF"},
    "HK": {"symbol": "02800", "name": "恒生指数ETF"},
}


def _load_cases(args) -> list[dict]:
    if args.cases_file:
        with open(args.cases_file, "r", encoding="utf-8") as f:
            payload = json.load(f)
        if not isinstance(payload, list):
            raise ValueError("cases file must be a JSON array")
        return payload
    return get_case_set(args.preset)


def _fetch_close_series(symbol: str, start_date: str | None = None) -> list[tuple[str, float]]:
    conn = sqlite3.connect(os.path.join(ROOT, "data", "stockwise.db"))
    try:
        cur = conn.cursor()
        sql = "SELECT date, close FROM daily_prices WHERE symbol=?"
        params: list[object] = [symbol]
        if start_date:
            sql += " AND date>=?"
            params.append(start_date)
        sql += " ORDER BY date ASC"
        cur.execute(sql, tuple(params))
        return [(str(d), float(c)) for d, c in cur.fetchall() if c is not None]
    finally:
        conn.close()


def _simulate_daily_multiples(policy, snapshots):
    first = snapshots[0]
    current_size = first.position_size
    cash_realized = 0.0
    has_partial_exit = False
    policy_state = {}
    daily = {}

    for snapshot in snapshots:
        if current_size <= 0:
            break
        snapshot.position_size = current_size
        snapshot.partial_exit_done = has_partial_exit
        context = PolicyContext(has_partial_exit=has_partial_exit, state=policy_state)
        actions = policy.decide(snapshot, context)
        for action in actions:
            if action.action == "SELL_PART" and action.size_ratio:
                qty = current_size * action.size_ratio
                cash_realized += qty * snapshot.close
                current_size -= qty
                has_partial_exit = True
            elif action.action == "EXIT_ALL":
                cash_realized += current_size * snapshot.close
                current_size = 0.0
                break

        equity_value = cash_realized + current_size * snapshot.close
        multiple = equity_value / (first.entry_price * first.position_size)
        daily[snapshot.trade_date] = multiple

    if snapshots:
        last_date = snapshots[-1].trade_date
        last_multiple = daily.get(last_date, 1.0)
    else:
        last_date = ""
        last_multiple = 1.0

    return {
        "daily_multiples": daily,
        "last_date": last_date,
        "last_multiple": last_multiple,
    }


def _build_benchmark_daily(market: str, entry_date: str, end_date: str):
    benchmark = BENCHMARK_BY_MARKET[market]
    rows = [row for row in _fetch_close_series(benchmark["symbol"], entry_date) if row[0] <= end_date]
    if not rows:
        return {
            "benchmark_symbol": benchmark["symbol"],
            "benchmark_name": benchmark["name"],
            "daily_multiples": {},
            "last_multiple": 1.0,
        }
    first_close = rows[0][1]
    daily = {date: close / first_close for date, close in rows}
    return {
        "benchmark_symbol": benchmark["symbol"],
        "benchmark_name": benchmark["name"],
        "daily_multiples": daily,
        "last_multiple": list(daily.values())[-1],
    }


def _value_on_date(date: str, entry_date: str, daily_multiples: dict[str, float], last_multiple: float) -> float:
    if date < entry_date:
        return 1.0
    eligible_dates = [d for d in daily_multiples.keys() if d <= date]
    if eligible_dates:
        return daily_multiples[max(eligible_dates)]
    return last_multiple


def _max_drawdown(nav_series: list[tuple[str, float]]) -> float | None:
    if not nav_series:
        return None
    peak = nav_series[0][1]
    worst = 0.0
    for _, nav in nav_series:
        peak = max(peak, nav)
        dd = (nav / peak) - 1.0 if peak else 0.0
        worst = min(worst, dd)
    return worst


def _annualized_return(total_return: float, periods: int) -> float | None:
    if periods <= 1:
        return None
    base = 1.0 + total_return
    if base <= 0:
        return None
    return math.pow(base, 252 / (periods - 1)) - 1.0


def _annualized_volatility(daily_returns: list[float]) -> float | None:
    if len(daily_returns) < 2:
        return None
    std = statistics.pstdev(daily_returns)
    return std * math.sqrt(252)


def _sharpe_like(daily_returns: list[float]) -> float | None:
    if len(daily_returns) < 2:
        return None
    std = statistics.pstdev(daily_returns)
    if std == 0:
        return None
    mean = statistics.fmean(daily_returns)
    return mean / std * math.sqrt(252)


def _build_portfolio_metrics(
    cases: list[dict],
    routing_config_overrides: dict[str, TradeManagementMarketRoutingConfig] | None = None,
) -> dict:
    policies = {policy.policy_id: policy for policy in build_default_policies()}
    rendered_cases = []
    all_dates = set()

    for case in cases:
        symbol = str(case["symbol"])
        market = str(case["market"])
        entry_date = str(case["entry_date"])
        entry_price = float(case["entry_price"])
        position_size = float(case.get("position_size", 3000.0))
        label = str(case.get("label", f"{symbol}_{entry_date}"))

        snapshots = build_position_snapshots(
            symbol=symbol,
            entry_date=entry_date,
            entry_price=entry_price,
            position_size=position_size,
        )
        if not snapshots:
            continue

        baseline_curve = _simulate_daily_multiples(policies["buy_and_hold_baseline"], [s for s in snapshots])
        lane_route = route_case_lanes(
            [s for s in snapshots],
            market=market,
            routing_config=(routing_config_overrides or {}).get(market),
        )
        routed_policy_id = str(lane_route["final"]["recommended_policy"])
        routed_curve = _simulate_daily_multiples(policies[routed_policy_id], [s for s in snapshots])
        end_date = max(baseline_curve["last_date"], routed_curve["last_date"])
        benchmark_curve = _build_benchmark_daily(market, entry_date, end_date)

        all_dates.update(baseline_curve["daily_multiples"].keys())
        all_dates.update(routed_curve["daily_multiples"].keys())
        all_dates.update(benchmark_curve["daily_multiples"].keys())

        rendered_cases.append(
            {
                "label": label,
                "symbol": symbol,
                "market": market,
                "entry_date": entry_date,
                "baseline": baseline_curve,
                "routed": routed_curve,
                "routed_policy_id": routed_policy_id,
                "benchmark": benchmark_curve,
            }
        )

    if not rendered_cases:
        return {"sample_size": 0}

    ordered_dates = sorted(all_dates)
    baseline_nav = []
    routed_nav = []
    benchmark_nav = []

    for date in ordered_dates:
        baseline_value = statistics.fmean(
            _value_on_date(date, case["entry_date"], case["baseline"]["daily_multiples"], case["baseline"]["last_multiple"])
            for case in rendered_cases
        )
        routed_value = statistics.fmean(
            _value_on_date(date, case["entry_date"], case["routed"]["daily_multiples"], case["routed"]["last_multiple"])
            for case in rendered_cases
        )
        benchmark_value = statistics.fmean(
            _value_on_date(date, case["entry_date"], case["benchmark"]["daily_multiples"], case["benchmark"]["last_multiple"])
            for case in rendered_cases
        )
        baseline_nav.append((date, baseline_value))
        routed_nav.append((date, routed_value))
        benchmark_nav.append((date, benchmark_value))

    def _daily_returns(nav):
        return [(nav[i][1] / nav[i - 1][1]) - 1.0 for i in range(1, len(nav)) if nav[i - 1][1] != 0]

    baseline_total_return = baseline_nav[-1][1] - 1.0
    routed_total_return = routed_nav[-1][1] - 1.0
    benchmark_total_return = benchmark_nav[-1][1] - 1.0

    baseline_daily_returns = _daily_returns(baseline_nav)
    routed_daily_returns = _daily_returns(routed_nav)
    benchmark_daily_returns = _daily_returns(benchmark_nav)

    benchmark_symbols = sorted({case["benchmark"]["benchmark_symbol"] for case in rendered_cases})
    benchmark_names = sorted({case["benchmark"]["benchmark_name"] for case in rendered_cases})

    return {
        "sample_size": len(rendered_cases),
        "date_from": ordered_dates[0],
        "date_to": ordered_dates[-1],
        "benchmark_symbols": benchmark_symbols,
        "benchmark_names": benchmark_names,
        "baseline": {
            "total_return": baseline_total_return,
            "annualized_return": _annualized_return(baseline_total_return, len(baseline_nav)),
            "max_drawdown": _max_drawdown(baseline_nav),
            "annualized_volatility": _annualized_volatility(baseline_daily_returns),
            "sharpe_like": _sharpe_like(baseline_daily_returns),
        },
        "routed": {
            "total_return": routed_total_return,
            "annualized_return": _annualized_return(routed_total_return, len(routed_nav)),
            "max_drawdown": _max_drawdown(routed_nav),
            "annualized_volatility": _annualized_volatility(routed_daily_returns),
            "sharpe_like": _sharpe_like(routed_daily_returns),
        },
        "benchmark": {
            "total_return": benchmark_total_return,
            "annualized_return": _annualized_return(benchmark_total_return, len(benchmark_nav)),
            "max_drawdown": _max_drawdown(benchmark_nav),
            "annualized_volatility": _annualized_volatility(benchmark_daily_returns),
            "sharpe_like": _sharpe_like(benchmark_daily_returns),
        },
        "improvement_vs_baseline": routed_total_return - baseline_total_return,
        "excess_vs_benchmark": routed_total_return - benchmark_total_return,
        "baseline_excess_vs_benchmark": baseline_total_return - benchmark_total_return,
    }


def _round_tree(value):
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, dict):
        return {k: _round_tree(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_round_tree(v) for v in value]
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description="Build portfolio-level baseline for trade management")
    parser.add_argument("--cases-file", default=None)
    parser.add_argument("--preset", default=None)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    if not args.cases_file and not args.preset:
        raise SystemExit("provide --cases-file or --preset")

    cases = _load_cases(args)
    grouped = {"ALL": cases}
    markets = sorted({str(case["market"]) for case in cases})
    if len(markets) > 1:
        for market in markets:
            grouped[market] = [case for case in cases if str(case["market"]) == market]
    elif markets:
        grouped[markets[0]] = cases

    payload = {
        "as_of": date.today().isoformat(),
        "baseline_id": "trade_management_portfolio_baseline_v1",
        "scope": {
            "case_file": Path(args.cases_file).name if args.cases_file else None,
            "preset": args.preset,
            "capital_method": "equal_notional_per_case_with_idle_cash_before_entry",
            "interpretation": "Portfolio-level baseline over the formal case pool. Results compare routed trade management against same-entry buy-and-hold baseline and market-matched benchmark.",
            "routing_mode": "market_aware_v1",
            "market_routing_configs": {
                market: market_routing_config_to_dict(config)
                for market, config in MARKET_ROUTING_CONFIGS.items()
            },
        },
        "regions": {},
    }

    for key, subset in grouped.items():
        if not subset:
            continue
        payload["regions"][key] = _round_tree(_build_portfolio_metrics(subset))

    print(json.dumps(payload, ensure_ascii=False, indent=2))

    if args.output:
        out = Path(args.output)
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        print(f"\n# wrote {out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
