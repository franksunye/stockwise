from __future__ import annotations

from statistics import mean, median
from typing import Any, Dict, List

from backend.management.domain.position_state import PolicyResult


def summarize_results(results: List[PolicyResult]) -> Dict[str, Any]:
    if not results:
        return {"sample_size": 0}
    realized = [r.realized_pnl_pct for r in results if r.realized_pnl_pct is not None]
    drawdowns = [r.max_drawdown_pct for r in results if r.max_drawdown_pct is not None]
    givebacks = [r.profit_giveback_pct for r in results if r.profit_giveback_pct is not None]
    wins = [1 for r in results if r.win_flag]
    return {
        "sample_size": len(results),
        "avg_return": mean(realized) if realized else None,
        "median_return": median(realized) if realized else None,
        "win_rate": (len(wins) / len(results)) if results else None,
        "avg_max_drawdown": mean(drawdowns) if drawdowns else None,
        "avg_profit_giveback": mean(givebacks) if givebacks else None,
    }

