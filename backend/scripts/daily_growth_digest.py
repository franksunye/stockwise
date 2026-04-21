import os
import sys
import json
import requests
import subprocess
import tempfile
import base64
import argparse
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
import time
from typing import Dict, Any, List
from urllib3.util import connection as urllib3_connection
from requests import Response
from requests.exceptions import RequestException

# Ensure we can import from parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_connection

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")


def load_env_file(env_path: str):
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            os.environ[key.strip()] = val.strip().strip('"').strip("'")


load_env_file(ENV_PATH)

GROWTH_SNAPSHOT_TABLE = "growth_daily_snapshots"
BEIJING_TZ = timezone(timedelta(hours=8))


def today_beijing() -> str:
    return datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")


def normalized_language(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if not raw or raw in {"none", "null", "(not set)", "unknown"}:
        return "unknown"
    if raw in {"cn", "zh", "zh-cn", "zh_cn", "chinese", "mandarin"} or raw.startswith("zh"):
        return "zh"
    if raw in {"en", "en-us", "en_us", "english"} or raw.startswith("en"):
        return "en"
    if raw.startswith("ko"):
        return "ko"
    if raw.startswith("es"):
        return "es"
    return raw.split("-")[0].split("_")[0] or "unknown"


def pct(numerator: int, denominator: int) -> float:
    return (numerator / denominator * 100) if denominator else 0.0


def ensure_growth_snapshot_table(cursor):
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {GROWTH_SNAPSHOT_TABLE} (
            snapshot_date TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            generated_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'success',
            db_source TEXT NOT NULL DEFAULT 'cloud',
            sessions_24h INTEGER,
            active_users_24h INTEGER,
            page_views_24h INTEGER,
            new_user_rows_24h INTEGER,
            activated_users_24h INTEGER,
            activation_rate_24h REAL,
            paid_rows_24h INTEGER,
            active_watchers_24h INTEGER,
            total_users INTEGER,
            access_granted_users INTEGER,
            active_paid_users INTEGER,
            stripe_linked_users INTEGER,
            payload_json TEXT NOT NULL,
            errors_json TEXT,
            created_at TEXT DEFAULT (datetime('now', '+8 hours')),
            updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
        )
    """)


def build_language_segments_from_rows(rows: List[tuple]) -> Dict[str, List[Dict[str, Any]]]:
    segments: Dict[str, List[Dict[str, Any]]] = {"last_24h": [], "last_7d": [], "last_30d": []}
    for row in rows:
        window = str(row[0])
        user_rows = int(row[2] or 0)
        activated = int(row[4] or 0)
        segments.setdefault(window, []).append({
            "language": normalized_language(row[1]),
            "raw_locale": row[1] or "unknown",
            "new_user_rows": user_rows,
            "anonymous_rows": int(row[3] or 0),
            "activated_users": activated,
            "activation_rate": round(pct(activated, user_rows), 2),
            "paid_rows": int(row[5] or 0),
            "with_watchlist": int(row[6] or 0),
        })
    return segments


def language_segment_sql(hours_or_days: str, window_name: str) -> str:
    return f"""
        SELECT
            '{window_name}' AS window_name,
            lower(coalesce(nullif(locale, ''), 'unknown')) AS locale,
            COUNT(*) AS new_user_rows,
            SUM(CASE WHEN lower(coalesce(registration_type, 'anonymous')) = 'anonymous' THEN 1 ELSE 0 END) AS anonymous_rows,
            SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS activated_users,
            SUM(CASE WHEN lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS paid_rows,
            SUM(CASE WHEN EXISTS (SELECT 1 FROM user_watchlist w WHERE w.user_id = users.user_id) THEN 1 ELSE 0 END) AS with_watchlist
        FROM users
        WHERE created_at > datetime('now', '{hours_or_days}', '+8 hours')
        GROUP BY 1, 2
        ORDER BY new_user_rows DESC, locale ASC
    """


def build_referral_conversion_summary(referral_segments: Dict[str, Dict[str, int]]) -> Dict[str, Dict[str, Any]]:
    summary: Dict[str, Dict[str, Any]] = {}
    for window, values in referral_segments.items():
        invited = int(values.get("invited_user_rows", 0) or 0)
        onboarded = int(values.get("invited_onboarded", 0) or 0)
        summary[window] = {
            **values,
            "invite_onboarding_rate": round(pct(onboarded, invited), 2),
        }
    return summary


@contextmanager
def force_ipv4_requests():
    """
    Some local network paths in this environment fail during TLS handshake unless
    requests/urllib3 is forced onto IPv4.
    """
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


def _get_google_access_token(credentials_path: str) -> str:
    with open(credentials_path, "r", encoding="utf-8") as f:
        credentials = json.load(f)

    jwt = _build_service_account_jwt(
        credentials,
        "https://www.googleapis.com/auth/analytics.readonly",
    )

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


def _run_ga4_report(property_id: str, access_token: str, body: Dict[str, Any]) -> Dict[str, Any]:
    url = f"https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport"
    response = _request_with_retry(
        "post",
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=30,
    )
    return response.json()


def _ga_value(row: Dict[str, Any], idx: int, kind=float):
    return kind(row.get("metricValues", [])[idx]["value"])


def _ga_dim(row: Dict[str, Any], idx: int) -> str:
    return row.get("dimensionValues", [])[idx]["value"]


def get_ga4_report(property_id: str, credentials_path: str):
    """
    Fetches 1d / 7d / 30d traffic snapshots plus trend and acquisition structure.
    """
    access_token = _get_google_access_token(credentials_path)

    def fetch(body: Dict[str, Any]) -> Dict[str, Any]:
        return _run_ga4_report(property_id, access_token, body)

    def fetch_window(start_date: str, end_date: str) -> Dict[str, int]:
        response = fetch(
            {
                "metrics": [
                    {"name": "sessions"},
                    {"name": "activeUsers"},
                    {"name": "conversions"},
                    {"name": "screenPageViews"},
                ],
                "dateRanges": [{"startDate": start_date, "endDate": end_date}],
            }
        )
        row = (response.get("rows") or [{}])[0]
        metric_values = row.get("metricValues", [])
        if not metric_values:
            return {"sessions": 0, "users": 0, "conversions": 0, "page_views": 0}
        return {
            "sessions": int(metric_values[0]["value"]),
            "users": int(metric_values[1]["value"]),
            "conversions": int(float(metric_values[2]["value"])),
            "page_views": int(metric_values[3]["value"]),
        }

    window_summary: Dict[str, Dict[str, int]] = {
        "last_24h": fetch_window("1daysAgo", "today"),
        "last_7d": fetch_window("7daysAgo", "today"),
        "last_30d": fetch_window("30daysAgo", "today"),
    }

    trend_resp = fetch(
        {
            "dimensions": [{"name": "date"}],
            "metrics": [
                {"name": "sessions"},
                {"name": "activeUsers"},
                {"name": "screenPageViews"},
            ],
            "dateRanges": [{"startDate": "7daysAgo", "endDate": "today"}],
            "orderBys": [{"dimension": {"dimensionName": "date"}}],
        }
    )
    daily_trend = []
    for row in trend_resp.get("rows", []):
        daily_trend.append(
            {
                "date": _ga_dim(row, 0),
                "sessions": int(_ga_value(row, 0)),
                "users": int(_ga_value(row, 1)),
                "page_views": int(_ga_value(row, 2)),
            }
        )

    landing_resp = fetch(
        {
            "dimensions": [{"name": "pagePath"}],
            "metrics": [{"name": "sessions"}, {"name": "activeUsers"}],
            "dateRanges": [{"startDate": "7daysAgo", "endDate": "today"}],
            "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
            "limit": 10,
        }
    )
    top_pages = [
        {
            "path": _ga_dim(row, 0),
            "sessions": int(_ga_value(row, 0)),
            "users": int(_ga_value(row, 1)),
        }
        for row in landing_resp.get("rows", [])
    ]

    source_resp = fetch(
        {
            "dimensions": [{"name": "sessionSourceMedium"}],
            "metrics": [{"name": "sessions"}, {"name": "activeUsers"}],
            "dateRanges": [{"startDate": "7daysAgo", "endDate": "today"}],
            "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
            "limit": 10,
        }
    )
    top_sources = [
        {
            "source_medium": _ga_dim(row, 0),
            "sessions": int(_ga_value(row, 0)),
            "users": int(_ga_value(row, 1)),
        }
        for row in source_resp.get("rows", [])
    ]

    device_resp = fetch(
        {
            "dimensions": [{"name": "deviceCategory"}],
            "metrics": [{"name": "sessions"}, {"name": "activeUsers"}],
            "dateRanges": [{"startDate": "30daysAgo", "endDate": "today"}],
            "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
            "limit": 10,
        }
    )
    device_mix = [
        {
            "device": _ga_dim(row, 0),
            "sessions": int(_ga_value(row, 0)),
            "users": int(_ga_value(row, 1)),
        }
        for row in device_resp.get("rows", [])
    ]

    geo_resp = fetch(
        {
            "dimensions": [{"name": "country"}],
            "metrics": [{"name": "sessions"}, {"name": "activeUsers"}],
            "dateRanges": [{"startDate": "30daysAgo", "endDate": "today"}],
            "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
            "limit": 10,
        }
    )
    geo_mix = [
        {
            "country": _ga_dim(row, 0),
            "sessions": int(_ga_value(row, 0)),
            "users": int(_ga_value(row, 1)),
        }
        for row in geo_resp.get("rows", [])
    ]

    language_resp = fetch(
        {
            "dimensions": [{"name": "language"}],
            "metrics": [{"name": "sessions"}, {"name": "activeUsers"}],
            "dateRanges": [{"startDate": "30daysAgo", "endDate": "today"}],
            "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
            "limit": 10,
        }
    )
    language_mix = [
        {
            "language": normalized_language(_ga_dim(row, 0)),
            "raw_language": _ga_dim(row, 0),
            "sessions": int(_ga_value(row, 0)),
            "users": int(_ga_value(row, 1)),
        }
        for row in language_resp.get("rows", [])
    ]

    return {
        "windows": window_summary,
        "daily_trend": daily_trend,
        "top_pages": top_pages,
        "top_sources": top_sources,
        "device_mix": device_mix,
        "geo_mix": geo_mix,
        "language_mix": language_mix,
    }

def get_clarity_metrics(token: str):
    """
    Fetches aggregate negativity signals from Microsoft Clarity.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    def fetch(days: int):
        url = f"https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays={days}"
        response = _request_with_retry("get", url, headers=headers, timeout=20)
        raw_data = response.json()
        data = raw_data[0] if isinstance(raw_data, list) and len(raw_data) > 0 else raw_data
        if not isinstance(data, dict):
            return None
        return {
            "dead_clicks": data.get("deadClickCount", 0),
            "rage_clicks": data.get("rageClickCount", 0),
            "error_clicks": data.get("errorClickCount", 0),
            "avg_engagement_ms": data.get("avgEngagementTime", 0),
            "scroll_depth": data.get("averageScrollDepth", 0),
        }

    result = {"last_24h": fetch(1)}
    try:
        result["last_7d"] = fetch(7)
    except Exception as exc:
        result["last_7d"] = None
        result["last_7d_error"] = str(exc)
    return result

def get_internal_metrics():
    """
    Fetches 24h / 7d / 30d internal growth and activation metrics from DB.
    Note: `users` rows are bootstrap identities, not necessarily completed signups.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        def scalar(sql: str):
            cursor.execute(sql)
            row = cursor.fetchone()
            return row[0] if row else 0

        windows = {
            "last_24h": {
                "new_user_rows": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-24 hours', '+8 hours')"),
                "anonymous_rows": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-24 hours', '+8 hours') AND lower(coalesce(registration_type, 'anonymous')) = 'anonymous'"),
                "activated_users": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-24 hours', '+8 hours') AND has_onboarded = 1"),
                "paid_rows": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-24 hours', '+8 hours') AND lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro')"),
                "active_watchers": scalar("SELECT COUNT(DISTINCT user_id) FROM user_watchlist WHERE added_at > datetime('now', '-24 hours', '+8 hours')"),
            },
            "last_7d": {
                "new_user_rows": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-7 days', '+8 hours')"),
                "anonymous_rows": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-7 days', '+8 hours') AND lower(coalesce(registration_type, 'anonymous')) = 'anonymous'"),
                "activated_users": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-7 days', '+8 hours') AND has_onboarded = 1"),
                "paid_rows": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-7 days', '+8 hours') AND lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro')"),
                "active_watchers": scalar("SELECT COUNT(DISTINCT user_id) FROM user_watchlist WHERE added_at > datetime('now', '-7 days', '+8 hours')"),
            },
            "last_30d": {
                "new_user_rows": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-30 days', '+8 hours')"),
                "anonymous_rows": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-30 days', '+8 hours') AND lower(coalesce(registration_type, 'anonymous')) = 'anonymous'"),
                "activated_users": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-30 days', '+8 hours') AND has_onboarded = 1"),
                "paid_rows": scalar("SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-30 days', '+8 hours') AND lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro')"),
                "active_watchers": scalar("SELECT COUNT(DISTINCT user_id) FROM user_watchlist WHERE added_at > datetime('now', '-30 days', '+8 hours')"),
            },
        }

        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = (cursor.fetchone() or [0])[0] or 0

        cursor.execute("SELECT COUNT(*) FROM users WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id != ''")
        stripe_linked_users = (cursor.fetchone() or [0])[0] or 0

        cursor.execute("""
            SELECT COUNT(*)
            FROM users
            WHERE stripe_customer_id IS NOT NULL
              AND stripe_customer_id != ''
              AND subscription_expires_at IS NOT NULL
              AND datetime(subscription_expires_at) > datetime('now')
        """)
        active_paid_users = (cursor.fetchone() or [0])[0] or 0

        cursor.execute("""
            SELECT COUNT(*)
            FROM users
            WHERE lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro')
        """)
        access_granted_users = (cursor.fetchone() or [0])[0] or 0

        cursor.execute("SELECT lower(coalesce(subscription_tier, 'free')), COUNT(*) FROM users GROUP BY 1 ORDER BY 2 DESC")
        tiers = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute("SELECT lower(coalesce(locale, 'unknown')), COUNT(*) FROM users GROUP BY 1 ORDER BY 2 DESC")
        locales = {row[0]: row[1] for row in cursor.fetchall()}

        referral_segments = {}
        for window_name, interval in [
            ("last_24h", "-24 hours"),
            ("last_7d", "-7 days"),
            ("last_30d", "-30 days"),
        ]:
            cursor.execute(f"""
                SELECT
                    COUNT(*) AS invited_user_rows,
                    SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS invited_onboarded,
                    SUM(CASE WHEN lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS invited_access_granted,
                    SUM(CASE WHEN EXISTS (SELECT 1 FROM user_watchlist w WHERE w.user_id = users.user_id) THEN 1 ELSE 0 END) AS invited_with_watchlist
                FROM users
                WHERE created_at > datetime('now', '{interval}', '+8 hours')
                  AND referred_by IS NOT NULL
                  AND referred_by != ''
            """)
            row = cursor.fetchone() or (0, 0, 0, 0)
            referral_segments[window_name] = {
                "invited_user_rows": row[0] or 0,
                "invited_onboarded": row[1] or 0,
                "invited_access_granted": row[2] or 0,
                "invited_with_watchlist": row[3] or 0,
            }
        referral_conversion = build_referral_conversion_summary(referral_segments)

        cursor.execute("""
            SELECT
                lower(coalesce(nullif(locale, ''), 'unknown')) AS locale,
                COUNT(*) AS invited_user_rows,
                SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS invited_onboarded,
                SUM(CASE WHEN lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS invited_access_granted
            FROM users
            WHERE created_at > datetime('now', '-30 days', '+8 hours')
              AND referred_by IS NOT NULL
              AND referred_by != ''
            GROUP BY 1
            ORDER BY invited_user_rows DESC, locale ASC
        """)
        referral_language_segments = [
            {
                "language": normalized_language(row[0]),
                "raw_locale": row[0] or "unknown",
                "invited_user_rows": row[1] or 0,
                "invited_onboarded": row[2] or 0,
                "invite_onboarding_rate": round(pct(row[2] or 0, row[1] or 0), 2),
                "invited_access_granted": row[3] or 0,
            }
            for row in cursor.fetchall()
        ]

        cursor.execute("""
            SELECT
                u.referred_by,
                COALESCE(r.referral_alias, u.referred_by) AS referrer_label,
                lower(coalesce(nullif(r.locale, ''), 'unknown')) AS referrer_locale,
                COUNT(*) AS invited_user_rows,
                SUM(CASE WHEN u.has_onboarded = 1 THEN 1 ELSE 0 END) AS invited_onboarded,
                SUM(CASE WHEN lower(coalesce(u.subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS invited_access_granted,
                SUM(CASE WHEN EXISTS (SELECT 1 FROM user_watchlist w WHERE w.user_id = u.user_id) THEN 1 ELSE 0 END) AS invited_with_watchlist
            FROM users u
            LEFT JOIN users r ON r.user_id = u.referred_by
            WHERE u.created_at > datetime('now', '-30 days', '+8 hours')
              AND u.referred_by IS NOT NULL
              AND u.referred_by != ''
            GROUP BY 1, 2, 3
            ORDER BY invited_onboarded DESC, invited_user_rows DESC
            LIMIT 10
        """)
        referral_by_referrer = [
            {
                "referrer_user_id": row[0],
                "referrer_label": row[1],
                "referrer_language": normalized_language(row[2]),
                "invited_user_rows": row[3] or 0,
                "invited_onboarded": row[4] or 0,
                "invite_onboarding_rate": round(pct(row[4] or 0, row[3] or 0), 2),
                "invited_access_granted": row[5] or 0,
                "invited_with_watchlist": row[6] or 0,
            }
            for row in cursor.fetchall()
        ]

        cursor.execute("""
            SELECT
                substr(created_at, 1, 10) AS day,
                COUNT(*) AS invited_user_rows,
                SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS invited_onboarded
            FROM users
            WHERE created_at > datetime('now', '-7 days', '+8 hours')
              AND referred_by IS NOT NULL
              AND referred_by != ''
            GROUP BY 1
            ORDER BY 1
        """)
        referral_trend = [
            {
                "day": row[0],
                "invited_user_rows": row[1] or 0,
                "invited_onboarded": row[2] or 0,
                "invite_onboarding_rate": round(pct(row[2] or 0, row[1] or 0), 2),
            }
            for row in cursor.fetchall()
        ]

        language_rows = []
        for sql in [
            language_segment_sql("-24 hours", "last_24h"),
            language_segment_sql("-7 days", "last_7d"),
            language_segment_sql("-30 days", "last_30d"),
        ]:
            cursor.execute(sql)
            language_rows.extend(cursor.fetchall())
        language_segments = build_language_segments_from_rows(language_rows)

        cursor.execute("""
            SELECT
                COUNT(*) AS user_rows_30d,
                SUM(CASE WHEN lower(coalesce(registration_type, 'anonymous')) = 'anonymous' THEN 1 ELSE 0 END) AS anonymous_rows_30d,
                SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS onboarded_30d,
                SUM(CASE WHEN lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS access_granted_30d,
                SUM(CASE WHEN stripe_customer_id IS NOT NULL AND stripe_customer_id != '' THEN 1 ELSE 0 END) AS stripe_linked_30d,
                SUM(CASE WHEN EXISTS (SELECT 1 FROM user_watchlist w WHERE w.user_id = u.user_id) THEN 1 ELSE 0 END) AS with_watchlist_30d
            FROM users u
            WHERE created_at > datetime('now', '-30 days', '+8 hours')
        """)
        row = cursor.fetchone()
        activation_summary = {
            "user_rows_30d": row[0] or 0,
            "anonymous_rows_30d": row[1] or 0,
            "onboarded_30d": row[2] or 0,
            "access_granted_30d": row[3] or 0,
            "stripe_linked_30d": row[4] or 0,
            "with_watchlist_30d": row[5] or 0,
        }

        cursor.execute("""
            SELECT
                CASE WHEN referred_by IS NOT NULL AND referred_by != '' THEN 'referred' ELSE 'organic' END AS channel,
                COUNT(*) AS user_rows,
                SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS onboarded,
                SUM(CASE WHEN lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS access_granted,
                SUM(CASE WHEN stripe_customer_id IS NOT NULL AND stripe_customer_id != '' THEN 1 ELSE 0 END) AS stripe_linked
            FROM users
            WHERE created_at > datetime('now', '-30 days', '+8 hours')
            GROUP BY 1
            ORDER BY user_rows DESC
        """)
        channel_quality = [
            {
                "channel": row[0],
                "user_rows": row[1],
                "onboarded": row[2],
                "access_granted": row[3],
                "stripe_linked": row[4],
            }
            for row in cursor.fetchall()
        ]

        cursor.execute("""
            SELECT symbol, COUNT(*) as count, COUNT(DISTINCT user_id) as users
            FROM user_watchlist
            WHERE added_at > datetime('now', '-30 days', '+8 hours')
            GROUP BY symbol ORDER BY count DESC, users DESC LIMIT 10
        """)
        top_symbols = [{"symbol": row[0], "count": row[1], "users": row[2]} for row in cursor.fetchall()]

        cursor.execute("""
            SELECT
                substr(created_at, 1, 10) as day,
                COUNT(*) as user_rows,
                SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS activated
            FROM users
            WHERE created_at > datetime('now', '-7 days', '+8 hours')
            GROUP BY 1 ORDER BY 1
        """)
        signup_trend = [{"day": row[0], "user_rows": row[1], "activated": row[2] or 0} for row in cursor.fetchall()]

        cursor.execute("""
            SELECT substr(added_at, 1, 10) as day, COUNT(*) as adds
            FROM user_watchlist
            WHERE added_at > datetime('now', '-7 days', '+8 hours')
            GROUP BY 1 ORDER BY 1
        """)
        watchlist_trend = [{"day": row[0], "adds": row[1]} for row in cursor.fetchall()]

        cursor.execute("""
            SELECT user_id, registration_type, created_at, subscription_tier, referred_by, has_onboarded, locale
            FROM users 
            WHERE created_at > datetime('now', '-24 hours', '+8 hours')
            ORDER BY created_at DESC LIMIT 10
        """)
        new_users_detailed = []
        for row in cursor.fetchall():
            uid = row[0]
            cursor.execute("SELECT COUNT(*) FROM user_watchlist WHERE user_id = ?", (uid,))
            w_count = cursor.fetchone()[0]
            new_users_detailed.append({
                "user_id": uid,
                "type": row[1],
                "created_at": row[2],
                "tier": row[3],
                "referred_by": row[4],
                "onboarded": row[5],
                "locale": row[6],
                "watchlist_count": w_count
            })
        
        conn.close()
        return {
            "windows": windows,
            "user_base_summary": {
                "total_users": total_users,
                "stripe_linked_users": stripe_linked_users,
                "active_paid_users": active_paid_users,
                "access_granted_users": access_granted_users,
            },
            "top_symbols": top_symbols,
            "tiers": tiers,
            "locales": locales,
            "language_segments": language_segments,
            "referral_conversion": referral_conversion,
            "referral_language_segments": referral_language_segments,
            "referral_by_referrer": referral_by_referrer,
            "referral_trend": referral_trend,
            "activation_summary": activation_summary,
            "channel_quality": channel_quality,
            "signup_trend": signup_trend,
            "watchlist_trend": watchlist_trend,
            "new_users_detailed": new_users_detailed,
        }
    except Exception as exc:
        print(f"⚠️ Primary DB path failed, falling back to Node Turso CLI: {exc}")
        return get_internal_metrics_via_node_cli()


def get_internal_metrics_via_node_cli():
    frontend_dir = os.path.join(os.path.dirname(BASE_DIR), "frontend")
    cli_path = os.path.join("scripts", "turso-cli.mjs")

    def query(sql: str) -> List[Dict[str, Any]]:
        result = subprocess.run(
            ["node", cli_path, "query", "--raw", sql],
            cwd=frontend_dir,
            capture_output=True,
            text=True,
            check=True,
        )
        stdout = result.stdout.strip()
        start = stdout.find("[")
        if start == -1:
            raise RuntimeError(f"Unexpected Turso CLI output: {stdout}")
        return json.loads(stdout[start:])

    def scalar(sql: str, key: str) -> int:
        rows = query(sql)
        if not rows:
            return 0
        value = rows[0].get(key)
        return int(value or 0)

    windows = {
        "last_24h": {
            "new_user_rows": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-24 hours', '+8 hours')", "value"),
            "anonymous_rows": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-24 hours', '+8 hours') AND lower(coalesce(registration_type, 'anonymous')) = 'anonymous'", "value"),
            "activated_users": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-24 hours', '+8 hours') AND has_onboarded = 1", "value"),
            "paid_rows": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-24 hours', '+8 hours') AND lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro')", "value"),
            "active_watchers": scalar("SELECT COUNT(DISTINCT user_id) AS value FROM user_watchlist WHERE added_at > datetime('now', '-24 hours', '+8 hours')", "value"),
        },
        "last_7d": {
            "new_user_rows": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-7 days', '+8 hours')", "value"),
            "anonymous_rows": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-7 days', '+8 hours') AND lower(coalesce(registration_type, 'anonymous')) = 'anonymous'", "value"),
            "activated_users": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-7 days', '+8 hours') AND has_onboarded = 1", "value"),
            "paid_rows": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-7 days', '+8 hours') AND lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro')", "value"),
            "active_watchers": scalar("SELECT COUNT(DISTINCT user_id) AS value FROM user_watchlist WHERE added_at > datetime('now', '-7 days', '+8 hours')", "value"),
        },
        "last_30d": {
            "new_user_rows": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-30 days', '+8 hours')", "value"),
            "anonymous_rows": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-30 days', '+8 hours') AND lower(coalesce(registration_type, 'anonymous')) = 'anonymous'", "value"),
            "activated_users": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-30 days', '+8 hours') AND has_onboarded = 1", "value"),
            "paid_rows": scalar("SELECT COUNT(*) AS value FROM users WHERE created_at > datetime('now', '-30 days', '+8 hours') AND lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro')", "value"),
            "active_watchers": scalar("SELECT COUNT(DISTINCT user_id) AS value FROM user_watchlist WHERE added_at > datetime('now', '-30 days', '+8 hours')", "value"),
        },
    }

    total_users = scalar("SELECT COUNT(*) AS value FROM users", "value")
    stripe_linked_users = scalar(
        "SELECT COUNT(*) AS value FROM users WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id != ''",
        "value",
    )
    active_paid_users = scalar(
        """
        SELECT COUNT(*) AS value
        FROM users
        WHERE stripe_customer_id IS NOT NULL
          AND stripe_customer_id != ''
          AND subscription_expires_at IS NOT NULL
          AND datetime(subscription_expires_at) > datetime('now')
        """,
        "value",
    )
    access_granted_users = scalar(
        "SELECT COUNT(*) AS value FROM users WHERE lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro')",
        "value",
    )

    tiers = {
        str(row["tier"]): int(row["count"])
        for row in query("SELECT lower(coalesce(subscription_tier, 'free')) AS tier, COUNT(*) AS count FROM users GROUP BY 1 ORDER BY 2 DESC")
    }
    locales = {
        str(row["locale"]): int(row["count"])
        for row in query("SELECT lower(coalesce(locale, 'unknown')) AS locale, COUNT(*) AS count FROM users GROUP BY 1 ORDER BY 2 DESC")
    }

    referral_segments = {}
    for window_name, interval in [
        ("last_24h", "-24 hours"),
        ("last_7d", "-7 days"),
        ("last_30d", "-30 days"),
    ]:
        row = query(f"""
            SELECT
                COUNT(*) AS invited_user_rows,
                SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS invited_onboarded,
                SUM(CASE WHEN lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS invited_access_granted,
                SUM(CASE WHEN EXISTS (SELECT 1 FROM user_watchlist w WHERE w.user_id = users.user_id) THEN 1 ELSE 0 END) AS invited_with_watchlist
            FROM users
            WHERE created_at > datetime('now', '{interval}', '+8 hours')
              AND referred_by IS NOT NULL
              AND referred_by != ''
        """)[0]
        referral_segments[window_name] = {
            "invited_user_rows": int(row.get("invited_user_rows") or 0),
            "invited_onboarded": int(row.get("invited_onboarded") or 0),
            "invited_access_granted": int(row.get("invited_access_granted") or 0),
            "invited_with_watchlist": int(row.get("invited_with_watchlist") or 0),
        }
    referral_conversion = build_referral_conversion_summary(referral_segments)

    referral_language_segments = [
        {
            "language": normalized_language(row.get("locale")),
            "raw_locale": row.get("locale") or "unknown",
            "invited_user_rows": int(row.get("invited_user_rows") or 0),
            "invited_onboarded": int(row.get("invited_onboarded") or 0),
            "invite_onboarding_rate": round(pct(int(row.get("invited_onboarded") or 0), int(row.get("invited_user_rows") or 0)), 2),
            "invited_access_granted": int(row.get("invited_access_granted") or 0),
        }
        for row in query("""
            SELECT
                lower(coalesce(nullif(locale, ''), 'unknown')) AS locale,
                COUNT(*) AS invited_user_rows,
                SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS invited_onboarded,
                SUM(CASE WHEN lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS invited_access_granted
            FROM users
            WHERE created_at > datetime('now', '-30 days', '+8 hours')
              AND referred_by IS NOT NULL
              AND referred_by != ''
            GROUP BY 1
            ORDER BY invited_user_rows DESC, locale ASC
        """)
    ]

    referral_by_referrer = [
        {
            "referrer_user_id": row.get("referred_by"),
            "referrer_label": row.get("referrer_label"),
            "referrer_language": normalized_language(row.get("referrer_locale")),
            "invited_user_rows": int(row.get("invited_user_rows") or 0),
            "invited_onboarded": int(row.get("invited_onboarded") or 0),
            "invite_onboarding_rate": round(pct(int(row.get("invited_onboarded") or 0), int(row.get("invited_user_rows") or 0)), 2),
            "invited_access_granted": int(row.get("invited_access_granted") or 0),
            "invited_with_watchlist": int(row.get("invited_with_watchlist") or 0),
        }
        for row in query("""
            SELECT
                u.referred_by AS referred_by,
                COALESCE(r.referral_alias, u.referred_by) AS referrer_label,
                lower(coalesce(nullif(r.locale, ''), 'unknown')) AS referrer_locale,
                COUNT(*) AS invited_user_rows,
                SUM(CASE WHEN u.has_onboarded = 1 THEN 1 ELSE 0 END) AS invited_onboarded,
                SUM(CASE WHEN lower(coalesce(u.subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS invited_access_granted,
                SUM(CASE WHEN EXISTS (SELECT 1 FROM user_watchlist w WHERE w.user_id = u.user_id) THEN 1 ELSE 0 END) AS invited_with_watchlist
            FROM users u
            LEFT JOIN users r ON r.user_id = u.referred_by
            WHERE u.created_at > datetime('now', '-30 days', '+8 hours')
              AND u.referred_by IS NOT NULL
              AND u.referred_by != ''
            GROUP BY 1, 2, 3
            ORDER BY invited_onboarded DESC, invited_user_rows DESC
            LIMIT 10
        """)
    ]

    referral_trend = [
        {
            "day": row.get("day"),
            "invited_user_rows": int(row.get("invited_user_rows") or 0),
            "invited_onboarded": int(row.get("invited_onboarded") or 0),
            "invite_onboarding_rate": round(pct(int(row.get("invited_onboarded") or 0), int(row.get("invited_user_rows") or 0)), 2),
        }
        for row in query("""
            SELECT
                substr(created_at, 1, 10) AS day,
                COUNT(*) AS invited_user_rows,
                SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS invited_onboarded
            FROM users
            WHERE created_at > datetime('now', '-7 days', '+8 hours')
              AND referred_by IS NOT NULL
              AND referred_by != ''
            GROUP BY 1
            ORDER BY 1
        """)
    ]

    language_segment_rows = []
    for sql in [
        language_segment_sql("-24 hours", "last_24h"),
        language_segment_sql("-7 days", "last_7d"),
        language_segment_sql("-30 days", "last_30d"),
    ]:
        for row in query(sql):
            language_segment_rows.append((
                row.get("window_name"),
                row.get("locale"),
                row.get("new_user_rows"),
                row.get("anonymous_rows"),
                row.get("activated_users"),
                row.get("paid_rows"),
                row.get("with_watchlist"),
            ))
    language_segments = build_language_segments_from_rows(language_segment_rows)

    activation_row = query("""
        SELECT
            COUNT(*) AS user_rows_30d,
            SUM(CASE WHEN lower(coalesce(registration_type, 'anonymous')) = 'anonymous' THEN 1 ELSE 0 END) AS anonymous_rows_30d,
            SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS onboarded_30d,
            SUM(CASE WHEN lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS access_granted_30d,
            SUM(CASE WHEN stripe_customer_id IS NOT NULL AND stripe_customer_id != '' THEN 1 ELSE 0 END) AS stripe_linked_30d,
            SUM(CASE WHEN EXISTS (SELECT 1 FROM user_watchlist w WHERE w.user_id = u.user_id) THEN 1 ELSE 0 END) AS with_watchlist_30d
        FROM users u
        WHERE created_at > datetime('now', '-30 days', '+8 hours')
    """)[0]
    activation_summary = {
        "user_rows_30d": int(activation_row.get("user_rows_30d") or 0),
        "anonymous_rows_30d": int(activation_row.get("anonymous_rows_30d") or 0),
        "onboarded_30d": int(activation_row.get("onboarded_30d") or 0),
        "access_granted_30d": int(activation_row.get("access_granted_30d") or 0),
        "stripe_linked_30d": int(activation_row.get("stripe_linked_30d") or 0),
        "with_watchlist_30d": int(activation_row.get("with_watchlist_30d") or 0),
    }

    channel_quality = [
        {
            "channel": str(row["channel"]),
            "user_rows": int(row["user_rows"]),
            "onboarded": int(row["onboarded"] or 0),
            "access_granted": int(row["access_granted"] or 0),
            "stripe_linked": int(row["stripe_linked"] or 0),
        }
        for row in query("""
            SELECT
                CASE WHEN referred_by IS NOT NULL AND referred_by != '' THEN 'referred' ELSE 'organic' END AS channel,
                COUNT(*) AS user_rows,
                SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS onboarded,
                SUM(CASE WHEN lower(coalesce(subscription_tier, 'free')) IN ('go','plus','pro') THEN 1 ELSE 0 END) AS access_granted,
                SUM(CASE WHEN stripe_customer_id IS NOT NULL AND stripe_customer_id != '' THEN 1 ELSE 0 END) AS stripe_linked
            FROM users
            WHERE created_at > datetime('now', '-30 days', '+8 hours')
            GROUP BY 1
            ORDER BY user_rows DESC
        """)
    ]

    top_symbols = [
        {"symbol": str(row["symbol"]), "count": int(row["count"]), "users": int(row["users"])}
        for row in query("""
            SELECT symbol, COUNT(*) as count, COUNT(DISTINCT user_id) as users
            FROM user_watchlist
            WHERE added_at > datetime('now', '-30 days', '+8 hours')
            GROUP BY symbol ORDER BY count DESC, users DESC LIMIT 10
        """)
    ]

    signup_trend = [
        {"day": str(row["day"]), "user_rows": int(row["user_rows"]), "activated": int(row["activated"] or 0)}
        for row in query("""
            SELECT
                substr(created_at, 1, 10) as day,
                COUNT(*) as user_rows,
                SUM(CASE WHEN has_onboarded = 1 THEN 1 ELSE 0 END) AS activated
            FROM users
            WHERE created_at > datetime('now', '-7 days', '+8 hours')
            GROUP BY 1 ORDER BY 1
        """)
    ]

    watchlist_trend = [
        {"day": str(row["day"]), "adds": int(row["adds"])}
        for row in query("""
            SELECT substr(added_at, 1, 10) as day, COUNT(*) as adds
            FROM user_watchlist
            WHERE added_at > datetime('now', '-7 days', '+8 hours')
            GROUP BY 1 ORDER BY 1
        """)
    ]

    new_users_detailed = [
        {
            "user_id": str(row["user_id"]),
            "type": row.get("type"),
            "created_at": row.get("created_at"),
            "tier": row.get("tier"),
            "referred_by": row.get("referred_by"),
            "onboarded": int(row.get("onboarded") or 0),
            "locale": row.get("locale"),
            "watchlist_count": int(row.get("watchlist_count") or 0),
        }
        for row in query("""
            SELECT
                u.user_id AS user_id,
                u.registration_type AS type,
                u.created_at AS created_at,
                u.subscription_tier AS tier,
                u.referred_by AS referred_by,
                u.has_onboarded AS onboarded,
                u.locale AS locale,
                COUNT(w.symbol) AS watchlist_count
            FROM users u
            LEFT JOIN user_watchlist w ON w.user_id = u.user_id
            WHERE u.created_at > datetime('now', '-24 hours', '+8 hours')
            GROUP BY u.user_id, u.registration_type, u.created_at, u.subscription_tier, u.referred_by, u.has_onboarded, u.locale
            ORDER BY u.created_at DESC
            LIMIT 10
        """)
    ]

    return {
        "windows": windows,
        "user_base_summary": {
            "total_users": total_users,
            "stripe_linked_users": stripe_linked_users,
            "active_paid_users": active_paid_users,
            "access_granted_users": access_granted_users,
        },
        "top_symbols": top_symbols,
        "tiers": tiers,
        "locales": locales,
        "language_segments": language_segments,
        "referral_conversion": referral_conversion,
        "referral_language_segments": referral_language_segments,
        "referral_by_referrer": referral_by_referrer,
        "referral_trend": referral_trend,
        "activation_summary": activation_summary,
        "channel_quality": channel_quality,
        "signup_trend": signup_trend,
        "watchlist_trend": watchlist_trend,
        "new_users_detailed": new_users_detailed,
    }


def collect_growth_payload(require_external: bool = False) -> Dict[str, Any]:
    property_id = os.environ.get("GA4_PROPERTY_ID")
    credentials_path = os.environ.get("GA4_CREDENTIALS_PATH")
    clarity_token = os.environ.get("CLARITY_API_TOKEN")
    errors: Dict[str, str] = {}

    internal = get_internal_metrics()

    ga = None
    if property_id and credentials_path:
        try:
            ga = get_ga4_report(property_id, credentials_path)
        except Exception as exc:
            errors["ga4"] = str(exc)
    elif require_external:
        errors["ga4"] = "GA4_PROPERTY_ID or GA4_CREDENTIALS_PATH is not configured"

    clarity = None
    if clarity_token:
        try:
            clarity = get_clarity_metrics(clarity_token)
        except Exception as exc:
            errors["clarity"] = str(exc)

    generated_at = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S%z")
    db_24h = internal["windows"]["last_24h"]
    ga_24h = (ga or {}).get("windows", {}).get("last_24h", {})

    payload = {
        "generated_at": generated_at,
        "snapshot_date": today_beijing(),
        "internal": internal,
        "ga4": ga,
        "clarity": clarity,
        "errors": errors,
        "headline": {
            "sessions_24h": int(ga_24h.get("sessions") or 0),
            "active_users_24h": int(ga_24h.get("users") or 0),
            "page_views_24h": int(ga_24h.get("page_views") or 0),
            "new_user_rows_24h": int(db_24h["new_user_rows"] or 0),
            "activated_users_24h": int(db_24h["activated_users"] or 0),
            "activation_rate_24h": round(pct(int(db_24h["activated_users"] or 0), int(db_24h["new_user_rows"] or 0)), 2),
            "paid_rows_24h": int(db_24h["paid_rows"] or 0),
            "active_watchers_24h": int(db_24h["active_watchers"] or 0),
        },
    }
    return payload


def persist_growth_snapshot(payload: Dict[str, Any], snapshot_date: str | None = None, status: str = "success") -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    ensure_growth_snapshot_table(cursor)

    run_id = f"growth_{uuid.uuid4().hex[:12]}"
    date_value = snapshot_date or payload.get("snapshot_date") or today_beijing()
    headline = payload.get("headline", {})
    user_base = payload.get("internal", {}).get("user_base_summary", {})
    errors = payload.get("errors") or {}

    cursor.execute(
        f"""
        INSERT INTO {GROWTH_SNAPSHOT_TABLE} (
            snapshot_date, run_id, generated_at, status, db_source,
            sessions_24h, active_users_24h, page_views_24h,
            new_user_rows_24h, activated_users_24h, activation_rate_24h,
            paid_rows_24h, active_watchers_24h,
            total_users, access_granted_users, active_paid_users, stripe_linked_users,
            payload_json, errors_json, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'))
        ON CONFLICT(snapshot_date) DO UPDATE SET
            run_id = excluded.run_id,
            generated_at = excluded.generated_at,
            status = excluded.status,
            db_source = excluded.db_source,
            sessions_24h = excluded.sessions_24h,
            active_users_24h = excluded.active_users_24h,
            page_views_24h = excluded.page_views_24h,
            new_user_rows_24h = excluded.new_user_rows_24h,
            activated_users_24h = excluded.activated_users_24h,
            activation_rate_24h = excluded.activation_rate_24h,
            paid_rows_24h = excluded.paid_rows_24h,
            active_watchers_24h = excluded.active_watchers_24h,
            total_users = excluded.total_users,
            access_granted_users = excluded.access_granted_users,
            active_paid_users = excluded.active_paid_users,
            stripe_linked_users = excluded.stripe_linked_users,
            payload_json = excluded.payload_json,
            errors_json = excluded.errors_json,
            updated_at = datetime('now', '+8 hours')
        """,
        (
            date_value,
            run_id,
            payload.get("generated_at") or datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S%z"),
            status,
            os.environ.get("DB_SOURCE", "cloud"),
            headline.get("sessions_24h"),
            headline.get("active_users_24h"),
            headline.get("page_views_24h"),
            headline.get("new_user_rows_24h"),
            headline.get("activated_users_24h"),
            headline.get("activation_rate_24h"),
            headline.get("paid_rows_24h"),
            headline.get("active_watchers_24h"),
            user_base.get("total_users"),
            user_base.get("access_granted_users"),
            user_base.get("active_paid_users"),
            user_base.get("stripe_linked_users"),
            json.dumps(payload, ensure_ascii=False),
            json.dumps(errors, ensure_ascii=False) if errors else None,
        ),
    )
    conn.commit()
    conn.close()
    return {"snapshot_date": date_value, "run_id": run_id, "status": status, "errors": errors}

def generate_report():
    print("--- 🚀 StockWise Daily Growth Pulse ---")
    
    property_id = os.environ.get("GA4_PROPERTY_ID")
    credentials_path = os.environ.get("GA4_CREDENTIALS_PATH")
    clarity_token = os.environ.get("CLARITY_API_TOKEN")
    
    if not property_id or not credentials_path:
        print("❌ Error: GA4_PROPERTY_ID or GA4_CREDENTIALS_PATH not found in environment.")
        return

    try:
        internal = get_internal_metrics()

        ga = None
        ga_error = None
        try:
            ga = get_ga4_report(property_id, credentials_path)
        except Exception as e:
            ga_error = str(e)

        clarity_data = None
        clarity_error = None
        if clarity_token:
            try:
                clarity_data = get_clarity_metrics(clarity_token)
            except Exception as e:
                clarity_error = str(e)
        clarity_partial_error = (clarity_data or {}).get("last_7d_error")

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ga_24h = (ga or {}).get("windows", {}).get("last_24h", {})
        ga_7d = (ga or {}).get("windows", {}).get("last_7d", {})
        ga_30d = (ga or {}).get("windows", {}).get("last_30d", {})
        db_24h = internal["windows"]["last_24h"]
        db_7d = internal["windows"]["last_7d"]
        db_30d = internal["windows"]["last_30d"]
        activation = internal["activation_summary"]

        def pct(numerator: int, denominator: int) -> float:
            return (numerator / denominator * 100) if denominator else 0.0

        report_md = f"""# StockWise Growth Pulse ({timestamp})

## 📊 Summary (Last 24h)
| Metric | Count | Source |
| :--- | :--- | :--- |
| **Total Sessions** | {ga_24h.get('sessions', 'N/A') if ga else 'N/A'} | GA4 |
| **Active Users** | {ga_24h.get('users', 'N/A') if ga else 'N/A'} | GA4 |
| **New User Rows** | {db_24h['new_user_rows']} | DB (`users`) |
| **Activated Users** | {db_24h['activated_users']} | DB (`users.has_onboarded=1`) |
| **Activation / User Rows** | {pct(db_24h['activated_users'], db_24h['new_user_rows']):.2f}% | Derived |
| **Active Watchers** | {db_24h['active_watchers']} | DB |
| **Total Page Views** | {ga_24h.get('page_views', 'N/A') if ga else 'N/A'} | GA4 |

## 📈 Window Comparison
| Window | Sessions | Users | Page Views | User Rows | Activated | Activation / Rows |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **24h** | {ga_24h.get('sessions', 'N/A') if ga else 'N/A'} | {ga_24h.get('users', 'N/A') if ga else 'N/A'} | {ga_24h.get('page_views', 'N/A') if ga else 'N/A'} | {db_24h['new_user_rows']} | {db_24h['activated_users']} | {pct(db_24h['activated_users'], db_24h['new_user_rows']):.2f}% |
| **7d** | {ga_7d.get('sessions', 'N/A') if ga else 'N/A'} | {ga_7d.get('users', 'N/A') if ga else 'N/A'} | {ga_7d.get('page_views', 'N/A') if ga else 'N/A'} | {db_7d['new_user_rows']} | {db_7d['activated_users']} | {pct(db_7d['activated_users'], db_7d['new_user_rows']):.2f}% |
| **30d** | {ga_30d.get('sessions', 'N/A') if ga else 'N/A'} | {ga_30d.get('users', 'N/A') if ga else 'N/A'} | {ga_30d.get('page_views', 'N/A') if ga else 'N/A'} | {db_30d['new_user_rows']} | {db_30d['activated_users']} | {pct(db_30d['activated_users'], db_30d['new_user_rows']):.2f}% |

"""
        if ga_error or clarity_error or clarity_partial_error:
            report_md += "## 🚨 Data Collection Issues\n"
            if ga_error:
                report_md += f"- **GA4 unavailable**: {ga_error}\n"
            if clarity_error:
                report_md += f"- **Clarity unavailable**: {clarity_error}\n"
            if clarity_partial_error:
                report_md += f"- **Clarity 7d partial failure**: {clarity_partial_error}\n"
            report_md += "- Continue to trust internal DB funnel metrics; external traffic trend is incomplete for this run.\n\n"

        if clarity_data:
            c24 = clarity_data.get("last_24h") or {}
            c7 = clarity_data.get("last_7d") or {}
            report_md += f"""## ⚠️ UX Friction Signals (Clarity)
| Metric | Count | Insight |
| :--- | :--- | :--- |
| **Dead Clicks (24h)** | {c24.get('dead_clicks', 0)} | Potential broken UI elements |
| **Rage Clicks (24h)** | {c24.get('rage_clicks', 0)} | User frustration detected |
| **Error Clicks (24h)** | {c24.get('error_clicks', 0)} | JS errors or broken links |
| **Avg Engagement (24h)** | {c24.get('avg_engagement_ms', 0)/1000 if c24.get('avg_engagement_ms') else 0:.1f}s | Session duration |
| **Dead Clicks (7d)** | {c7.get('dead_clicks', 'N/A') if c7 else 'N/A'} | Weekly friction accumulation |
| **Rage Clicks (7d)** | {c7.get('rage_clicks', 'N/A') if c7 else 'N/A'} | Weekly frustration accumulation |
| **Scroll Depth (7d)** | {c7.get('scroll_depth', 'N/A') if c7 else 'N/A'} | Higher is generally better |

"""

        report_md += f"""## 🧩 User Base Breakdown
- **Total Users**: {internal['user_base_summary']['total_users']}
- **Paid Users (Active Stripe-linked)**: {internal['user_base_summary']['active_paid_users']}
- **Stripe-linked Users (Ever)**: {internal['user_base_summary']['stripe_linked_users']}
- **Access Granted Users (Go/Plus/Pro)**: {internal['user_base_summary']['access_granted_users']}
- **Free**: {internal['tiers'].get('free', 0)}
- **Go**: {internal['tiers'].get('go', 0)}
- **Plus**: {internal['tiers'].get('plus', 0)}
- **Pro**: {internal['tiers'].get('pro', 0)}
- **CN Locale**: {internal['locales'].get('cn', 0)}
- **EN Locale**: {internal['locales'].get('en', 0)}
- **Metric Note**: GO/PRO may come from onboarding or referral rewards, not only payment.
- **Ghost Users Cleaned (Cumulative)**: Done

## 🧪 Activation Quality (Last 30d)
| Metric | Count | Rate |
| :--- | :--- | :--- |
| **User Rows** | {activation['user_rows_30d']} | 100.00% |
| **Anonymous Bootstrap Rows** | {activation['anonymous_rows_30d']} | {pct(activation['anonymous_rows_30d'], activation['user_rows_30d']):.2f}% |
| **Onboarded** | {activation['onboarded_30d']} | {pct(activation['onboarded_30d'], activation['user_rows_30d']):.2f}% |
| **Access Granted (Go/Plus/Pro)** | {activation['access_granted_30d']} | {pct(activation['access_granted_30d'], activation['user_rows_30d']):.2f}% |
| **Stripe-linked Paid Rows** | {activation['stripe_linked_30d']} | {pct(activation['stripe_linked_30d'], activation['user_rows_30d']):.2f}% |
| **Added Watchlist** | {activation['with_watchlist_30d']} | {pct(activation['with_watchlist_30d'], activation['user_rows_30d']):.2f}% |

## 🔁 Channel Quality (Last 30d)
| Channel | User Rows | Onboarded | Access Granted | Stripe-linked Paid |
| :--- | :--- | :--- | :--- | :--- |
"""
        if not internal["channel_quality"]:
            report_md += "| No recent channels | - | - | - | - |\n"
        else:
            for item in internal["channel_quality"]:
                report_md += f"| {item['channel']} | {item['user_rows']} | {item['onboarded']} | {item['access_granted']} | {item['stripe_linked']} |\n"

        report_md += """

## 👤 New User Intelligence (Last 10)
| User ID | Created (UTC) | Type | Tier | Referred By | Watchlist | Onboarded |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
"""
        if not internal['new_users_detailed']:
            report_md += "| No new signups | - | - | - | - | - | - |\n"
        else:
            for u in internal['new_users_detailed']:
                report_md += f"| `{u['user_id']}` | {u['created_at']} | {u['type']} | {u['tier']} | {u['referred_by'] if u['referred_by'] else '-'} | {u['watchlist_count']} | {'✅' if u['onboarded'] else '❌'} |\n"

        if ga:
            report_md += "\n## 📉 Traffic Trend (GA4 7d)\n"
            for item in ga["daily_trend"]:
                report_md += f"- **{item['date']}**: {item['sessions']} sessions / {item['users']} users / {item['page_views']} PV\n"

            report_md += "\n## 📡 Top Traffic Sources (GA4 7d)\n"
            for s in ga["top_sources"]:
                report_md += f"- **{s['source_medium']}**: {s['sessions']} sessions / {s['users']} users\n"

            report_md += "\n## 📄 Top Landing Pages (GA4 7d)\n"
            for p in ga["top_pages"]:
                report_md += f"- `{p['path']}`: {p['sessions']} sessions / {p['users']} users\n"

            report_md += "\n## 🌍 Geography Mix (GA4 30d)\n"
            for item in ga["geo_mix"]:
                report_md += f"- **{item['country']}**: {item['sessions']} sessions / {item['users']} users\n"

            report_md += "\n## 📱 Device Mix (GA4 30d)\n"
            for item in ga["device_mix"]:
                report_md += f"- **{item['device']}**: {item['sessions']} sessions / {item['users']} users\n"
        else:
            report_md += "\n## 📉 Traffic Trend (GA4 7d)\n- GA4 data unavailable for this run.\n"
            report_md += "\n## 📡 Top Traffic Sources (GA4 7d)\n- GA4 data unavailable for this run.\n"
            report_md += "\n## 📄 Top Landing Pages (GA4 7d)\n- GA4 data unavailable for this run.\n"
            report_md += "\n## 🌍 Geography Mix (GA4 30d)\n- GA4 data unavailable for this run.\n"
            report_md += "\n## 📱 Device Mix (GA4 30d)\n- GA4 data unavailable for this run.\n"

        report_md += "\n## 🧾 Internal Trend (DB 7d)\n"
        for item in internal["signup_trend"]:
            report_md += f"- **{item['day']}**: {item['user_rows']} user rows / {item['activated']} activated\n"
        for item in internal["watchlist_trend"]:
            report_md += f"- **{item['day']}**: {item['adds']} watchlist adds\n"

        report_md += "\n## 🔥 Trending Symbols (Internal Watchlist 30d)\n"
        if not internal['top_symbols']:
             report_md += "No new additions in the last 30 days.\n"
        else:
            for item in internal['top_symbols']:
                report_md += f"- **{item['symbol']}**: {item['count']} additions / {item['users']} users\n"

        print(report_md)
        
        # Save to file
        os.makedirs("tmp", exist_ok=True)
        report_file = "tmp/latest_growth_pulse.md"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report_md)
        print(f"\n✅ Report generated and saved to: {report_file}")
        
    except Exception as e:
        print(f"❌ Failed to generate growth report: {e}")

def main():
    parser = argparse.ArgumentParser(description="Collect StockWise growth metrics.")
    parser.add_argument("--persist", action="store_true", help="Persist the daily snapshot into growth_daily_snapshots.")
    parser.add_argument("--date", default=None, help="Snapshot date in YYYY-MM-DD. Defaults to Beijing today.")
    parser.add_argument("--print-only", action="store_true", help="Generate the legacy Markdown report only.")
    parser.add_argument("--require-external", action="store_true", help="Treat missing GA4 configuration as a collection error.")
    args = parser.parse_args()

    if args.persist:
        payload = collect_growth_payload(require_external=args.require_external)
        result = persist_growth_snapshot(payload, snapshot_date=args.date)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    generate_report()


if __name__ == "__main__":
    main()
