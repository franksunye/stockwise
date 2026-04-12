"""Unit tests for trading-calendar market-time behavior."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from backend.trading_calendar import get_market_weekday, is_market_closed, is_realtime_session_open

SH = ZoneInfo("Asia/Shanghai")


@pytest.mark.parametrize(
    "market,hour,minute,expected",
    [
        ("CN", 10, 0, True),
        ("CN", 11, 30, False),
        ("CN", 12, 0, False),
        ("CN", 14, 0, True),
        ("CN", 15, 0, False),
        ("HK", 11, 0, True),
        ("HK", 12, 30, False),
        ("HK", 15, 0, True),
    ],
)
def test_cn_hk_session_windows_weekday(market, hour, minute, expected):
    # 2026-04-08 Wednesday — not a hardcoded CN/HK holiday in defaults
    at = datetime(2026, 4, 8, hour, minute, tzinfo=SH)
    assert is_realtime_session_open(market, at) is expected


def test_us_session_regular_hours():
    # 22:30 Beijing = 10:30 US Eastern on 2026-04-08 (EDT)
    at = datetime(2026, 4, 8, 22, 30, tzinfo=SH)
    assert is_realtime_session_open("US", at) is True


def test_us_session_closed_evening_beijing():
    at = datetime(2026, 4, 8, 6, 0, tzinfo=SH)
    assert is_realtime_session_open("US", at) is False


def test_weekend_cn_closed():
    at = datetime(2026, 4, 11, 10, 0, tzinfo=SH)  # Saturday
    assert is_realtime_session_open("CN", at) is False


def test_us_market_not_closed_during_beijing_saturday_settlement_window():
    # 2026-04-11 06:30 BJT = 2026-04-10 18:30 ET (Friday after close)
    at = datetime(2026, 4, 11, 6, 30, tzinfo=SH)
    assert is_market_closed(at, "US") is False


def test_us_market_weekday_tracks_eastern_not_beijing():
    # Beijing Saturday should still be market Friday in New York for late settlement.
    at = datetime(2026, 4, 11, 6, 30, tzinfo=SH)
    assert get_market_weekday(at, "US") == 4


def test_us_market_closed_handles_naive_beijing_dates():
    # Many scheduler callers pass naive datetimes derived from Beijing-local dates.
    at = datetime(2026, 4, 11, 0, 0)
    assert is_market_closed(at, "US") is False
