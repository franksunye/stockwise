import sqlite3

from backend.scripts.backfill_mode_performance import resolve_prediction_dates


def test_resolve_prediction_dates_filters_market_and_range():
    conn = sqlite3.connect(":memory:")
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE ai_predictions_v2 (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            is_primary INTEGER DEFAULT 0
        )
        """
    )
    cur.execute(
        "CREATE TABLE stock_meta (symbol TEXT PRIMARY KEY, name TEXT, name_en TEXT, market TEXT NOT NULL)"
    )
    cur.executemany(
        "INSERT INTO stock_meta(symbol, market) VALUES (?, ?)",
        [
            ("000001", "CN"),
            ("000002", "CN"),
            ("00700", "HK"),
        ],
    )
    cur.executemany(
        "INSERT INTO ai_predictions_v2(symbol, date, is_primary) VALUES (?, ?, ?)",
        [
            ("000001", "2026-03-03", 1),
            ("000002", "2026-03-04", 1),
            ("00700", "2026-03-04", 1),
            ("00700", "2026-03-05", 0),
            ("00700", "2026-03-06", 1),
        ],
    )
    conn.commit()

    assert resolve_prediction_dates(conn, market="CN", start_date="2026-03-01", end_date="2026-03-31") == [
        "2026-03-03",
        "2026-03-04",
    ]
    assert resolve_prediction_dates(conn, market="HK", start_date="2026-03-04", end_date="2026-03-31") == [
        "2026-03-04",
        "2026-03-06",
    ]
    assert resolve_prediction_dates(conn, market="ALL", start_date="2026-03-04", end_date="2026-03-04") == [
        "2026-03-04"
    ]
