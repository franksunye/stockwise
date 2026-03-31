from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
import statistics
from typing import Iterable


@dataclass(frozen=True)
class RollingWindow:
    start_date: str
    end_date: str
    case_count: int


def add_months(value: date, months: int) -> date:
    month_index = (value.month - 1) + months
    year = value.year + month_index // 12
    month = (month_index % 12) + 1
    month_lengths = [31, 29 if _is_leap_year(year) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(value.day, month_lengths[month - 1])
    return date(year, month, day)


def build_rolling_windows(
    cases: list[dict],
    *,
    window_months: int = 6,
    step_months: int = 1,
    min_cases: int = 24,
) -> list[RollingWindow]:
    if not cases:
        return []

    entry_dates = sorted(date.fromisoformat(str(case["entry_date"])) for case in cases)
    start = entry_dates[0]
    last_entry = entry_dates[-1]
    windows: list[RollingWindow] = []

    while start <= last_entry:
        end_exclusive = add_months(start, window_months)
        subset = [
            case
            for case in cases
            if start <= date.fromisoformat(str(case["entry_date"])) < end_exclusive
        ]
        if subset:
            end_inclusive = end_exclusive - timedelta(days=1)
            if len(subset) >= min_cases:
                windows.append(
                    RollingWindow(
                        start_date=start.isoformat(),
                        end_date=end_inclusive.isoformat(),
                        case_count=len(subset),
                    )
                )
        start = add_months(start, step_months)

    return windows


def slice_cases_by_window(cases: list[dict], start_date: str, end_date: str) -> list[dict]:
    return [
        dict(case)
        for case in cases
        if start_date <= str(case["entry_date"]) <= end_date
    ]


def summarize_rolling_metrics(windows: Iterable[dict]) -> dict[str, float | int | None]:
    rows = list(windows)
    if not rows:
        return {
            "window_count": 0,
            "return_improved_count": 0,
            "drawdown_improved_count": 0,
            "dual_improved_count": 0,
            "return_improved_ratio": None,
            "drawdown_improved_ratio": None,
            "dual_improved_ratio": None,
            "median_improvement_vs_baseline": None,
        }

    return_improved_count = sum(1 for row in rows if float(row["improvement_vs_baseline"]) > 0)
    drawdown_improved_count = sum(
        1
        for row in rows
        if (row.get("baseline_max_drawdown") is not None and row.get("routed_max_drawdown") is not None)
        and float(row["routed_max_drawdown"]) > float(row["baseline_max_drawdown"])
    )
    dual_improved_count = sum(
        1
        for row in rows
        if float(row["improvement_vs_baseline"]) > 0
        and (row.get("baseline_max_drawdown") is not None and row.get("routed_max_drawdown") is not None)
        and float(row["routed_max_drawdown"]) > float(row["baseline_max_drawdown"])
    )
    improvements = [float(row["improvement_vs_baseline"]) for row in rows]
    return {
        "window_count": len(rows),
        "return_improved_count": return_improved_count,
        "drawdown_improved_count": drawdown_improved_count,
        "dual_improved_count": dual_improved_count,
        "return_improved_ratio": round(return_improved_count / len(rows), 4),
        "drawdown_improved_ratio": round(drawdown_improved_count / len(rows), 4),
        "dual_improved_ratio": round(dual_improved_count / len(rows), 4),
        "median_improvement_vs_baseline": round(statistics.median(improvements), 6),
    }


def evaluate_hk_validation_gate(
    *,
    window_metrics: dict[str, dict],
    rolling_summary: dict[str, float | int | None],
    live_active_count: int,
    focus_review_count: int,
) -> dict[str, object]:
    long_window_positive = all(
        float(window_metrics[name]["improvement_vs_baseline"]) > 0
        and float(window_metrics[name]["routed"]["max_drawdown"]) > float(window_metrics[name]["baseline"]["max_drawdown"])
        for name in ("24m", "36m")
    )

    drawdown_ratio = float(rolling_summary.get("drawdown_improved_ratio") or 0.0)
    median_improvement = float(rolling_summary.get("median_improvement_vs_baseline") or 0.0)
    rolling_stable = drawdown_ratio >= 0.6 and median_improvement >= -0.001

    live_ready = live_active_count > 0 and focus_review_count >= 0

    verdict = "hold_v2_and_observe"
    if long_window_positive and rolling_stable and live_ready:
        verdict = "v2_validated_continue_observation"
    if not long_window_positive or not rolling_stable:
        verdict = "fix_subtype_boundary_or_policy_mapping"

    return {
        "long_window_positive": long_window_positive,
        "rolling_stable": rolling_stable,
        "live_review_ready": live_ready,
        "eligible_for_hk_v3": bool(long_window_positive and rolling_stable and live_ready),
        "verdict": verdict,
        "notes": [
            "Long-window gate requires both 24m and 36m to beat same-entry buy-and-hold while keeping better max drawdown.",
            "Rolling gate requires majority drawdown improvement and no obvious return collapse.",
            "Live advice still needs manual language review; this gate only confirms the observation sample exists.",
        ],
    }


def summarize_subtype_outcomes(rows: Iterable[dict]) -> dict[str, dict[str, object]]:
    grouped_returns: dict[str, list[float]] = defaultdict(list)
    grouped_wins: dict[str, int] = defaultdict(int)
    policy_counts: dict[str, Counter[str]] = defaultdict(Counter)

    for row in rows:
        subtype = str(row["subtype"])
        policy = str(row["chosen_policy"])
        realized = float(row["realized_pnl_pct"])
        grouped_returns[subtype].append(realized)
        policy_counts[subtype][policy] += 1
        if realized > 0:
            grouped_wins[subtype] += 1

    summary: dict[str, dict[str, object]] = {}
    for subtype, returns in grouped_returns.items():
        dominant_policy, dominant_count = policy_counts[subtype].most_common(1)[0]
        summary[subtype] = {
            "case_count": len(returns),
            "avg_realized_pnl_pct": round(sum(returns) / len(returns), 6),
            "median_realized_pnl_pct": round(statistics.median(returns), 6),
            "win_rate": round(grouped_wins[subtype] / len(returns), 4),
            "dominant_policy": dominant_policy,
            "dominant_policy_count": dominant_count,
            "policy_counts": dict(policy_counts[subtype]),
        }
    return summary


def _is_leap_year(value: int) -> bool:
    return value % 4 == 0 and (value % 100 != 0 or value % 400 == 0)
