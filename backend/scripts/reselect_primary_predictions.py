"""
Reselect primary predictions using confidence-aware model priority.

Purpose:
1) Repair historical ai_predictions_v2 primary flags with the current selector policy.
2) Prefer high-priority models that also meet confidence threshold.
3) Preserve one primary row per symbol/date/locale.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Tuple

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from backend.engine.runner import PRIMARY_CONFIDENCE_THRESHOLD, select_primary_prediction


def reselect_primary_predictions(start_date: str | None, end_date: str | None) -> Dict[str, object]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        rows = cur.execute(
            """
            SELECT p.symbol, p.date, COALESCE(p.content_locale, 'cn') AS content_locale,
                   p.model_id, p.confidence, p.is_primary, COALESCE(m.priority, 0) AS priority
            FROM ai_predictions_v2 p
            LEFT JOIN prediction_models m ON m.model_id = p.model_id
            WHERE (? IS NULL OR p.date >= ?)
              AND (? IS NULL OR p.date <= ?)
            ORDER BY p.date ASC, p.symbol ASC, content_locale ASC, priority DESC, p.model_id ASC
            """,
            (start_date, start_date, end_date, end_date),
        ).fetchall()

        grouped: Dict[Tuple[str, str, str], List[Dict[str, object]]] = defaultdict(list)
        for row in rows:
            grouped[(str(row[0]), str(row[1]), str(row[2]))].append(
                {
                    "symbol": str(row[0]),
                    "date": str(row[1]),
                    "content_locale": str(row[2]),
                    "model_id": str(row[3]),
                    "confidence": row[4],
                    "is_primary": int(row[5] or 0),
                    "priority": int(row[6] or 0),
                }
            )

        changed_groups = 0
        updated_rows = 0
        for (symbol, date_str, content_locale), items in grouped.items():
            model_priorities = {str(item["model_id"]): int(item["priority"]) for item in items}
            existing_primary = next((item for item in items if int(item["is_primary"]) == 1), None)
            selected = select_primary_prediction(
                items,
                model_priorities,
                existing_primary_model_id=None,
                existing_priority=-1,
                primary_promotion_blocked=False,
                confidence_threshold=PRIMARY_CONFIDENCE_THRESHOLD,
            )
            if not selected:
                continue
            existing_primary_id = None if existing_primary is None else str(existing_primary["model_id"])
            if existing_primary_id == selected:
                continue
            cur.execute(
                "UPDATE ai_predictions_v2 SET is_primary = 0 WHERE symbol = ? AND date = ? AND COALESCE(content_locale, 'cn') = ?",
                (symbol, date_str, content_locale),
            )
            cur.execute(
                "UPDATE ai_predictions_v2 SET is_primary = 1, updated_at = ? WHERE symbol = ? AND date = ? AND model_id = ? AND COALESCE(content_locale, 'cn') = ?",
                (datetime.now().isoformat(timespec="seconds"), symbol, date_str, selected, content_locale),
            )
            conn.commit()
            changed_groups += 1
            updated_rows += 2
        return {
            "start_date": start_date,
            "end_date": end_date,
            "groups_considered": len(grouped),
            "groups_changed": changed_groups,
            "rows_updated": updated_rows,
            "confidence_threshold": PRIMARY_CONFIDENCE_THRESHOLD,
        }
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Reselect historical primary predictions.")
    parser.add_argument("--start-date", default="")
    parser.add_argument("--end-date", default="")
    args = parser.parse_args()

    payload = reselect_primary_predictions(
        start_date=args.start_date or None,
        end_date=args.end_date or None,
    )
    logger.info(f"Primary reselection done: {payload}")
    print(payload)


if __name__ == "__main__":
    main()
