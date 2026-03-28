from __future__ import annotations

from dataclasses import asdict, dataclass

from backend.management.domain.position_state import PositionState
from backend.management.research.path_classifier import (
    build_early_path_features,
    bucket_early_risk_score,
    classify_early_path_risk,
    compute_recovery_quality_score,
    recommend_policy_for_early_score,
    score_early_path_risk,
)


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
LOW_RISK_SECOND_PASS_TAKEOVER_SCORE = 8


def get_lane(lane_id: str) -> TradeManagementLane:
    try:
        return LANE_REGISTRY[lane_id]
    except KeyError as exc:
        raise KeyError(f"unknown trade management lane: {lane_id}") from exc


def list_lanes() -> list[TradeManagementLane]:
    return [LANE_REGISTRY[lane_id] for lane_id in DEFAULT_LANE_IDS]


def should_activate_lane(lane_id: str, *, baseline_bucket: str | None) -> bool:
    if lane_id == "baseline_3d":
        return True
    if lane_id == "low_risk_5d":
        return baseline_bucket == "score_low"
    raise KeyError(f"unknown trade management lane: {lane_id}")


def lane_to_dict(lane: TradeManagementLane) -> dict[str, str | int]:
    return asdict(lane)


def evaluate_lane(snapshots: list[PositionState], lane_id: str) -> dict[str, str | int | dict]:
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
        "recommended_policy": recommend_policy_for_early_score(score),
        "features": features,
    }


def route_case_lanes(snapshots: list[PositionState]) -> dict[str, object]:
    baseline = evaluate_lane(snapshots, "baseline_3d")
    active_lane_ids = ["baseline_3d"]
    second_pass = None
    final = baseline
    takeover_applied = False

    if should_activate_lane("low_risk_5d", baseline_bucket=str(baseline["early_risk_bucket"])):
        second_pass = evaluate_lane(snapshots, "low_risk_5d")
        active_lane_ids.append("low_risk_5d")
        if int(second_pass["early_risk_score"]) >= LOW_RISK_SECOND_PASS_TAKEOVER_SCORE:
            final = second_pass
            takeover_applied = True

    return {
        "active_lane_ids": active_lane_ids,
        "baseline": baseline,
        "second_pass": second_pass,
        "final": final,
        "takeover_applied": takeover_applied,
        "takeover_score_threshold": LOW_RISK_SECOND_PASS_TAKEOVER_SCORE,
    }
