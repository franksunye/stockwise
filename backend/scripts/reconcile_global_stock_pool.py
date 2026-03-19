"""
Reconcile global_stock_pool with user_watchlist.

Purpose:
- ensure watchers_count equals actual watcher cardinality
- delete symbols with watchers_count <= 0
- write one audit row into ops_pool_reconcile_runs
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime

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


CREATE_RUNS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ops_pool_reconcile_runs (
    run_id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    mismatch_before INTEGER DEFAULT 0,
    mismatch_after INTEGER DEFAULT 0,
    non_positive_before INTEGER DEFAULT 0,
    non_positive_after INTEGER DEFAULT 0,
    updated_rows INTEGER DEFAULT 0,
    deleted_rows INTEGER DEFAULT 0,
    details_json TEXT,
    error_message TEXT
)
"""

CREATE_FALLBACK_EVENTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ops_broadcast_fallback_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    market TEXT NOT NULL DEFAULT 'all',
    reason TEXT,
    failure_streak INTEGER DEFAULT 0,
    circuit_open_until TEXT,
    client_time TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
)
"""

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

RETENTION_DAYS = 30


def _scalar(cursor, sql: str) -> int:
    cursor.execute(sql)
    row = cursor.fetchone()
    return int(row[0] or 0) if row else 0


def main() -> int:
    run_id = str(uuid.uuid4())
    started_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(CREATE_RUNS_TABLE_SQL)
        cursor.execute(CREATE_FALLBACK_EVENTS_TABLE_SQL)
        cursor.execute(CREATE_HEALTH_TABLE_SQL)
        cursor.execute(
            """
            INSERT INTO ops_pool_reconcile_runs (
                run_id, started_at, status
            ) VALUES (?, ?, ?)
            """,
            (run_id, started_at, "running"),
        )
        conn.commit()

        mismatch_before = _scalar(
            cursor,
            """
            WITH actual AS (
                SELECT symbol, COUNT(1) AS actual_count
                FROM user_watchlist
                GROUP BY symbol
            )
            SELECT COUNT(1)
            FROM global_stock_pool gp
            LEFT JOIN actual a ON a.symbol = gp.symbol
            WHERE COALESCE(gp.watchers_count, 0) != COALESCE(a.actual_count, 0)
            """,
        )
        non_positive_before = _scalar(
            cursor,
            "SELECT COUNT(1) FROM global_stock_pool WHERE COALESCE(watchers_count, 0) <= 0",
        )

        cursor.execute(
            """
            UPDATE global_stock_pool
            SET watchers_count = COALESCE(
                (
                    SELECT COUNT(1)
                    FROM user_watchlist uw
                    WHERE uw.symbol = global_stock_pool.symbol
                ),
                0
            )
            """
        )
        updated_rows = int(cursor.rowcount or 0)

        cursor.execute("DELETE FROM global_stock_pool WHERE COALESCE(watchers_count, 0) <= 0")
        deleted_rows = int(cursor.rowcount or 0)

        # Keep ops data bounded for predictable query latency and storage.
        cursor.execute(
            f"""
            DELETE FROM ops_broadcast_health
            WHERE datetime(checked_at) < datetime('now', '-{RETENTION_DAYS} day')
            """
        )
        pruned_health_rows = int(cursor.rowcount or 0)
        cursor.execute(
            f"""
            DELETE FROM ops_broadcast_fallback_events
            WHERE datetime(created_at) < datetime('now', '-{RETENTION_DAYS} day')
            """
        )
        pruned_fallback_rows = int(cursor.rowcount or 0)
        cursor.execute(
            f"""
            DELETE FROM ops_pool_reconcile_runs
            WHERE datetime(started_at) < datetime('now', '-{RETENTION_DAYS} day')
            """
        )
        pruned_reconcile_rows = int(cursor.rowcount or 0)

        mismatch_after = _scalar(
            cursor,
            """
            WITH actual AS (
                SELECT symbol, COUNT(1) AS actual_count
                FROM user_watchlist
                GROUP BY symbol
            )
            SELECT COUNT(1)
            FROM global_stock_pool gp
            LEFT JOIN actual a ON a.symbol = gp.symbol
            WHERE COALESCE(gp.watchers_count, 0) != COALESCE(a.actual_count, 0)
            """,
        )
        non_positive_after = _scalar(
            cursor,
            "SELECT COUNT(1) FROM global_stock_pool WHERE COALESCE(watchers_count, 0) <= 0",
        )

        finished_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        details = {
            "note": "reconcile watchers_count from user_watchlist and prune zero-watch symbols",
            "retention_days": RETENTION_DAYS,
            "pruned_health_rows": pruned_health_rows,
            "pruned_fallback_rows": pruned_fallback_rows,
            "pruned_reconcile_rows": pruned_reconcile_rows,
        }
        cursor.execute(
            """
            UPDATE ops_pool_reconcile_runs
            SET finished_at = ?,
                status = ?,
                mismatch_before = ?,
                mismatch_after = ?,
                non_positive_before = ?,
                non_positive_after = ?,
                updated_rows = ?,
                deleted_rows = ?,
                details_json = ?
            WHERE run_id = ?
            """,
            (
                finished_at,
                "success",
                mismatch_before,
                mismatch_after,
                non_positive_before,
                non_positive_after,
                updated_rows,
                deleted_rows,
                json.dumps(details, ensure_ascii=True),
                run_id,
            ),
        )
        conn.commit()

        logger.info(
            "[PoolReconcile] success run_id=%s mismatch %s->%s non_positive %s->%s updated=%s deleted=%s",
            run_id,
            mismatch_before,
            mismatch_after,
            non_positive_before,
            non_positive_after,
            updated_rows,
            deleted_rows,
        )
        return 0
    except Exception as exc:
        finished_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        try:
            cursor.execute(
                """
                UPDATE ops_pool_reconcile_runs
                SET finished_at = ?, status = ?, error_message = ?
                WHERE run_id = ?
                """,
                (finished_at, "failed", str(exc)[:1000], run_id),
            )
            conn.commit()
        except Exception:
            pass
        logger.exception("[PoolReconcile] failed run_id=%s error=%s", run_id, exc)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
