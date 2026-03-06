"""
Legacy backfill entrypoint.

This script is intentionally kept as a compatibility shim, but it now routes to
the production backfill pipeline (PredictionRunner-based) instead of ai_service.
"""

from __future__ import annotations

import argparse
import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.analysis.backfill import run_ai_analysis_backfill
from backend.logger import logger


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill historical predictions via main pipeline.")
    parser.add_argument("--symbol", type=str, default=None)
    parser.add_argument("--market", choices=["CN", "HK"], default=None)
    parser.add_argument("--start-date", type=str, default=None, help="YYYY-MM-DD")
    parser.add_argument("--end-date", type=str, default=None, help="YYYY-MM-DD")
    parser.add_argument("--days", type=int, default=None)
    parser.add_argument("--model", type=str, default="all")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    os.environ["DB_SOURCE"] = "local"
    logger.warning(
        "⚠️ backfill_real_history.py is a legacy wrapper; routing to run_ai_analysis_backfill + PredictionRunner."
    )

    stats = run_ai_analysis_backfill(
        symbol=args.symbol,
        market_filter=args.market,
        start_date=args.start_date,
        end_date=args.end_date,
        days=args.days,
        model_filter=args.model,
        force=args.force,
    )
    logger.info(f"✅ Backfill finished. stats={stats}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
