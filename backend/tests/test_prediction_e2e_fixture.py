import asyncio
import sqlite3
from datetime import date, timedelta

import backend.engine.prompts as prompts
from backend.engine.model_policy import model_allows_tier, parse_model_policy


def _build_fixture_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    cur = conn.cursor()
    cur.execute("CREATE TABLE stock_meta (symbol TEXT PRIMARY KEY, name TEXT, name_en TEXT)")
    cur.execute(
        """
        CREATE TABLE daily_prices (
            symbol TEXT,
            date TEXT,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            change_percent REAL,
            volume INTEGER,
            ma5 REAL,
            ma10 REAL,
            ma20 REAL,
            ma60 REAL,
            macd REAL,
            macd_signal REAL,
            macd_hist REAL,
            rsi REAL,
            kdj_k REAL,
            kdj_d REAL,
            kdj_j REAL,
            boll_upper REAL,
            boll_mid REAL,
            boll_lower REAL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE weekly_prices (
            symbol TEXT,
            date TEXT,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            change_percent REAL,
            volume INTEGER,
            ma20 REAL,
            rsi REAL,
            macd_hist REAL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE monthly_prices (
            symbol TEXT,
            date TEXT,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            change_percent REAL,
            volume INTEGER,
            ma20 REAL,
            rsi REAL,
            macd_hist REAL
        )
        """
    )
    cur.execute("INSERT INTO stock_meta(symbol, name, name_en) VALUES ('000001', '平安银行', 'Ping An Bank')")

    start = date(2026, 3, 2)
    rows = []
    for i in range(30):
        d = (start + timedelta(days=i)).isoformat()
        close = 10 + i * 0.1
        rows.append(
            (
                "000001",
                d,
                close - 0.1,
                close + 0.2,
                close - 0.2,
                close,
                0.5,
                100000 + i,
                close,
                close,
                close,
                close,
                0.1,
                0.05,
                0.02,
                55,
                50,
                45,
                55,
                close + 1,
                close,
                close - 1,
            )
        )
    cur.executemany(
        """
        INSERT INTO daily_prices (
            symbol, date, open, high, low, close, change_percent, volume,
            ma5, ma10, ma20, ma60, macd, macd_signal, macd_hist,
            rsi, kdj_k, kdj_d, kdj_j, boll_upper, boll_mid, boll_lower
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    conn.commit()
    return conn


def test_prediction_e2e_fixture_skips_external_context(monkeypatch):
    conn = _build_fixture_db()
    monkeypatch.setenv("PREDICTION_E2E_FIXTURE", "1")
    monkeypatch.setattr(prompts, "get_connection", lambda: conn)
    monkeypatch.setattr(prompts, "get_stock_profile", lambda symbol: ("银行", "零售银行", "测试简介"))

    result = asyncio.run(prompts.fetch_full_analysis_context("000001", "2026-03-31"))

    assert result["symbol"] == "000001"
    assert result["date"] == "2026-03-31"
    assert len(result["daily_prices"]) == 30
    assert result["macro_context"]["source"] == "local:e2e"
    assert result["market_flow_context"]["status"] == "fixture"
    assert result["stock_flow_context"]["symbol"] == "000001"


def test_prediction_e2e_fixture_allows_empty_rule_engine_policy(monkeypatch):
    monkeypatch.setenv("PREDICTION_E2E_FIXTURE", "1")

    policy = parse_model_policy("rule-engine", "{}")

    assert model_allows_tier(policy, ["free"])
    assert model_allows_tier(policy, ["plus"])
