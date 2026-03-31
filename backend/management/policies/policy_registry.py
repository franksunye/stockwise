from __future__ import annotations

from backend.management.policies.fixed_discipline_exit import FixedDisciplineExitPolicy
from backend.management.policies.failure_risk_exit import FailureRiskExitPolicy
from backend.management.policies.failure_risk_reduce import FailureRiskReducePolicy
from backend.management.policies.hold_to_exit import HoldToExitPolicy
from backend.management.policies.partial_take_profit import PartialTakeProfitPolicy


def build_default_policies():
    return [
        HoldToExitPolicy(),
        PartialTakeProfitPolicy(policy_id="partial_take_profit_33", take_ratio=1.0 / 3.0),
        PartialTakeProfitPolicy(policy_id="partial_take_profit_50", take_ratio=0.5),
        FixedDisciplineExitPolicy(),
        FailureRiskReducePolicy(policy_id="failure_risk_reduce_33", reduce_ratio=1.0 / 3.0),
        FailureRiskReducePolicy(),
        FailureRiskExitPolicy(),
    ]
