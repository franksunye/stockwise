from __future__ import annotations

from datetime import date

from backend.management.research.validation import (
    add_months,
    build_rolling_windows,
    evaluate_hk_validation_gate,
    summarize_rolling_metrics,
)


def test_add_months_handles_month_end() -> None:
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    assert add_months(date(2025, 1, 31), 1) == date(2025, 2, 28)


def test_build_rolling_windows_emits_monthly_6m_windows() -> None:
    cases = [
        {"entry_date": "2025-01-15"},
        {"entry_date": "2025-02-15"},
        {"entry_date": "2025-03-15"},
        {"entry_date": "2025-04-15"},
        {"entry_date": "2025-05-15"},
        {"entry_date": "2025-06-15"},
        {"entry_date": "2025-07-15"},
    ]

    windows = build_rolling_windows(cases, window_months=6, step_months=1, min_cases=3)

    assert windows[0].start_date == "2025-01-15"
    assert windows[0].end_date == "2025-07-14"
    assert windows[0].case_count == 6
    assert windows[1].start_date == "2025-02-15"


def test_summarize_rolling_metrics_reports_majority_improvement() -> None:
    summary = summarize_rolling_metrics(
        [
            {
                "improvement_vs_baseline": 0.01,
                "baseline_max_drawdown": -0.10,
                "routed_max_drawdown": -0.06,
            },
            {
                "improvement_vs_baseline": -0.001,
                "baseline_max_drawdown": -0.08,
                "routed_max_drawdown": -0.05,
            },
        ]
    )

    assert summary["window_count"] == 2
    assert summary["drawdown_improved_ratio"] == 1.0
    assert summary["median_improvement_vs_baseline"] == 0.0045


def test_evaluate_hk_validation_gate_requires_long_and_rolling_stability() -> None:
    gate = evaluate_hk_validation_gate(
        window_metrics={
            "24m": {
                "improvement_vs_baseline": 0.01,
                "baseline": {"max_drawdown": -0.10},
                "routed": {"max_drawdown": -0.06},
            },
            "36m": {
                "improvement_vs_baseline": 0.02,
                "baseline": {"max_drawdown": -0.12},
                "routed": {"max_drawdown": -0.07},
            },
        },
        rolling_summary={
            "drawdown_improved_ratio": 0.75,
            "median_improvement_vs_baseline": 0.001,
        },
        live_active_count=2,
        focus_review_count=1,
    )

    assert gate["eligible_for_hk_v3"] is True
    assert gate["verdict"] == "v2_validated_continue_observation"
