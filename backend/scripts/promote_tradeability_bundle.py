"""
Controlled promotion entry for tradeability strategy version.

Purpose:
1) Read a promotion verdict and validate candidate version.
2) Require an approval artifact before execute unless --force is used.
3) Apply source replacements with audit logging.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, ROOT_DIR)

from database import get_connection

DEFAULT_TARGET_FILES = [
    os.path.join(ROOT_DIR, "backend", "investment_mode.py"),
    os.path.join(ROOT_DIR, "frontend", "src", "lib", "investment-mode.ts"),
]
VERSION_PATTERN = re.compile(r"(strategy_version['\"]?\s*[:=]\s*['\"])(tradeability_v[0-9a-zA-Z._-]+)(['\"])")


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _resolve_target_files(target_files: List[str]) -> List[str]:
    return target_files or DEFAULT_TARGET_FILES


def _load_verdict(candidate_version: str, verdict_json: str) -> Dict[str, Any]:
    if verdict_json:
        payload = _load_json(verdict_json)
        if not candidate_version:
            candidate_version = str(payload.get("candidate_version") or "").strip()
        if not candidate_version:
            raise ValueError("candidate_version missing in verdict json.")
        return {
            "candidate_version": candidate_version,
            "market": str(payload.get("market") or "").strip(),
            "baseline_version": str(payload.get("baseline_version") or "").strip(),
            "promotion_gate_pass": payload.get("promotion_gate_pass") is True,
            "source_verdict_path": verdict_json,
        }
    if not candidate_version:
        raise ValueError("Either --candidate-version or --verdict-json is required.")
    return {
        "candidate_version": candidate_version,
        "market": "",
        "baseline_version": "",
        "promotion_gate_pass": False,
        "source_verdict_path": "",
    }


def _load_approval(approval_json: str) -> Dict[str, Any]:
    payload = _load_json(approval_json)
    if payload.get("approved") is not True:
        raise ValueError("Approval artifact is not approved.")
    return payload


def _validate_execute_guardrails(
    *,
    execute: bool,
    force: bool,
    approval_json: str,
    verdict: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    if not execute:
        return None
    if force:
        return None
    if not approval_json:
        raise ValueError("--execute requires --approval-json unless --force is provided.")
    approval = _load_approval(approval_json)
    if verdict["source_verdict_path"]:
        if str(approval.get("source_verdict_path") or "") != verdict["source_verdict_path"]:
            raise ValueError("Approval artifact does not match the provided verdict path.")
        if str(approval.get("candidate_version") or "") != verdict["candidate_version"]:
            raise ValueError("Approval artifact candidate_version mismatch.")
        if str(approval.get("baseline_version") or "") != str(verdict["baseline_version"] or ""):
            raise ValueError("Approval artifact baseline_version mismatch.")
        if str(approval.get("market") or "") != str(verdict["market"] or ""):
            raise ValueError("Approval artifact market mismatch.")
    return approval


def _replace_versions(text: str, candidate_version: str) -> tuple[str, int, List[str]]:
    replacements: List[str] = []

    def repl(match: re.Match[str]) -> str:
        before = match.group(2)
        replacements.append(before)
        return f"{match.group(1)}{candidate_version}{match.group(3)}"

    updated, count = VERSION_PATTERN.subn(repl, text)
    return updated, count, replacements


def build_change_plan(candidate_version: str, files: List[str]) -> List[Dict[str, object]]:
    plan: List[Dict[str, object]] = []
    for path in files:
        with open(path, "r", encoding="utf-8") as f:
            original = f.read()
        updated, count, replaced_versions = _replace_versions(original, candidate_version)
        plan.append(
            {
                "path": path,
                "count": count,
                "changed": updated != original,
                "replaced_versions": sorted(set(replaced_versions)),
                "updated_text": updated,
            }
        )
    return plan


def _apply_change_plan(plan: List[Dict[str, object]]) -> None:
    for item in plan:
        if not item["changed"]:
            continue
        with open(str(item["path"]), "w", encoding="utf-8") as f:
            f.write(str(item["updated_text"]))


def _write_audit(
    *,
    event_type: str,
    market: str,
    candidate_version: str,
    baseline_version: str,
    outcome_status: str,
    source_verdict_path: str,
    execution_mode: str,
    actor: str,
    summary: Dict[str, object],
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
                event_type,
                market,
                candidate_version,
                baseline_version,
                outcome_status,
                source_verdict_path,
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
    parser = argparse.ArgumentParser(description="Promote tradeability strategy version into product config files.")
    parser.add_argument("--candidate-version", default="", help="Target strategy version, e.g. tradeability_v2")
    parser.add_argument("--verdict-json", default="", help="Promotion verdict json path. Used if candidate version omitted.")
    parser.add_argument("--approval-json", default="", help="Approval artifact json. Required for --execute unless --force.")
    parser.add_argument("--market", default="", help="Market label for audit trail, e.g. CN or HK")
    parser.add_argument("--baseline-version", default="", help="Baseline strategy version for audit trail.")
    parser.add_argument("--actor", default="manual:promote_tradeability_bundle", help="Who executed the promotion step.")
    parser.add_argument("--execute", action="store_true", help="Apply source file changes. Default is dry-run.")
    parser.add_argument("--force", action="store_true", help="Bypass approval requirement for execute.")
    parser.add_argument(
        "--target-file",
        action="append",
        default=[],
        help="Optional target file override. Repeatable. Defaults to product config files.",
    )
    args = parser.parse_args()

    verdict = _load_verdict(args.candidate_version.strip(), args.verdict_json.strip())
    baseline_version = args.baseline_version.strip() or verdict["baseline_version"]
    market = args.market.strip() or verdict["market"]
    approval = _validate_execute_guardrails(
        execute=args.execute,
        force=args.force,
        approval_json=args.approval_json.strip(),
        verdict=verdict,
    )
    target_files = _resolve_target_files(args.target_file)
    plan = build_change_plan(verdict["candidate_version"], target_files)
    changed_files = [item for item in plan if item["changed"]]

    print(f"Candidate version: {verdict['candidate_version']}")
    if not changed_files:
        print("No source changes required. Product config already points to the candidate version.")
        _write_audit(
            event_type="promotion_execute",
            market=market,
            candidate_version=verdict["candidate_version"],
            baseline_version=baseline_version,
            outcome_status="noop",
            source_verdict_path=verdict["source_verdict_path"],
            execution_mode="execute" if args.execute else "dry_run",
            actor=args.actor.strip(),
            summary={
                "approval_id": None if approval is None else approval.get("approval_id"),
                "forced": args.force,
                "target_files": [os.path.relpath(path, ROOT_DIR) for path in target_files],
                "changed_files": [],
                "message": "No source changes required. Product config already points to candidate version.",
            },
        )
        return 0

    for item in changed_files:
        rel = os.path.relpath(str(item["path"]), ROOT_DIR)
        print(f"- {rel}: replace {item['replaced_versions']} -> {verdict['candidate_version']} ({item['count']} matches)")

    if not args.execute:
        print("Dry-run only. Re-run with --execute to apply changes.")
        _write_audit(
            event_type="promotion_execute",
            market=market,
            candidate_version=verdict["candidate_version"],
            baseline_version=baseline_version,
            outcome_status="planned",
            source_verdict_path=verdict["source_verdict_path"],
            execution_mode="dry_run",
            actor=args.actor.strip(),
            summary={
                "approval_id": None,
                "forced": args.force,
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

    _apply_change_plan(plan)
    print("Promotion source changes applied.")
    _write_audit(
        event_type="promotion_execute",
        market=market,
        candidate_version=verdict["candidate_version"],
        baseline_version=baseline_version,
        outcome_status="applied",
        source_verdict_path=verdict["source_verdict_path"],
        execution_mode="execute",
        actor=args.actor.strip(),
        summary={
            "approval_id": None if approval is None else approval.get("approval_id"),
            "forced": args.force,
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
