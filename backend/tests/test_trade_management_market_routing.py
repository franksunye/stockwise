from __future__ import annotations

from unittest.mock import patch

from backend.management.domain.position_state import PositionState
from backend.management.research.lanes import route_case_lanes
from backend.management.research.market_routing import build_market_routing_config


def _high_risk_snapshots() -> list[PositionState]:
    return [
        PositionState(
            symbol="02171",
            trade_date="2026-03-20",
            entry_date="2026-03-20",
            entry_price=15.0,
            position_size=3000.0,
            holding_days=0,
            close=15.0,
            high=15.05,
            low=14.92,
            volume=100.0,
            unrealized_pnl_pct=0.0,
            mfe_pct=0.0,
            mae_pct=0.0,
            signal_state="NoSetup",
            confidence=0.82,
            support_price=14.85,
            resistance_price=15.12,
            discipline_price=14.85,
            breakout_confirmed=False,
            near_resistance=False,
            failed_breakout_risk=False,
            volume_followthrough=False,
            state_id="EntryTriggered",
        ),
        PositionState(
            symbol="02171",
            trade_date="2026-03-21",
            entry_date="2026-03-20",
            entry_price=15.0,
            position_size=3000.0,
            holding_days=1,
            close=14.72,
            high=14.88,
            low=14.68,
            volume=102.0,
            unrealized_pnl_pct=-0.0187,
            mfe_pct=0.003,
            mae_pct=-0.021,
            signal_state="RiskOff",
            confidence=0.68,
            support_price=14.6,
            resistance_price=14.95,
            discipline_price=14.6,
            breakout_confirmed=False,
            near_resistance=False,
            failed_breakout_risk=False,
            volume_followthrough=False,
            state_id="FailureRisk",
        ),
        PositionState(
            symbol="02171",
            trade_date="2026-03-24",
            entry_date="2026-03-20",
            entry_price=15.0,
            position_size=3000.0,
            holding_days=4,
            close=14.66,
            high=14.79,
            low=14.61,
            volume=98.0,
            unrealized_pnl_pct=-0.0227,
            mfe_pct=0.003,
            mae_pct=-0.026,
            signal_state="RiskOff",
            confidence=0.67,
            support_price=14.55,
            resistance_price=14.86,
            discipline_price=14.55,
            breakout_confirmed=False,
            near_resistance=False,
            failed_breakout_risk=False,
            volume_followthrough=False,
            state_id="FailureRisk",
        ),
    ]


def test_hk_routing_v2_keeps_same_high_risk_exit_but_uses_higher_takeover_gate() -> None:
    snapshots = _high_risk_snapshots()

    cn_route = route_case_lanes(snapshots, market="CN")
    hk_route = route_case_lanes(snapshots, market="HK")

    assert cn_route["baseline"]["early_risk_score"] == hk_route["baseline"]["early_risk_score"] == 10
    assert cn_route["final"]["recommended_policy"] == "failure_risk_exit_all"
    assert hk_route["final"]["recommended_policy"] == "failure_risk_exit_all"
    assert cn_route["routing_config"]["exit_all_threshold"] == 10
    assert hk_route["routing_config"]["exit_all_threshold"] == 10
    assert hk_route["routing_config"]["second_pass_takeover_score_threshold"] == 10


def test_hk_second_pass_requires_higher_takeover_score_than_cn() -> None:
    snapshots = _high_risk_snapshots()
    baseline = {
        "lane_id": "baseline_3d",
        "early_risk_bucket": "score_low",
        "early_risk_score": 5,
        "recommended_policy": "buy_and_hold_baseline",
    }
    second_pass = {
        "lane_id": "low_risk_5d",
        "early_risk_bucket": "score_medium",
        "early_risk_score": 8,
        "recommended_policy": "failure_risk_reduce_50",
    }

    with patch(
        "backend.management.research.lanes.evaluate_lane",
        side_effect=[baseline, second_pass],
    ):
        cn_route = route_case_lanes(snapshots, market="CN")

    with patch(
        "backend.management.research.lanes.evaluate_lane",
        side_effect=[baseline, second_pass],
    ):
        hk_route = route_case_lanes(snapshots, market="HK")

    assert cn_route["takeover_applied"] is True
    assert cn_route["final"]["lane_id"] == "low_risk_5d"
    assert hk_route["takeover_applied"] is False
    assert hk_route["final"]["lane_id"] == "baseline_3d"


def test_explicit_routing_config_override_is_honored() -> None:
    snapshots = _high_risk_snapshots()
    custom_hk = build_market_routing_config(
        "HK",
        config_version="tm_hk_custom_test",
        reduce_50_threshold=6,
        exit_all_threshold=10,
    )

    route = route_case_lanes(snapshots, market="HK", routing_config=custom_hk)

    assert route["routing_config_version"] == "tm_hk_custom_test"
    assert route["final"]["recommended_policy"] == "failure_risk_exit_all"
