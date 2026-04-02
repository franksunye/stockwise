from __future__ import annotations

from dataclasses import asdict, dataclass, replace


@dataclass(frozen=True)
class TradeManagementMarketRoutingConfig:
    market: str
    config_version: str
    default_lane_ids: tuple[str, ...]
    second_pass_activation_bucket: str
    second_pass_takeover_score_threshold: int
    reduce_50_threshold: int
    exit_all_threshold: int
    positioning: str
    rationale: str
    low_side_subtype_policies: dict[str, str] | None = None


MARKET_ROUTING_CONFIGS: dict[str, TradeManagementMarketRoutingConfig] = {
    "CN": TradeManagementMarketRoutingConfig(
        market="CN",
        config_version="tm_market_routing_v2",
        default_lane_ids=("baseline_3d", "low_risk_5d"),
        second_pass_activation_bucket="score_low",
        second_pass_takeover_score_threshold=8,
        reduce_50_threshold=6,
        exit_all_threshold=10,
        positioning="risk_optimizer",
        rationale="A股当前正式定位更偏风险优化器，继续保持较早接管与较低防守阈值。",
        low_side_subtype_policies=None,
    ),
    "HK": TradeManagementMarketRoutingConfig(
        market="HK",
        config_version="tm_market_routing_v5",
        default_lane_ids=("baseline_3d", "low_risk_5d"),
        second_pass_activation_bucket="score_low",
        second_pass_takeover_score_threshold=10,
        reduce_50_threshold=6,
        exit_all_threshold=10,
        positioning="trend_preserving_dual_improver",
        rationale="港股 v5 在保持趋势弹性的前提下，把 persistent_risk 进一步拆成 failure_loop / stress / false_stability 三类，用更细的低侧 policy family 提升收益/回撤平衡。",
        low_side_subtype_policies={
            "repair_candidate": "buy_and_hold_baseline",
            "weak_rebound": "partial_take_profit_50",
            "no_confirmation_drift": "failure_risk_exit_all",
            "persistent_failure_loop": "failure_risk_exit_all",
            "persistent_stress": "failure_risk_reduce_33",
            "persistent_false_stability": "failure_risk_exit_all",
        },
    ),
    "US": TradeManagementMarketRoutingConfig(
        market="US",
        config_version="tm_market_routing_us_v1",
        default_lane_ids=("baseline_3d", "low_risk_5d"),
        second_pass_activation_bucket="score_low",
        second_pass_takeover_score_threshold=10,
        reduce_50_threshold=5,
        exit_all_threshold=10,
        positioning="global_trend_optimizer",
        rationale="美股市场流动性极强且机构博弈充分，路由策略侧重于全球宏观趋势捕获与极致止损保护。",
        low_side_subtype_policies=None,
    ),
}


def normalize_trade_management_market(value: str | None) -> str:
    text = str(value or "CN").strip().upper()
    if text == "HK":
        return "HK"
    if text == "US" or text == "USA":
        return "US"
    return "CN"


def get_market_routing_config(market: str | None) -> TradeManagementMarketRoutingConfig:
    normalized = normalize_trade_management_market(market)
    return MARKET_ROUTING_CONFIGS[normalized]


def build_market_routing_config(
    market: str | None,
    *,
    config_version: str | None = None,
    second_pass_takeover_score_threshold: int | None = None,
    reduce_50_threshold: int | None = None,
    exit_all_threshold: int | None = None,
    positioning: str | None = None,
    rationale: str | None = None,
    low_side_subtype_policies: dict[str, str] | None = None,
) -> TradeManagementMarketRoutingConfig:
    base = get_market_routing_config(market)
    return replace(
        base,
        config_version=config_version or base.config_version,
        second_pass_takeover_score_threshold=(
            second_pass_takeover_score_threshold
            if second_pass_takeover_score_threshold is not None
            else base.second_pass_takeover_score_threshold
        ),
        reduce_50_threshold=(
            reduce_50_threshold if reduce_50_threshold is not None else base.reduce_50_threshold
        ),
        exit_all_threshold=(
            exit_all_threshold if exit_all_threshold is not None else base.exit_all_threshold
        ),
        positioning=positioning or base.positioning,
        rationale=rationale or base.rationale,
        low_side_subtype_policies=(
            low_side_subtype_policies
            if low_side_subtype_policies is not None
            else base.low_side_subtype_policies
        ),
    )


def market_routing_config_to_dict(
    config: TradeManagementMarketRoutingConfig,
) -> dict[str, str | int | tuple[str, ...]]:
    return asdict(config)
