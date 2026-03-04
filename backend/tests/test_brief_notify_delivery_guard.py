import asyncio
import sqlite3
from pathlib import Path

from backend.engine.services import brief_assembler


def _init_db(db_path: Path):
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    cur.execute("CREATE TABLE users (user_id TEXT PRIMARY KEY, subscription_tier TEXT)")
    cur.execute("CREATE TABLE daily_briefs (user_id TEXT, date TEXT, push_hook TEXT, notified_at TEXT)")
    cur.execute("CREATE TABLE push_subscriptions (user_id TEXT)")

    cur.execute("INSERT INTO users (user_id, subscription_tier) VALUES ('u1', 'free')")
    cur.execute(
        "INSERT INTO daily_briefs (user_id, date, push_hook, notified_at) VALUES ('u1', '2026-03-04', '📈 测试 hook', NULL)"
    )
    cur.execute("INSERT INTO push_subscriptions (user_id) VALUES ('u1')")
    conn.commit()
    conn.close()


class _FakeNotificationManager:
    delivered = 0

    def __init__(self, conn=None):
        self.conn = conn
        self.user_tier_cache = {}

    def queue_notification(self, user_id, notif_type, payload):
        return None

    def flush(self):
        return self.delivered


def test_not_mark_notified_when_delivery_fails(tmp_path, monkeypatch):
    db_path = tmp_path / "brief_notify_fail.db"
    _init_db(db_path)

    monkeypatch.setattr(brief_assembler, "get_connection", lambda: sqlite3.connect(str(db_path)))
    _FakeNotificationManager.delivered = 0
    import backend.notification_service as notification_service
    monkeypatch.setattr(notification_service, "NotificationManager", _FakeNotificationManager)

    asyncio.run(brief_assembler.notify_user_brief_ready("u1", "2026-03-04"))

    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    cur.execute("SELECT notified_at FROM daily_briefs WHERE user_id = 'u1' AND date = '2026-03-04'")
    row = cur.fetchone()
    conn.close()
    assert row is not None and row[0] is None


def test_mark_notified_when_delivery_succeeds(tmp_path, monkeypatch):
    db_path = tmp_path / "brief_notify_ok.db"
    _init_db(db_path)

    monkeypatch.setattr(brief_assembler, "get_connection", lambda: sqlite3.connect(str(db_path)))
    _FakeNotificationManager.delivered = 1
    import backend.notification_service as notification_service
    monkeypatch.setattr(notification_service, "NotificationManager", _FakeNotificationManager)

    asyncio.run(brief_assembler.notify_user_brief_ready("u1", "2026-03-04"))

    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    cur.execute("SELECT notified_at FROM daily_briefs WHERE user_id = 'u1' AND date = '2026-03-04'")
    row = cur.fetchone()
    conn.close()
    assert row is not None and row[0] is not None
