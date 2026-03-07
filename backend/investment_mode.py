from __future__ import annotations

from typing import Any, Dict

DEFAULT_MODE_ID = "balanced_v1"

MODE_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "steady_v1": {
        "mode_id": "steady_v1",
        "name": "稳健",
        "risk_band": "low",
        "strategy_version": "tradeability_v2",
        "params_bundle": "steady",
        "allowed_tiers": ("pro",),
        "observe_only": False,
    },
    "balanced_v1": {
        "mode_id": "balanced_v1",
        "name": "平衡",
        "risk_band": "medium",
        "strategy_version": "tradeability_v2",
        "params_bundle": "balanced",
        "allowed_tiers": ("free", "pro"),
        "observe_only": False,
    },
    "aggressive_v1": {
        "mode_id": "aggressive_v1",
        "name": "进取",
        "risk_band": "high",
        "strategy_version": "tradeability_v2",
        "params_bundle": "aggressive",
        "allowed_tiers": ("pro",),
        "observe_only": False,
    },
    "observe_only_v1": {
        "mode_id": "observe_only_v1",
        "name": "仅观察",
        "risk_band": "low",
        "strategy_version": "tradeability_v2",
        "params_bundle": "observe_only",
        "allowed_tiers": ("pro",),
        "observe_only": True,
    },
}


def get_mode_definition(mode_id: str) -> Dict[str, Any]:
    return dict(MODE_DEFINITIONS.get(mode_id) or MODE_DEFINITIONS[DEFAULT_MODE_ID])
