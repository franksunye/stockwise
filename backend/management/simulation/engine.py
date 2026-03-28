from __future__ import annotations

from typing import List

from backend.management.domain.position_state import PolicyResult, PositionState
from backend.management.policies.base import ManagementPolicy, PolicyContext


def simulate_policy(policy: ManagementPolicy, snapshots: List[PositionState]) -> PolicyResult:
    if not snapshots:
        raise ValueError("snapshots must not be empty")

    first = snapshots[0]
    current_size = first.position_size
    cash_realized = 0.0
    sold_size = 0.0
    action_log = []
    has_partial_exit = False
    exit_date = None
    exit_price = None
    policy_state = {}

    equity_curve = []
    peak_equity_pct = float("-inf")

    for snapshot in snapshots:
        if current_size <= 0:
            break
        snapshot.position_size = current_size
        snapshot.partial_exit_done = has_partial_exit
        context = PolicyContext(has_partial_exit=has_partial_exit, state=policy_state)
        actions = policy.decide(snapshot, context)
        for action in actions:
            if action.action == "SELL_PART" and action.size_ratio:
                qty = current_size * action.size_ratio
                cash_realized += qty * snapshot.close
                sold_size += qty
                current_size -= qty
                has_partial_exit = True
                action_log.append(
                    {
                        "date": snapshot.trade_date,
                        "action": action.action,
                        "size_ratio": action.size_ratio,
                        "price": snapshot.close,
                        "reason": action.trigger_reason,
                    }
                )
            elif action.action == "EXIT_ALL":
                cash_realized += current_size * snapshot.close
                sold_size += current_size
                current_size = 0.0
                exit_date = snapshot.trade_date
                exit_price = snapshot.close
                action_log.append(
                    {
                        "date": snapshot.trade_date,
                        "action": action.action,
                        "price": snapshot.close,
                        "reason": action.trigger_reason,
                    }
                )
                break

        equity_value = cash_realized + current_size * snapshot.close
        equity_pct = (equity_value - first.entry_price * first.position_size) / (first.entry_price * first.position_size)
        equity_curve.append(equity_pct)
        peak_equity_pct = max(peak_equity_pct, equity_pct)

    if current_size > 0:
        last = snapshots[-1]
        cash_realized += current_size * last.close
        sold_size += current_size
        exit_date = last.trade_date
        exit_price = last.close
        current_size = 0.0

    realized_pnl_pct = None
    if sold_size > 0 and first.entry_price > 0 and first.position_size > 0:
        realized_pnl_pct = (cash_realized - first.entry_price * first.position_size) / (first.entry_price * first.position_size)

    max_drawdown_pct = min(equity_curve) if equity_curve else None
    profit_giveback_pct = None
    if realized_pnl_pct is not None and peak_equity_pct != float("-inf"):
        profit_giveback_pct = max(0.0, peak_equity_pct - realized_pnl_pct)

    return PolicyResult(
        policy_id=policy.policy_id,
        symbol=first.symbol,
        entry_date=first.entry_date,
        exit_date=exit_date,
        entry_price=first.entry_price,
        exit_price=exit_price,
        realized_pnl_pct=realized_pnl_pct,
        max_drawdown_pct=max_drawdown_pct,
        profit_giveback_pct=profit_giveback_pct,
        holding_days=snapshots[-1].holding_days,
        win_flag=(realized_pnl_pct > 0) if realized_pnl_pct is not None else None,
        action_count=len(action_log),
        final_position_size=current_size,
        action_log=action_log,
        result_payload={"equity_curve": equity_curve},
    )
