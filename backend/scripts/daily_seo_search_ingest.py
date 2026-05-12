"""
Daily SEO search performance ingest (Google Search Console → seo_search_performance).

Convention (matches daily_growth_digest.py):
  • Service-account JWT against Google OAuth `token_uri` (same credential file pattern as GA4).
  • `get_connection()` → Turso/cloud or local SQLite, `ensure_*` + INSERT … ON CONFLICT.
  • CLI `--persist` to write; omit to dry-run counts only.

Requires:
  • Search Console API enabled for the GCP project of the SA.
  • In GSC, add the service account email (reader) on the relevant property.

Env:
  GSC_CREDENTIALS_PATH   Path to SA JSON (falls back to GA4_CREDENTIALS_PATH).
  GSC_SITE_SCOPE         Property id exactly as shown in SC (e.g. sc-domain:example.com or https://example.com/).
  GSC_INCLUDE_QUERIES    If "1"|"true"|"yes", also pull date × page × query rows (heavy).
  DB_SOURCE              cloud + TURSO_* for production jobs.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import quote, urlparse

import requests
from requests import Response
from requests.exceptions import RequestException

# Ensure imports from backend/
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_SCRIPT_DIR)
_ROOT_DIR = os.path.dirname(_BACKEND_DIR)
if _ROOT_DIR not in sys.path:
    sys.path.insert(0, _ROOT_DIR)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

_ENV_PATH = os.path.join(_BACKEND_DIR, ".env")


def load_env_file(env_path: str) -> None:
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            os.environ[key.strip()] = val.strip().strip('"').strip("'")


load_env_file(_ENV_PATH)

BEIJING_TZ = timezone(timedelta(hours=8))
GSC_ROWS_URL = "https://www.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query"
WEBMASTERS_READONLY = "https://www.googleapis.com/auth/webmasters.readonly"

SEO_TABLE = "seo_search_performance"

from database import get_connection  # noqa: E402


@contextmanager
def force_ipv4_requests():
    from urllib3.util import connection as urllib3_connection

    original = urllib3_connection.HAS_IPV6
    try:
        urllib3_connection.HAS_IPV6 = False
        yield
    finally:
        urllib3_connection.HAS_IPV6 = original


def _b64url(data: bytes) -> bytes:
    return base64.urlsafe_b64encode(data).rstrip(b"=")


def _build_service_account_jwt(credentials: Dict[str, Any], scope: str) -> str:
    header = {"alg": "RS256", "typ": "JWT"}
    now = int(time.time())
    claim = {
        "iss": credentials["client_email"],
        "scope": scope,
        "aud": credentials["token_uri"],
        "exp": now + 3600,
        "iat": now,
    }
    signing_input = b".".join(
        [
            _b64url(json.dumps(header, separators=(",", ":")).encode()),
            _b64url(json.dumps(claim, separators=(",", ":")).encode()),
        ]
    )

    with tempfile.NamedTemporaryFile("w", delete=False) as keyf:
        keyf.write(credentials["private_key"])
        key_path = keyf.name

    try:
        signature = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_path],
            input=signing_input,
            capture_output=True,
            check=True,
        ).stdout
    finally:
        os.unlink(key_path)

    return (signing_input + b"." + _b64url(signature)).decode()


def _request_with_retry(method: str, url: str, *, attempts: int = 3, backoff_seconds: float = 1.5, **kwargs) -> Response:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with force_ipv4_requests():
                response = requests.request(method, url, **kwargs)
            response.raise_for_status()
            return response
        except RequestException as exc:
            last_error = exc
            if attempt == attempts:
                raise
            time.sleep(backoff_seconds * attempt)

    if last_error is not None:
        raise last_error
    raise RuntimeError(f"Request failed without exception: {method.upper()} {url}")


def get_access_token(credentials_path: str, scope: str) -> str:
    with open(credentials_path, "r", encoding="utf-8") as f:
        credentials = json.load(f)
    jwt = _build_service_account_jwt(credentials, scope)
    response = _request_with_retry(
        "post",
        credentials["token_uri"],
        data={
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": jwt,
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def normalize_canonical_path(raw: str) -> str:
    t = raw.strip()
    if not t:
        return "/"
    if "://" in t:
        path = urlparse(t).path or "/"
        t = path
    no_query = (t.split("?")[0].split("#")[0]) if t else "/"
    p = no_query if no_query.startswith("/") else "/" + no_query
    if len(p) > 1:
        p = p.rstrip("/")
    return "/" if not p else p


def _encode_ctr(raw: Optional[float]) -> Optional[float]:
    if raw is None:
        return None
    x = float(raw)
    if x > 1.0:
        x = max(0.0, min(1.0, x / 100.0))
    return max(0.0, min(1.0, x))


def ensure_seo_search_performance(cursor) -> None:
    cursor.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {SEO_TABLE} (
            report_date TEXT NOT NULL,
            source TEXT NOT NULL CHECK (source IN ('gsc', 'bing')),
            granularity TEXT NOT NULL CHECK (granularity IN ('page', 'query')),
            site_scope TEXT NOT NULL,
            page_path TEXT NOT NULL,
            search_query TEXT NOT NULL,
            impressions INTEGER NOT NULL DEFAULT 0 CHECK (impressions >= 0),
            clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
            ctr REAL CHECK (ctr IS NULL OR (ctr >= 0 AND ctr <= 1)),
            position REAL CHECK (position IS NULL OR position >= 0),
            ingest_run_id TEXT,
            raw_json TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
            PRIMARY KEY (report_date, source, granularity, site_scope, page_path, search_query)
        )
        """
    )
    cursor.execute(
        """CREATE INDEX IF NOT EXISTS idx_seo_search_perf_path_date
           ON seo_search_performance(page_path, report_date DESC)"""
    )
    cursor.execute(
        """CREATE INDEX IF NOT EXISTS idx_seo_search_perf_scope_date
           ON seo_search_performance(site_scope, report_date DESC)"""
    )


def upsert_sql() -> str:
    return f"""
      INSERT INTO {SEO_TABLE} (
        report_date, source, granularity, site_scope, page_path, search_query,
        impressions, clicks, ctr, position, ingest_run_id, raw_json, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours')
      )
      ON CONFLICT(report_date, source, granularity, site_scope, page_path, search_query)
      DO UPDATE SET
        impressions = excluded.impressions,
        clicks = excluded.clicks,
        ctr = excluded.ctr,
        position = excluded.position,
        ingest_run_id = excluded.ingest_run_id,
        raw_json = excluded.raw_json,
        updated_at = datetime('now', '+8 hours')
    """


def gsc_site_rows_to_upserts(
    site_scope: str,
    ingest_run_id: str,
    *,
    granularity: str,
    api_rows: Iterable[Dict[str, Any]],
    raw_fallback: Dict[str, Any],
) -> List[Tuple]:
    tuples: List[Tuple] = []
    for api_row in api_rows:
        keys = api_row.get("keys") or []
        impressions = int(float(api_row.get("impressions") or 0))
        clicks = int(float(api_row.get("clicks") or 0))
        ctr = _encode_ctr(api_row.get("ctr")) if impressions or clicks else None
        position = api_row.get("position")
        pos_val = float(position) if position is not None else None

        raw_one = dict(raw_fallback)
        raw_one.update({"row": api_row})

        report_date_str = ""
        page_key = ""
        query_key = ""

        if granularity == "page":
            if len(keys) < 2:
                continue
            report_date_str, page_key = str(keys[0]), str(keys[1])
            path = normalize_canonical_path(page_key)
            search_query = ""
        else:
            if len(keys) < 3:
                continue
            report_date_str, page_key, raw_q = str(keys[0]), str(keys[1]), str(keys[2])
            path = normalize_canonical_path(page_key)
            query_key = raw_q.strip().lower()
            if not query_key:
                continue
            search_query = query_key

        tuples.append(
            (
                report_date_str,
                "gsc",
                granularity,
                site_scope.strip() or "unset",
                path,
                search_query,
                impressions,
                clicks,
                ctr,
                pos_val,
                ingest_run_id,
                json.dumps(raw_one, ensure_ascii=False),
            )
        )

    return tuples


def iterate_all_gsc_pages(
    site_scope: str,
    access_token: str,
    start_date: str,
    end_date: str,
    dimensions: Sequence[str],
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    start_row = 0
    chunk = 25000
    while True:
        enc = quote(site_scope, safe="")
        url = GSC_ROWS_URL.format(site=enc)
        body: Dict[str, Any] = {
            "startDate": start_date,
            "endDate": end_date,
            "dimensions": list(dimensions),
            "rowLimit": chunk,
            "startRow": start_row,
            "aggregationType": "auto",
        }
        r = _request_with_retry(
            "post",
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=120,
        )
        payload = r.json()
        chunk_rows = payload.get("rows") or []
        out.extend(chunk_rows)
        if len(chunk_rows) < chunk:
            break
        start_row += chunk
    return out


def beijing_span(*, lag_days_end: int, window_days: int) -> Tuple[str, str]:
    """Return [start,end] YYYY-MM-DD in calendar dates (Beijing).

    End is (today Beijing) minus lag_days_end (default skips fresh incomplete GSC lag).
    """
    today = datetime.now(BEIJING_TZ).date()
    end_d = today - timedelta(days=max(1, lag_days_end))
    start_d = end_d - timedelta(days=max(1, window_days) - 1)
    return start_d.strftime("%Y-%m-%d"), end_d.strftime("%Y-%m-%d")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Search Console analytics into seo_search_performance.")
    parser.add_argument("--persist", action="store_true", help="Write rows via get_connection().")
    parser.add_argument(
        "--lag-days",
        type=int,
        default=int(os.getenv("GSC_LAG_DAYS") or "2"),
        help="Treat last N Beijing calendar days as incomplete (end date = today - lag). Default 2.",
    )
    parser.add_argument(
        "--window-days",
        type=int,
        default=int(os.getenv("GSC_WINDOW_DAYS") or "56"),
        help="How many days of history ending at computed end date. Default 56.",
    )
    parser.add_argument(
        "--credentials",
        default=os.getenv("GSC_CREDENTIALS_PATH") or os.getenv("GA4_CREDENTIALS_PATH"),
        help="Service account JSON path (defaults env GSC_CREDENTIALS_PATH or GA4_CREDENTIALS_PATH).",
    )
    parser.add_argument("--site-scope", default=os.getenv("GSC_SITE_SCOPE"), help="Search Console property id (env GSC_SITE_SCOPE).")
    parser.add_argument(
        "--include-queries",
        action="store_true",
        help="Pull query rows (date × page × query). Overrides env unless omitted; env GSC_INCLUDE_QUERIES=1 enables without flag.",
    )
    args = parser.parse_args()

    include_queries = args.include_queries or (
        os.getenv("GSC_INCLUDE_QUERIES", "").strip().lower() in {"1", "true", "yes", "on"}
    )

    site_scope_s = str(args.site_scope or "").strip()
    cred_path = str(args.credentials or "").strip()

    if not cred_path:
        raise SystemExit("Missing --credentials / GSC_CREDENTIALS_PATH / GA4_CREDENTIALS_PATH")
    if not site_scope_s:
        raise SystemExit("Missing --site-scope / env GSC_SITE_SCOPE (e.g. sc-domain:ziso.cc)")

    start_date, end_date = beijing_span(lag_days_end=args.lag_days, window_days=args.window_days)
    ingest_run_id = f"seo_gsc_{uuid.uuid4().hex[:12]}"

    access_token = get_access_token(cred_path, WEBMASTERS_READONLY)

    fallback = {"site_scope": site_scope_s, "date_range": [start_date, end_date]}
    tuples: List[Tuple] = []

    api_page = iterate_all_gsc_pages(site_scope_s, access_token, start_date, end_date, ("date", "page"))
    tuples.extend(
        gsc_site_rows_to_upserts(
            site_scope_s,
            ingest_run_id,
            granularity="page",
            api_rows=api_page,
            raw_fallback=fallback,
        )
    )
    queries_n = 0
    if include_queries:
        api_q = iterate_all_gsc_pages(site_scope_s, access_token, start_date, end_date, ("date", "page", "query"))
        queries_n = len(api_q)
        tuples.extend(
            gsc_site_rows_to_upserts(
                site_scope_s,
                ingest_run_id,
                granularity="query",
                api_rows=api_q,
                raw_fallback=fallback,
            )
        )

    summary = {
        "ingest_run_id": ingest_run_id,
        "date_range": {"start_date": start_date, "end_date": end_date},
        "lag_days": args.lag_days,
        "window_days": args.window_days,
        "site_scope": site_scope_s,
        "gsc_page_rows": len(api_page),
        "gsc_query_rows_fetched": queries_n if include_queries else 0,
        "normalized_upserts": len(tuples),
        "persist": bool(args.persist),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if not args.persist:
        print("--persist not passed; exiting without DB writes.")
        return

    conn = get_connection()
    cur = conn.cursor()
    ensure_seo_search_performance(cur)
    sql = upsert_sql()
    for tup in tuples:
        cur.execute(sql, tup)
    conn.commit()
    conn.close()
    print(json.dumps({"ok": True, "written": len(tuples)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
