from __future__ import annotations

from backend.management.domain.position_state import ManagementAction, PositionState
from backend.management.policies.base import ManagementPolicy, PolicyContext


class FailureRiskExitPolicy(ManagementPolicy):
    policy_id = "failure_risk_exit_all"

    def decide(self, position_state: PositionState, context: PolicyContext) -> list[ManagementAction]:
        if position_state.state_id == "FailureRisk":
            return [
                ManagementAction(
                    action="EXIT_ALL",
                    trigger_reason="进入 FailureRisk，立即全部退出",
                    stop_price=position_state.discipline_price,
                )
            ]
        return [ManagementAction(action="HOLD", trigger_reason=f"状态={position_state.state_id}")]
