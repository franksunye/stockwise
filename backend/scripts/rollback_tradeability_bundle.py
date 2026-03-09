"""
Rollback entry for tradeability promotion.

Purpose:
1) Revert product config files to the previous strategy version.
2) Derive rollback target from the latest applied promotion audit when possible.
3) Persist rollback audit for dry-run and execute.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, ROOT_DIR)

from database import get_connection
from scripts.promote_tradeability_bundle import build_change_plan

DEFAULT_TARGET_FILES = [
    os.path.join(ROOT_DIR, "backend", "investment_mode.py"),
    os.path.join(ROOT_DIR, "frontend", "src", "lib", "investment-mode.ts"),
]


def _load_latest_applied_promotion(market: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT audit_id, market, candidate_version, baseline_version, summary_json, created_at
            FROM promotion_audit_log
            WHERE event_type = 'promotion_execute'
              AND outcome_status = 'applied'
              AND (? = '' OR market = ?)
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (market, market),
        )
        row = cur.fetchone()
        if not row:
            return None
        raw = dict(row) if isinstance(row, dict) else {
            "audit_id": row[0],
            "market": row[1],
            "candidate_version": row[2],
            "baseline_version": row[3],
            "summary_json": row[4],
            "created_at": row[5],
        }
        summary = json.loads(str(raw["summary_json"] or "{}"))
        return {
            "audit_id": str(raw["audit_id"]),
            "market": str(raw["market"] or ""),
            "candidate_version": str(raw["candidate_version"] or ""),
            "baseline_version": str(raw["baseline_version"] or ""),
            "summary": summary,
            "created_at": str(raw["created_at"] or ""),
        }
    finally:
        conn.close()


def _resolve_rollback_target(rollback_to_version: str, market: str) -> tuple[str, Optional[Dict[str, Any]]]:
    if rollback_to_version:
        return rollback_to_version, None
    latest = _load_latest_applied_promotion(market)
    if not latest:
        raise ValueError("No applied promotion audit found. Provide --rollback-to-version explicitly.")
    target = latest["baseline_version"]
    if not target:
        changed_files = latest["summary"].get("changed_files") or []
        previous_versions = set()
        for item in changed_files:
            for version in item.get("replaced_versions") or []:
                previous_versions.add(str(version))
        if len(previous_versions) == 1:
            target = next(iter(previous_versions))
    if not target:
        raise ValueError("Could not infer rollback target from latest promotion audit.")
    return target, latest


def _write_audit(
    *,
    market: str,
    candidate_version: str,
    baseline_version: str,
    outcome_status: str,
    actor: str,
    execution_mode: str,
    summary: Dict[str, Any],
) -> None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS promotion_audit_log (
                audit_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                market TEXT,
                candidate_version TEXT,
                baseline_version TEXT,
                outcome_status TEXT NOT NULL,
                source_verdict_path TEXT,
                execution_mode TEXT,
                actor TEXT,
                summary_json TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )
            """
        )
        cur.execute(
            """
            INSERT INTO promotion_audit_log
            (audit_id, event_type, market, candidate_version, baseline_version, outcome_status,
             source_verdict_path, execution_mode, actor, summary_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                "promotion_rollback",
                market,
                candidate_version,
                baseline_version,
                outcome_status,
                "",
                execution_mode,
                actor,
                json.dumps(summary, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Rollback tradeability strategy version in product config files.")
    parser.add_argument("--rollback-to-version", default="", help="Explicit rollback target version.")
    parser.add_argument("--market", default="", help="Market label for audit lookup.")
    parser.add_argument("--actor", default="manual:rollback_tradeability_bundle", help="Who executed rollback.")
    parser.add_argument("--execute", action="store_true", help="Apply rollback. Default is dry-run.")
    parser.add_argument(
        "--target-file",
        action="append",
        default=[],
        help="Optional target file override. Repeatable. Defaults to product config files.",
    )
    args = parser.parse_args()

    rollback_to_version, source_audit = _resolve_rollback_target(args.rollback_to_version.strip(), args.market.strip())
    target_files = args.target_file or DEFAULT_TARGET_FILES
    plan = build_change_plan(rollback_to_version, target_files)
    changed_files = [item for item in plan if item["changed"]]

    print(f"Rollback target version: {rollback_to_version}")
    if not changed_files:
        print("No source changes required. Product config already points to rollback target.")
        _write_audit(
            market=args.market.strip() or (source_audit or {}).get("market", ""),
            candidate_version=(source_audit or {}).get("candidate_version", ""),
            baseline_version=rollback_to_version,
            outcome_status="noop",
            actor=args.actor.strip(),
            execution_mode="execute" if args.execute else "dry_run",
            summary={
                "source_audit_id": None if source_audit is None else source_audit["audit_id"],
                "rollback_to_version": rollback_to_version,
                "target_files": [os.path.relpath(path, ROOT_DIR) for path in target_files],
                "changed_files": [],
            },
        )
        return 0

    for item in changed_files:
        rel = os.path.relpath(str(item["path"]), ROOT_DIR)
        print(f"- {rel}: replace {item['replaced_versions']} -> {rollback_to_version} ({item['count']} matches)")

    if not args.execute:
        print("Dry-run only. Re-run with --execute to apply rollback.")
        _write_audit(
            market=args.market.strip() or (source_audit or {}).get("market", ""),
            candidate_version=(source_audit or {}).get("candidate_version", ""),
            baseline_version=rollback_to_version,
            outcome_status="planned",
            actor=args.actor.strip(),
            execution_mode="dry_run",
            summary={
                "source_audit_id": None if source_audit is None else source_audit["audit_id"],
                "rollback_to_version": rollback_to_version,
                "target_files": [os.path.relpath(path, ROOT_DIR) for path in target_files],
                "changed_files": [
                    {
                        "path": os.path.relpath(str(item["path"]), ROOT_DIR),
                        "replaced_versions": item["replaced_versions"],
                        "count": item["count"],
                    }
                    for item in changed_files
                ],
            },
        )
        return 0

    for item in changed_files:
        with open(str(item["path"]), "w", encoding="utf-8") as f:
            f.write(str(item["updated_text"]))
    print("Rollback source changes applied.")
    _write_audit(
        market=args.market.strip() or (source_audit or {}).get("market", ""),
        candidate_version=(source_audit or {}).get("candidate_version", ""),
        baseline_version=rollback_to_version,
        outcome_status="applied",
        actor=args.actor.strip(),
        execution_mode="execute",
        summary={
            "source_audit_id": None if source_audit is None else source_audit["audit_id"],
            "rollback_to_version": rollback_to_version,
            "target_files": [os.path.relpath(path, ROOT_DIR) for path in target_files],
            "changed_files": [
                {
                    "path": os.path.relpath(str(item["path"]), ROOT_DIR),
                    "replaced_versions": item["replaced_versions"],
                    "count": item["count"],
                }
                for item in changed_files
            ],
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
