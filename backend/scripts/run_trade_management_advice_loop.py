#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.management.live.service import run_trade_management_advice_loop


def main() -> int:
    parser = argparse.ArgumentParser(description="Run backend trade-management advice loop for active user positions.")
    parser.add_argument("--user-id", default=None)
    parser.add_argument("--symbol", default=None)
    parser.add_argument("--market", choices=["CN", "HK"], default=None)
    parser.add_argument("--notify", action="store_true", help="Send text cards to configured webhook and @ADMIN.")
    parser.add_argument("--persist-log", action="store_true", help="Persist advice cards into trade_management_advice_log.")
    parser.add_argument("--fail-on-errors", action="store_true", help="Return non-zero if any position fails.")
    args = parser.parse_args()

    result = run_trade_management_advice_loop(
        user_id=args.user_id,
        symbol=args.symbol,
        market=args.market,
        persist_log=args.persist_log,
        notify=args.notify,
    )

    print(
        json.dumps(
            {
                "processed_count": result.processed_count,
                "persisted_count": result.persisted_count,
                "delivered_count": result.delivered_count,
                "suppressed_count": result.suppressed_count,
                "failed_count": result.failed_count,
                "skipped_count": result.skipped_count,
                "errors": result.errors,
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    for card in result.cards:
        print("\n--- CARD ---")
        print(card)

    if args.fail_on_errors and result.failed_count > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
