"""
Promote a locally backtested mode-params release into the production config file.

Purpose:
1) Accept a release artifact generated from local backtests.
2) Validate core mode bundles before publish.
3) Write a single config file with audit logging, without touching strategy-version promotion.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, ROOT_DIR)

DEFAULT_TARGET_FILE = os.path.join(ROOT_DIR, "backend", "strategy_config", "mode_params_bundles_v1.json")
REQUIRED_BUNDLES = ("steady", "balanced", "aggressive")
OPTIONAL_BUNDLES = ("observe_only",)
COMMON_PARAM_KEYS = (
    "vcp_ratio",
    "breakout_volume_mult",
    "strong_close_threshold",
    "momentum_change_threshold",
    "risk_off_ma",
)


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


def _normalize_params(raw: Dict[str, Any]) -> Dict[str, float]:
    normalized: Dict[str, float] = {}
    for key in COMMON_PARAM_KEYS:
        if key not in raw:
            continue
        value = float(raw[key])
        if key == "risk_off_ma":
            value = float(int(value))
            if int(value) not in {5, 10, 20}:
                raise ValueError("risk_off_ma must be one of 5/10/20.")
        normalized[key] = value
    return normalized


def _normalize_bundle_payload(name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    default_params = _normalize_params(dict(payload.get("default") or {}))
    market_map = {}
    for market, market_payload in dict(payload.get("markets") or {}).items():
        market_name = str(market).strip().upper()
        if not market_name:
            continue
        market_map[market_name] = _normalize_params(dict(market_payload or {}))
    return {
        "default": default_params,
        **({"markets": market_map} if market_map else {}),
    }


def _build_config(release: Dict[str, Any]) -> Dict[str, Any]:
    strategy_version = str(release.get("strategy_version") or "tradeability_v2").strip() or "tradeability_v2"
    bundles = dict(release.get("bundles") or {})
    missing = [name for name in REQUIRED_BUNDLES if name not in bundles]
    if missing:
        raise ValueError(f"release artifact missing required bundles: {', '.join(missing)}")

    normalized_bundles: Dict[str, Any] = {}
    for bundle_name in [*REQUIRED_BUNDLES, *OPTIONAL_BUNDLES]:
        payload = dict(bundles.get(bundle_name) or {})
        normalized_bundles[bundle_name] = _normalize_bundle_payload(bundle_name, payload)

    return {
        "config_version": str(release.get("config_version") or "mode_params_bundles_v1"),
        "strategy_version": strategy_version,
        "generated_at": str(release.get("generated_at") or ""),
        "source": dict(release.get("source") or {}),
        "window": dict(release.get("window") or {}),
        "research_performance": dict(release.get("research_performance") or {}),
        "selection_summary": dict(release.get("selection_summary") or {}),
        "production_effect": dict(release.get("production_effect") or {}),
        "bundles": normalized_bundles,
    }


def _write_json(path: str, payload: Dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _write_audit(
    *,
    outcome_status: str,
    actor: str,
    target_file: str,
    release_path: str,
    release: Dict[str, Any],
    execute: bool,
) -> None:
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
                str(uuid.uuid4()),
                "mode_params_release",
                str((release.get("source") or {}).get("market") or ""),
                str(release.get("strategy_version") or ""),
                "",
                outcome_status,
                release_path,
                "execute" if execute else "dry_run",
                actor,
                json.dumps(
                    {
                        "target_file": os.path.relpath(target_file, ROOT_DIR),
                        "bundles": sorted((release.get("bundles") or {}).keys()),
                        "generated_at": release.get("generated_at"),
                        "source": release.get("source"),
                    },
                    ensure_ascii=False,
                ),
                datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Promote local backtested mode params into production config.")
    parser.add_argument("--release-json", required=True, help="Mode params release artifact json path.")
    parser.add_argument("--target-file", default=DEFAULT_TARGET_FILE, help="Target config path.")
    parser.add_argument("--actor", default="manual:promote_mode_params_release", help="Who performed the release.")
    parser.add_argument("--execute", action="store_true", help="Apply file changes. Default is dry-run.")
    args = parser.parse_args()

    release_path = os.path.abspath(args.release_json)
    target_file = os.path.abspath(args.target_file)
    release = _build_config(_load_json(release_path))

    print(f"Target file: {os.path.relpath(target_file, ROOT_DIR)}")
    print(f"Strategy version: {release['strategy_version']}")
    print(f"Bundles: {', '.join(sorted((release.get('bundles') or {}).keys()))}")
    for bundle_name in REQUIRED_BUNDLES:
        bundle = (release.get("bundles") or {}).get(bundle_name) or {}
        default_keys = sorted((bundle.get("default") or {}).keys())
        market_keys = sorted((bundle.get("markets") or {}).keys())
        print(f"- {bundle_name}: default={default_keys or ['<inherit>']} markets={market_keys or ['<none>']}")

    if not args.execute:
        print("Dry-run only. Re-run with --execute to apply changes.")
        _write_audit(
            outcome_status="planned",
            actor=args.actor.strip(),
            target_file=target_file,
            release_path=release_path,
            release=release,
            execute=False,
        )
        return 0

    _write_json(target_file, release)
    print("Mode params release applied.")
    _write_audit(
        outcome_status="applied",
        actor=args.actor.strip(),
        target_file=target_file,
        release_path=release_path,
        release=release,
        execute=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
