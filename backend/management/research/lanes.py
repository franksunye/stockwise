from __future__ import annotations

from dataclasses import asdict, dataclass

from backend.management.domain.position_state import PositionState
from backend.management.research.market_routing import (
    TradeManagementMarketRoutingConfig,
    get_market_routing_config,
    market_routing_config_to_dict,
)
from backend.management.research.path_classifier import (
    build_early_path_features,
    bucket_early_risk_score,
    classify_early_path_risk,
    compute_recovery_quality_score,
    recommend_policy_for_thresholds,
    score_early_path_risk,
)
from backend.trading_calendar import get_market_from_symbol


@dataclass(frozen=True)
class TradeManagementLane:
    lane_id: str
    label: str
    lookahead_days: int
    stage_status: str
    role: str
    target_problem: str
    when_to_use: str
    not_for: str


LANE_REGISTRY: dict[str, TradeManagementLane] = {
    "baseline_3d": TradeManagementLane(
        lane_id="baseline_3d",
        label="3-day baseline lane",
        lookahead_days=3,
        stage_status="baseline",
        role="first_pass_default",
        target_problem="作为当前全样本默认研究入口，优先处理高风险桶与整体默认规则。",
        when_to_use="默认先跑所有 case；当前没有额外 lane 条件时，也只使用这一条。",
        not_for="不负责专门修复低分端的假修复再转坏路径。",
    ),
    "low_risk_5d": TradeManagementLane(
        lane_id="low_risk_5d",
        label="5-day low-risk research lane",
        lookahead_days=5,
        stage_status="research_lane",
        role="second_pass_low_risk_review",
        target_problem="专门补看 3-day 下落在 score_low 的低分端，尤其是假修复再转坏与二次失真路径。",
        when_to_use="只在 baseline_3d 首轮判断为 score_low，或专项审计 low-side false negatives 时启用。",
        not_for="不替代 baseline_3d 的全样本默认入口，也不单独负责高风险即时退出判断。",
    ),
}

DEFAULT_LANE_IDS = ("baseline_3d", "low_risk_5d")


def get_lane(lane_id: str) -> TradeManagementLane:
    try:
        return LANE_REGISTRY[lane_id]
    except KeyError as exc:
        raise KeyError(f"unknown trade management lane: {lane_id}") from exc


def list_lanes() -> list[TradeManagementLane]:
    return [LANE_REGISTRY[lane_id] for lane_id in DEFAULT_LANE_IDS]


def resolve_routing_market(snapshots: list[PositionState], market: str | None = None) -> str:
    if market:
        return get_market_routing_config(market).market
    if snapshots:
        return get_market_routing_config(get_market_from_symbol(snapshots[0].symbol)).market
    return get_market_routing_config("CN").market


def should_activate_lane(
    lane_id: str,
    *,
    baseline_bucket: str | None,
    routing_config: TradeManagementMarketRoutingConfig | None = None,
) -> bool:
    config = routing_config or get_market_routing_config("CN")
    if lane_id == "baseline_3d":
        return True
    if lane_id == "low_risk_5d":
        return baseline_bucket == config.second_pass_activation_bucket
    raise KeyError(f"unknown trade management lane: {lane_id}")


def lane_to_dict(lane: TradeManagementLane) -> dict[str, str | int]:
    return asdict(lane)


def evaluate_lane(
    snapshots: list[PositionState],
    lane_id: str,
    *,
    routing_config: TradeManagementMarketRoutingConfig,
) -> dict[str, str | int | dict]:
    lane = get_lane(lane_id)
    features = build_early_path_features(snapshots, lookahead_days=lane.lookahead_days)
    score = score_early_path_risk(features)
    return {
        "lane_id": lane.lane_id,
        "label": lane.label,
        "lookahead_days": lane.lookahead_days,
        "stage_status": lane.stage_status,
        "role": lane.role,
        "early_risk_type": classify_early_path_risk(features),
        "early_risk_score": score,
        "early_risk_bucket": bucket_early_risk_score(score),
        "recovery_quality_score": compute_recovery_quality_score(features),
        "recommended_policy": recommend_policy_for_thresholds(
            score,
            routing_config.exit_all_threshold,
            routing_config.reduce_50_threshold,
        ),
        "features": features,
    }


def route_case_lanes(
    snapshots: list[PositionState],
    market: str | None = None,
    routing_config: TradeManagementMarketRoutingConfig | None = None,
) -> dict[str, object]:
    config = routing_config or get_market_routing_config(resolve_routing_market(snapshots, market))
    resolved_market = config.market

    baseline = evaluate_lane(snapshots, "baseline_3d", routing_config=config)
    active_lane_ids = ["baseline_3d"]
    second_pass = None
    final = baseline
    takeover_applied = False

    if should_activate_lane(
        "low_risk_5d",
        baseline_bucket=str(baseline["early_risk_bucket"]),
        routing_config=config,
    ):
        second_pass = evaluate_lane(snapshots, "low_risk_5d", routing_config=config)
        active_lane_ids.append("low_risk_5d")
        if (
            int(second_pass["early_risk_score"])
            >= config.second_pass_takeover_score_threshold
        ):
            final = second_pass
            takeover_applied = True

    return {
        "market": resolved_market,
        "routing_config_version": config.config_version,
        "routing_config": market_routing_config_to_dict(config),
        "active_lane_ids": active_lane_ids,
        "baseline": baseline,
        "second_pass": second_pass,
        "final": final,
        "takeover_applied": takeover_applied,
        "takeover_score_threshold": config.second_pass_takeover_score_threshold,
    }
