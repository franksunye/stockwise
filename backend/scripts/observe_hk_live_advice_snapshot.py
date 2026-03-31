#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import date
import json
import os
import sys
from collections import Counter
from pathlib import Path


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("DB_SOURCE", "local")

from backend.management.live.card_formatter import build_advice_record
from backend.management.research.lanes import route_case_lanes
from backend.management.storage.live_repo import list_active_trade_positions
from backend.management.state.snapshot_builder import build_position_snapshots
from backend.trading_calendar import get_next_trading_day_str


FOCUS_SUBTYPES = {"persistent_false_stability", "persistent_failure_loop", "persistent_stress"}


def _summary_mismatch(policy: str, summary: str) -> bool:
    text = summary.strip()
    if policy == "failure_risk_exit_all":
        return "退出" not in text and "离场" not in text
    if policy in {"failure_risk_reduce_33", "failure_risk_reduce_50"}:
        return "减仓" not in text
    if policy in {"partial_take_profit_33", "partial_take_profit_50"}:
        return "止盈" not in text and "兑现" not in text
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Observe current HK live advice surface for active positions")
    parser.add_argument("--user-id", default=None)
    parser.add_argument("--symbol", default=None)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    positions = list_active_trade_positions(user_id=args.user_id, symbol=args.symbol, market="HK")
    subtype_counts: Counter[str] = Counter()
    policy_counts: Counter[str] = Counter()
    state_counts: Counter[str] = Counter()
    action_summary_counts: Counter[str] = Counter()
    summary_mismatch_count = 0
    focus_reviews: list[dict[str, object]] = []
    cards_preview: list[dict[str, object]] = []

    for position in positions:
        snapshots = build_position_snapshots(
            symbol=position.symbol,
            entry_date=position.entry_date,
            entry_price=position.entry_price,
            position_size=position.remaining_size,
        )
        if not snapshots:
            continue

        latest = snapshots[-1]
        route = route_case_lanes(snapshots, market="HK")
        final = route["final"]
        next_trade_date = get_next_trading_day_str(latest.trade_date, symbol=position.symbol, market="HK")
        record = build_advice_record(
            position=position,
            snapshot=latest,
            next_trade_date=next_trade_date,
            lane_id=str(final["lane_id"]),
            recommended_policy=str(final["recommended_policy"]),
            advice_id="observation-only",
        )

        subtype = str(route.get("low_side_subtype") or "none")
        policy = str(final["recommended_policy"])
        state = str(latest.state_id or "unknown")
        summary = str(record.action_summary or "")

        subtype_counts[subtype] += 1
        policy_counts[policy] += 1
        state_counts[state] += 1
        action_summary_counts[summary] += 1

        preview_row = {
            "symbol": position.symbol,
            "stock_name": position.stock_name,
            "state_id": state,
            "subtype": subtype,
            "recommended_policy": policy,
            "action_summary": summary,
            "summary_mismatch": _summary_mismatch(policy, summary),
            "unrealized_pnl_pct": round(float(latest.unrealized_pnl_pct or 0.0), 6),
            "remaining_size": position.remaining_size,
        }
        if bool(preview_row["summary_mismatch"]):
            summary_mismatch_count += 1
        cards_preview.append(preview_row)

        if subtype in FOCUS_SUBTYPES:
            focus_reviews.append(
                {
                    **preview_row,
                    "action_detail": str(record.extra_payload.get("action_detail") or ""),
                    "discipline_price": record.discipline_price,
                    "observation_price": record.extra_payload.get("observation_price"),
                    "lane_id": final["lane_id"],
                }
            )

    payload = {
        "as_of": date.today().isoformat(),
        "observation_id": "hk_live_advice_snapshot_v1",
        "active_position_count": len(positions),
        "sample_note": (
            "Current local HK active positions are limited; this artifact is an observation snapshot, not a large-sample live verdict."
        ),
        "subtype_counts": dict(subtype_counts),
        "policy_counts": dict(policy_counts),
        "state_counts": dict(state_counts),
        "action_summary_counts": dict(action_summary_counts),
        "summary_mismatch_count": summary_mismatch_count,
        "focus_review_subtypes": sorted(FOCUS_SUBTYPES),
        "focus_reviews": focus_reviews,
        "preview": cards_preview[:20],
    }

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if args.output:
        Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n# wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
