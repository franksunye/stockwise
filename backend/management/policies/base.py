from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Protocol

from backend.management.domain.position_state import ManagementAction, PositionState


@dataclass
class PolicyContext:
    has_partial_exit: bool = False
    state: Dict[str, Any] = field(default_factory=dict)


class ManagementPolicy(Protocol):
    policy_id: str

    def decide(self, position_state: PositionState, context: PolicyContext) -> list[ManagementAction]:
        ...

