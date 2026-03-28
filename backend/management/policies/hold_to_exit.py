from __future__ import annotations

from backend.management.domain.position_state import ManagementAction, PositionState
from backend.management.policies.base import ManagementPolicy, PolicyContext


class HoldToExitPolicy(ManagementPolicy):
    policy_id = "buy_and_hold_baseline"

    def decide(self, position_state: PositionState, context: PolicyContext) -> list[ManagementAction]:
        if position_state.failed_breakout_risk and position_state.discipline_price:
            return [
                ManagementAction(
                    action="EXIT_ALL",
                    trigger_reason=f"跌破纪律位 {position_state.discipline_price:.2f}",
                    stop_price=position_state.discipline_price,
                )
            ]
        return [ManagementAction(action="HOLD", trigger_reason=f"状态={position_state.state_id}")]

