from __future__ import annotations

from backend.management.domain.position_state import ManagementAction, PositionState
from backend.management.policies.base import ManagementPolicy, PolicyContext


class FailureRiskReducePolicy(ManagementPolicy):
    def __init__(self, policy_id: str = "failure_risk_reduce_50", reduce_ratio: float = 0.5):
        self.policy_id = policy_id
        self.reduce_ratio = reduce_ratio

    def decide(self, position_state: PositionState, context: PolicyContext) -> list[ManagementAction]:
        risk_reduction_done = bool(context.state.get("failure_risk_reduction_done"))
        prior_failure_risk_date = context.state.get("last_failure_risk_date")

        if position_state.state_id == "FailureRisk" and not risk_reduction_done:
            context.state["failure_risk_reduction_done"] = True
            context.state["last_failure_risk_date"] = position_state.trade_date
            return [
                ManagementAction(
                    action="SELL_PART",
                    trigger_reason="进入 FailureRisk，先减仓一半控制回撤",
                    size_ratio=self.reduce_ratio,
                    stop_price=position_state.discipline_price,
                )
            ]

        if position_state.state_id == "FailureRisk" and risk_reduction_done and prior_failure_risk_date != position_state.trade_date:
            context.state["last_failure_risk_date"] = position_state.trade_date
            return [
                ManagementAction(
                    action="EXIT_ALL",
                    trigger_reason="减仓后 FailureRisk 仍持续，退出剩余仓位",
                    stop_price=position_state.discipline_price,
                )
            ]

        return [ManagementAction(action="HOLD", trigger_reason=f"状态={position_state.state_id}")]
