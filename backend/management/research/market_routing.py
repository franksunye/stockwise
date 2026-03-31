from __future__ import annotations

from dataclasses import asdict, dataclass


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


MARKET_ROUTING_CONFIGS: dict[str, TradeManagementMarketRoutingConfig] = {
    "CN": TradeManagementMarketRoutingConfig(
        market="CN",
        config_version="tm_market_routing_v1",
        default_lane_ids=("baseline_3d", "low_risk_5d"),
        second_pass_activation_bucket="score_low",
        second_pass_takeover_score_threshold=8,
        reduce_50_threshold=6,
        exit_all_threshold=10,
        positioning="risk_optimizer",
        rationale="A股当前正式定位更偏风险优化器，继续保持较早接管与较低防守阈值。",
    ),
    "HK": TradeManagementMarketRoutingConfig(
        market="HK",
        config_version="tm_market_routing_v1",
        default_lane_ids=("baseline_3d", "low_risk_5d"),
        second_pass_activation_bucket="score_low",
        second_pass_takeover_score_threshold=9,
        reduce_50_threshold=7,
        exit_all_threshold=11,
        positioning="trend_preserving_dual_improver",
        rationale="港股当前更值得保留趋势弹性，第二通道接管和防守阈值都更克制。",
    ),
}


def normalize_trade_management_market(value: str | None) -> str:
    text = str(value or "CN").strip().upper()
    return "HK" if text == "HK" else "CN"


def get_market_routing_config(market: str | None) -> TradeManagementMarketRoutingConfig:
    normalized = normalize_trade_management_market(market)
    return MARKET_ROUTING_CONFIGS[normalized]


def market_routing_config_to_dict(
    config: TradeManagementMarketRoutingConfig,
) -> dict[str, str | int | tuple[str, ...]]:
    return asdict(config)
