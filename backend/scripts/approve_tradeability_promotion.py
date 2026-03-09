"""
Approval artifact generator for tradeability promotion.

Purpose:
1) Turn a PASS verdict into an explicit approval artifact.
2) Require approver identity and rationale.
3) Persist approval audit before promotion execute.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, ROOT_DIR)



def _get_connection():
    try:
        from database import get_connection as get_db_connection  # type: ignore
        return get_db_connection()
    except ModuleNotFoundError as exc:
        if exc.name != "libsql":
            raise
        return sqlite3.connect(os.environ.get("DB_PATH") or ":memory:")


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_approval(
    *,
    verdict: Dict[str, Any],
    source_verdict_path: str,
    approver: str,
    reason: str,
    force: bool,
) -> Dict[str, Any]:
    if not force and verdict.get("promotion_gate_pass") is not True:
        raise ValueError("Promotion verdict is not PASS. Use --force to override.")
    return {
        "approval_id": str(uuid.uuid4()),
        "approved": True,
        "forced": force,
        "market": str(verdict.get("market") or ""),
        "candidate_version": str(verdict.get("candidate_version") or ""),
        "baseline_version": str(verdict.get("baseline_version") or ""),
        "source_verdict_path": source_verdict_path,
        "promotion_gate_pass": verdict.get("promotion_gate_pass") is True,
        "recommended_action": str(verdict.get("recommended_action") or ""),
        "default_mode_id": str(verdict.get("default_mode_id") or ""),
        "core_mode_gate_pass": verdict.get("core_mode_gate_pass") is True,
        "core_mode_effects": verdict.get("core_mode_effects") or {},
        "approver": approver,
        "reason": reason,
        "approved_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def _write_audit(approval: Dict[str, Any]) -> None:
    conn = _get_connection()
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
                approval["approval_id"],
                "promotion_approve",
                approval["market"],
                approval["candidate_version"],
                approval["baseline_version"],
                "approved",
                approval["source_verdict_path"],
                "approval",
                approval["approver"],
                json.dumps(approval, ensure_ascii=False),
                approval["approved_at"],
            ),
        )
        conn.commit()
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Create approval artifact for tradeability promotion.")
    parser.add_argument("--verdict-json", required=True, help="Promotion verdict json path.")
    parser.add_argument("--approver", required=True, help="Approver identity.")
    parser.add_argument("--reason", required=True, help="Approval reason.")
    parser.add_argument("--approval-json", required=True, help="Output approval artifact path.")
    parser.add_argument("--force", action="store_true", help="Allow approval even when verdict is not PASS.")
    args = parser.parse_args()

    verdict = _load_json(args.verdict_json)
    approval = build_approval(
        verdict=verdict,
        source_verdict_path=args.verdict_json,
        approver=args.approver.strip(),
        reason=args.reason.strip(),
        force=args.force,
    )
    os.makedirs(os.path.dirname(args.approval_json), exist_ok=True)
    with open(args.approval_json, "w", encoding="utf-8") as f:
        json.dump(approval, f, ensure_ascii=False, indent=2)
        f.write("\n")

    _write_audit(approval)
    print(f"Approval created: {approval['approval_id']}")
    print(f"Candidate version: {approval['candidate_version']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
