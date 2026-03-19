"""
Probe broadcast endpoint health and persist metrics.

This script is designed for GitHub Actions cron runs.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

import requests

CURRENT_FILE = os.path.abspath(__file__)
SCRIPTS_DIR = os.path.dirname(CURRENT_FILE)
BACKEND_DIR = os.path.dirname(SCRIPTS_DIR)
ROOT_DIR = os.path.dirname(BACKEND_DIR)
for candidate in (ROOT_DIR, BACKEND_DIR):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

try:
    from backend.database import get_connection
    from backend.logger import logger
except ImportError:
    from database import get_connection  # type: ignore
    from logger import logger  # type: ignore


CREATE_HEALTH_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ops_broadcast_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    market TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    item_count INTEGER DEFAULT 0,
    ok INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    checked_at TEXT NOT NULL
)
"""


def _normalize_base_url(raw: str) -> str:
    value = raw.strip()
    if not value:
        return ""
    if not value.startswith("http://") and not value.startswith("https://"):
        value = f"https://{value}"
    return value.rstrip("/")


def _candidate_base_urls() -> List[str]:
    candidates: List[str] = []
    explicit_probe = _normalize_base_url(os.getenv("BROADCAST_PROBE_BASE_URL", ""))
    site_url = _normalize_base_url(os.getenv("NEXT_PUBLIC_SITE_URL", "https://ziso.cc"))

    for item in (explicit_probe, site_url):
        if item and item not in candidates:
            candidates.append(item)

    if site_url:
        parsed = urlparse(site_url)
        host = parsed.netloc.lower()
        scheme = parsed.scheme or "https"
        if host in ("ziso.cc", "www.ziso.cc"):
            app_variant = f"{scheme}://app.ziso.cc"
            if app_variant not in candidates:
                candidates.append(app_variant)
        elif host.startswith("app."):
            bare_variant = f"{scheme}://{host.removeprefix('app.')}"
            if bare_variant not in candidates:
                candidates.append(bare_variant)

    # Final safety fallback for production probing.
    default_app = "https://app.ziso.cc"
    if default_app not in candidates:
        candidates.append(default_app)

    return candidates


def _probe_one(base_url: str, market: str, timeout_sec: int) -> Tuple[int, int, int, int, str]:
    endpoint = f"/api/stock/prices/all?market={market}&limit=400"
    url = f"{base_url}{endpoint}"
    started = time.perf_counter()
    try:
        resp = requests.get(url, timeout=timeout_sec)
        latency_ms = int((time.perf_counter() - started) * 1000)
        status = int(resp.status_code)
        payload: Dict[str, Any] = {}
        item_count = 0
        error_message = ""
        try:
            payload = resp.json()
            items = payload.get("items")
            if isinstance(items, list):
                item_count = len(items)
            if status >= 400:
                error_message = str(payload.get("error") or payload.get("message") or "")[:500]
        except Exception:
            if status >= 400:
                error_message = (resp.text or "")[:500]
        ok = 1 if status == 200 and item_count > 0 else 0
        return status, latency_ms, item_count, ok, error_message
    except Exception as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        return 0, latency_ms, 0, 0, str(exc)[:500]


def main() -> int:
    base_urls = _candidate_base_urls()
    if not base_urls:
        logger.error("[BroadcastProbe] no candidate base url found")
        return 1

    timeout_sec = int(os.getenv("BROADCAST_PROBE_TIMEOUT_SEC", "12"))
    markets: List[str] = ["all", "hk", "cn"]
    checked_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(CREATE_HEALTH_TABLE_SQL)
        base_url = base_urls[0]
        # Choose first endpoint that is not a hard 404 for market=all.
        for candidate in base_urls:
            status, _, _, _, _ = _probe_one(candidate, "all", timeout_sec)
            if status != 404:
                base_url = candidate
                break
        logger.info("[BroadcastProbe] selected_base_url=%s candidates=%s", base_url, base_urls)

        results = []
        for market in markets:
            status, latency_ms, item_count, ok, error = _probe_one(base_url, market, timeout_sec)
            endpoint = "/api/stock/prices/all"
            cursor.execute(
                """
                INSERT INTO ops_broadcast_health (
                    endpoint, market, status_code, latency_ms, item_count, ok, error_message, checked_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (endpoint, market, status, latency_ms, item_count, ok, error, checked_at),
            )
            results.append(
                {
                    "market": market,
                    "status_code": status,
                    "latency_ms": latency_ms,
                    "item_count": item_count,
                    "ok": ok,
                    "error": error,
                }
            )

        conn.commit()
        logger.info("[BroadcastProbe] %s", json.dumps(results, ensure_ascii=True))
        # non-zero if any market probe is not healthy
        return 0 if all(r["ok"] == 1 for r in results) else 2
    except Exception as exc:
        logger.exception("[BroadcastProbe] failed error=%s", exc)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
