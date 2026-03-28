from __future__ import annotations

from backend.management.domain.position_state import ManagementAction, PositionState
from backend.management.policies.base import ManagementPolicy, PolicyContext


class PartialTakeProfitPolicy(ManagementPolicy):
    def __init__(self, policy_id: str, take_ratio: float):
        self.policy_id = policy_id
        self.take_ratio = take_ratio

    def decide(self, position_state: PositionState, context: PolicyContext) -> list[ManagementAction]:
        if position_state.failed_breakout_risk and position_state.discipline_price:
            return [
                ManagementAction(
                    action="EXIT_ALL",
                    trigger_reason=f"失败风险抬升，跌破纪律位 {position_state.discipline_price:.2f}",
                    stop_price=position_state.discipline_price,
                )
            ]
        if position_state.state_id == "ProfitProtection" and not context.has_partial_exit:
            return [
                ManagementAction(
                    action="SELL_PART",
                    trigger_reason="进入盈利保护期，先锁定部分利润",
                    size_ratio=self.take_ratio,
                    target_price=position_state.resistance_price,
                )
            ]
        return [ManagementAction(action="HOLD", trigger_reason=f"状态={position_state.state_id}")]

