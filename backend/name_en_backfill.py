"""
Periodic stock_meta.name_en backfill: Yahoo Finance (yfinance) for CN/HK/US gaps (free tier).

Env (see config.load or os.environ):
  NAME_EN_YAHOO=1            — enable yfinance gap fill (default on if unset)
  NAME_EN_YAHOO_MAX_CN       — max Yahoo lookups per run for CN (default 2500)
  NAME_EN_YAHOO_MAX_HK       — max Yahoo lookups per run for HK (default 1500)
  NAME_EN_YAHOO_MAX_US       — max Yahoo lookups per run for US (default 1500)
  NAME_EN_YAHOO_SLEEP_SEC   — delay between Yahoo requests (default 0.15)
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional, Tuple

from name_en_sanitize import sanitize_name_en_candidate
from backend.logger import logger


def _env_bool(key: str, default: bool) -> bool:
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, str(default)).strip())
    except ValueError:
        return default


def _env_float(key: str, default: float) -> float:
    try:
        return float(os.getenv(key, str(default)).strip())
    except ValueError:
        return default


def symbol_to_yahoo_ticker(symbol: str, market: str) -> Optional[str]:
    """Map StockWise symbol + market to Yahoo Finance ticker, or None if unknown."""
    sym = (symbol or "").strip()
    m = (market or "").strip().upper()
    if m == "HK":
        if not sym.isdigit():
            return None
        try:
            n = int(sym, 10)
        except ValueError:
            return None
        return f"{n:04d}.HK"
    if m != "CN":
        if m == "US":
            # US tickers in DB are stored in Yahoo-compatible form, usually uppercase and
            # class shares with '-' (e.g. BRK-B). Convert accidental '.' to '-'.
            if not sym:
                return None
            return sym.upper().replace(".", "-")
        return None
    if len(sym) != 6 or not sym.isdigit():
        return None
    if sym.startswith("920"):
        return f"{sym}.BJ"
    if sym.startswith(("4", "8")):
        return f"{sym}.BJ"
    if sym.startswith("6") or (sym.startswith("9") and not sym.startswith("92")):
        return f"{sym}.SS"
    if sym.startswith(("0", "1", "2", "3")):
        return f"{sym}.SZ"
    return None


def pick_yahoo_name_en(name_cn: str, info: Dict[str, Any]) -> Optional[str]:
    """Prefer longName, then shortName; sanitize (never use longBusinessSummary — not a title)."""
    long_n = info.get("longName")
    short_n = info.get("shortName")
    for cand in (long_n, short_n):
        if isinstance(cand, str):
            ok = sanitize_name_en_candidate(name_cn, cand)
            if ok:
                return ok.strip()
    return None


def _try_yfinance_info(yahoo_ticker: str) -> Optional[Dict[str, Any]]:
    try:
        import yfinance as yf
    except ImportError:
        logger.warning("   ⚠️ name_en backfill: yfinance 未安装，跳过 Yahoo 源")
        return None
    try:
        t = yf.Ticker(yahoo_ticker)
        info = t.info
        if isinstance(info, dict) and info:
            return info
    except Exception as e:
        logger.debug(f"   Yahoo {yahoo_ticker}: {e}")
    return None


def _select_gaps(cursor, market: str, limit: int) -> List[Tuple[str, str]]:
    cursor.execute(
        """
        SELECT symbol, name FROM stock_meta
        WHERE market = ?
          AND (name_en IS NULL OR TRIM(name_en) = '')
        LIMIT ?
        """,
        (market, limit),
    )
    rows = cursor.fetchall()
    return [(str(r[0]), str(r[1] or "")) for r in rows]


def apply_yahoo_gap_fill(cursor) -> Dict[str, int]:
    stats = {"yahoo_cn": 0, "yahoo_hk": 0, "yahoo_us": 0, "yahoo_skipped": 0}
    if not _env_bool("NAME_EN_YAHOO", True):
        logger.info("   ℹ️ NAME_EN_YAHOO 已关闭，跳过 Yahoo 补全")
        return stats
    max_cn = max(0, _env_int("NAME_EN_YAHOO_MAX_CN", 2500))
    max_hk = max(0, _env_int("NAME_EN_YAHOO_MAX_HK", 1500))
    max_us = max(0, _env_int("NAME_EN_YAHOO_MAX_US", 1500))
    sleep_s = max(0.0, _env_float("NAME_EN_YAHOO_SLEEP_SEC", 0.15))

    try:
        import yfinance  # noqa: F401
    except ImportError:
        logger.warning("   ⚠️ yfinance 未安装，跳过 Yahoo name_en 补全")
        return stats

    for market, key, mmax in (
        ("CN", "yahoo_cn", max_cn),
        ("HK", "yahoo_hk", max_hk),
        ("US", "yahoo_us", max_us),
    ):
        if mmax <= 0:
            continue
        gaps = _select_gaps(cursor, market, mmax)
        if not gaps:
            continue
        logger.info(f"   🌐 Yahoo Finance 补全 {market} 缺失英文名 (最多 {len(gaps)} 条, sleep={sleep_s}s)...")
        for symbol, name_cn in gaps:
            yt = symbol_to_yahoo_ticker(symbol, market)
            if not yt:
                stats["yahoo_skipped"] += 1
                continue
            info = _try_yfinance_info(yt)
            if not info:
                stats["yahoo_skipped"] += 1
                if sleep_s:
                    time.sleep(sleep_s)
                continue
            picked = pick_yahoo_name_en(name_cn, info)
            if not picked:
                stats["yahoo_skipped"] += 1
            else:
                cursor.execute(
                    "UPDATE stock_meta SET name_en = ? WHERE symbol = ? AND market = ?",
                    (picked, symbol, market),
                )
                stats[key] += 1
            if sleep_s:
                time.sleep(sleep_s)

    return stats


def run_name_en_backfill(cursor) -> Dict[str, int]:
    """
    Run after bulk upsert, before curated JSON overrides.
    Returns simple counters for logging / JobGuard stats.
    """
    out = apply_yahoo_gap_fill(cursor)

    if out.get("yahoo_cn") or out.get("yahoo_hk") or out.get("yahoo_us"):
        logger.info(
            f"   📌 name_en 自动补全 (Yahoo): CN={out.get('yahoo_cn', 0)} "
            f"HK={out.get('yahoo_hk', 0)} US={out.get('yahoo_us', 0)} "
            f"skip/fail={out.get('yahoo_skipped', 0)}"
        )
    return out
