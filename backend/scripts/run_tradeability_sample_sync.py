"""
Tradeability sample sync runner.

Purpose:
1) Expand daily_prices coverage after close for research/calibration samples.
2) Keep it independent from intraday realtime sync and user-facing watchlist sync.
3) Prioritize missing or stale symbols so the cloud sample set grows over time.
"""

from __future__ import annotations

import argparse
import os
import sys
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Dict, List

import pandas as pd

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import execute_with_retry, get_connection
from fetchers import fetch_stock_data, sync_stock_meta
from logger import logger
from sync.prices import _calculate_indicators_safe
from backend.db_repo.queries import get_save_prices_sql
from backend.quant.sample_sync_utils import CandidateRow, resolve_sync_start_date, select_cn_candidates, stable_bucket


def load_symbols_from_manifest(manifest_path: str) -> List[str]:
    payload = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    symbols = [str(item.get("symbol")) for item in payload.get("symbols") or [] if item.get("symbol")]
    if not symbols:
        raise ValueError(f"No symbols found in manifest: {manifest_path}")
    return symbols


def load_manifest_candidates(market: str, manifest_path: str) -> List[CandidateRow]:
    symbols = load_symbols_from_manifest(manifest_path)
    conn = get_connection()
    try:
        cur = conn.cursor()
        placeholders = ",".join(["?"] * len(symbols))
        rows = cur.execute(
            f"""
            SELECT sm.symbol, sm.name, COALESCE(COUNT(dp.date), 0) AS row_count, MAX(dp.date) AS last_date
            FROM stock_meta sm
            LEFT JOIN daily_prices dp ON dp.symbol = sm.symbol
            WHERE sm.market = ?
              AND sm.symbol IN ({placeholders})
            GROUP BY sm.symbol, sm.name
            ORDER BY sm.symbol
            """,
            [market, *symbols],
        ).fetchall()
        by_symbol = {
            str(row[0]): (str(row[0]), str(row[1]), int(row[2] or 0), str(row[3]) if row[3] else None, 0)
            for row in rows
        }
        return [by_symbol[symbol] for symbol in symbols if symbol in by_symbol]
    finally:
        conn.close()


def _candidate_query(market: str, limit: int, latest_market_date: str, include_global_pool: bool, include_fresh: bool) -> str:
    if market == "CN":
        symbol_filter = "LENGTH(m.symbol) = 6 AND substr(m.symbol, 1, 1) IN ('0', '3', '6')"
    else:
        symbol_filter = "LENGTH(m.symbol) = 5"

    global_pool_filter = "" if include_global_pool else "AND gp.symbol IS NULL"
    freshness_filter = "" if include_fresh else "HAVING COUNT(dp.date) = 0 OR MAX(dp.date) IS NULL OR MAX(dp.date) < ?"

    return f"""
        WITH coverage AS (
            SELECT
                m.symbol,
                m.name,
                COALESCE(COUNT(dp.date), 0) AS row_count,
                MAX(dp.date) AS last_date,
                CASE WHEN gp.symbol IS NOT NULL THEN 1 ELSE 0 END AS in_global_pool,
                CASE
                    WHEN COUNT(dp.date) = 0 THEN 0
                    WHEN MAX(dp.date) IS NULL THEN 0
                    WHEN MAX(dp.date) < ? THEN 1
                    ELSE 2
                END AS freshness_rank
            FROM stock_meta m
            LEFT JOIN daily_prices dp ON dp.symbol = m.symbol
            LEFT JOIN global_stock_pool gp ON gp.symbol = m.symbol
            WHERE m.market = ?
              AND {symbol_filter}
              {global_pool_filter}
              AND m.name NOT LIKE '%ST%'
              AND m.name NOT LIKE '*ST%'
              AND m.name NOT LIKE '%退%'
            GROUP BY m.symbol, m.name, gp.symbol
            {freshness_filter}
        )
        SELECT symbol, name, row_count, last_date, freshness_rank
        FROM coverage
        ORDER BY freshness_rank ASC, row_count ASC, in_global_pool ASC, symbol ASC
        LIMIT {int(max(limit * 20, 2000))}
    """


def resolve_latest_market_date(market: str) -> str | None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        row = cur.execute(
            """
            SELECT MAX(dp.date)
            FROM daily_prices dp
            JOIN stock_meta sm ON sm.symbol = dp.symbol
            WHERE sm.market = ?
            """,
            (market,),
        ).fetchone()
        return str(row[0]) if row and row[0] else None
    finally:
        conn.close()


def load_candidate_symbols(
    market: str,
    limit: int,
    latest_market_date: str,
    include_global_pool: bool,
    include_fresh: bool,
) -> List[CandidateRow]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        query = _candidate_query(market, limit, latest_market_date, include_global_pool, include_fresh)
        params: List[object] = [latest_market_date, market]
        if not include_fresh:
            params.append(latest_market_date)
        rows = cur.execute(query, tuple(params)).fetchall()
        candidates = [(str(r[0]), str(r[1]), int(r[2] or 0), str(r[3]) if r[3] else None, int(r[4] or 0)) for r in rows]
        if market != "CN":
            candidates.sort(key=lambda row: (row[4], row[2], stable_bucket(row[0])))
            return candidates[:limit]
        return select_cn_candidates(candidates, limit)
    finally:
        conn.close()


def _normalize_daily_df(df: pd.DataFrame) -> pd.DataFrame:
    work = df.rename(
        columns={
            "日期": "date",
            "开盘": "open",
            "收盘": "close",
            "最高": "high",
            "最低": "low",
            "成交量": "volume",
            "涨跌幅": "change_percent",
        }
    ).copy()
    work["date"] = pd.to_datetime(work["date"]).dt.strftime("%Y-%m-%d")
    for col in ["open", "high", "low", "close", "volume", "change_percent"]:
        work[col] = pd.to_numeric(work[col], errors="coerce")
    work = work.dropna(subset=["date", "open", "high", "low", "close", "volume", "change_percent"])
    work = work[work["close"] > 0]
    work = work[work["volume"] >= 0]
    work = work.sort_values("date").drop_duplicates(subset=["date"], keep="last").reset_index(drop=True)
    return work


def _upsert_daily_prices(symbol: str, df: pd.DataFrame) -> int:
    if df.empty:
        return 0

    records = []

    def r2(x): return round(float(x), 2) if x is not None else 0.0
    def r3(x): return round(float(x), 3) if x is not None else 0.0
    def r1(x): return round(float(x), 1) if x is not None else 0.0

    for _, row in df.iterrows():
        records.append(
            (
                symbol,
                row["date"],
                r2(row["open"]),
                r2(row["high"]),
                r2(row["low"]),
                r2(row["close"]),
                int(row["volume"]),
                r2(row["change_percent"]),
                r2(row.get("ma5")),
                r2(row.get("ma10")),
                r2(row.get("ma20")),
                r2(row.get("ma60")),
                r3(row.get("macd")),
                r3(row.get("macd_signal")),
                r3(row.get("macd_hist")),
                r2(row.get("boll_upper")),
                r2(row.get("boll_mid")),
                r2(row.get("boll_lower")),
                r1(row.get("rsi")),
                r1(row.get("kdj_k")),
                r1(row.get("kdj_d")),
                r1(row.get("kdj_j")),
                None,
            )
        )

    def _save(conn, _records):
        cur = conn.cursor()
        cur.executemany(get_save_prices_sql("daily_prices"), _records)

    execute_with_retry(_save, 3, records)
    return len(records)


def sync_symbol(symbol: str, history_start_date: str, last_date: str | None, incremental_buffer_days: int) -> Dict[str, object]:
    start_date = resolve_sync_start_date(history_start_date, last_date, incremental_buffer_days)
    try:
        raw = fetch_stock_data(symbol, period="daily", start_date=start_date.replace("-", ""))
        if raw.empty:
            return {"symbol": symbol, "ok": False, "rows": 0, "reason": "empty_fetch", "start_date": start_date}
        daily = _normalize_daily_df(raw)
        if daily.empty:
            return {"symbol": symbol, "ok": False, "rows": 0, "reason": "empty_after_normalize", "start_date": start_date}
        daily = _calculate_indicators_safe(daily)
        rows = _upsert_daily_prices(symbol, daily)
        return {
            "symbol": symbol,
            "ok": True,
            "rows": rows,
            "start_date": start_date,
            "actual_start_date": daily["date"].min(),
            "actual_end_date": daily["date"].max(),
        }
    except Exception as exc:
        logger.warning(f"Sample sync failed for {symbol}: {exc}")
        return {"symbol": symbol, "ok": False, "rows": 0, "reason": str(exc), "start_date": start_date}


def _market_summary(market: str) -> Dict[str, object]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        row = cur.execute(
            """
            SELECT MIN(dp.date), MAX(dp.date), COUNT(*), COUNT(DISTINCT dp.symbol)
            FROM daily_prices dp
            JOIN stock_meta sm ON sm.symbol = dp.symbol
            WHERE sm.market = ?
            """,
            (market,),
        ).fetchone()
        latest = cur.execute(
            """
            SELECT COUNT(*)
            FROM daily_prices dp
            JOIN stock_meta sm ON sm.symbol = dp.symbol
            WHERE sm.market = ?
              AND dp.date = (
                SELECT MAX(dp2.date)
                FROM daily_prices dp2
                JOIN stock_meta sm2 ON sm2.symbol = dp2.symbol
                WHERE sm2.market = ?
              )
            """,
            (market, market),
        ).fetchone()
        return {
            "min_date": row[0] if row else None,
            "max_date": row[1] if row else None,
            "rows": int(row[2] or 0) if row else 0,
            "symbols": int(row[3] or 0) if row else 0,
            "latest_date_symbol_count": int(latest[0] or 0) if latest else 0,
        }
    finally:
        conn.close()


def run_sample_sync(
    market: str,
    target_symbols: int,
    history_start_date: str,
    incremental_buffer_days: int,
    max_workers: int,
    sync_meta: bool,
    include_global_pool: bool,
    include_fresh: bool,
    research_pool_manifest: str,
) -> Dict[str, object]:
    before = _market_summary(market)
    if sync_meta:
        sync_stock_meta()

    latest_market_date = resolve_latest_market_date(market)
    if not latest_market_date:
        raise RuntimeError(f"No latest market date found for market={market}. Seed daily_prices first.")

    if research_pool_manifest:
        candidates = load_manifest_candidates(market=market, manifest_path=research_pool_manifest)
    else:
        candidates = load_candidate_symbols(
            market=market,
            limit=target_symbols,
            latest_market_date=latest_market_date,
            include_global_pool=include_global_pool,
            include_fresh=include_fresh,
        )
    logger.info(
        "Sample sync starting. market=%s, latest_date=%s, candidates=%s, include_global_pool=%s, include_fresh=%s, manifest=%s",
        market,
        latest_market_date,
        len(candidates),
        include_global_pool,
        include_fresh,
        research_pool_manifest or "",
    )

    results: List[Dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=max(1, max_workers)) as pool:
        futures = [
            pool.submit(sync_symbol, symbol, history_start_date, last_date, incremental_buffer_days)
            for symbol, _, _, last_date, _ in candidates
        ]
        for future in as_completed(futures):
            results.append(future.result())

    after = _market_summary(market)
    ok_count = sum(1 for item in results if item["ok"])
    payload = {
        "market": market,
        "run_at": datetime.now().isoformat(timespec="seconds"),
        "history_start_date": history_start_date,
        "latest_market_date": latest_market_date,
        "incremental_buffer_days": incremental_buffer_days,
        "target_symbols": target_symbols,
        "research_pool_manifest": research_pool_manifest or None,
        "selected_candidates": [
            {
                "symbol": symbol,
                "name": name,
                "existing_rows": row_count,
                "last_date": last_date,
                "freshness_rank": freshness_rank,
            }
            for symbol, name, row_count, last_date, freshness_rank in candidates
        ],
        "before": before,
        "after": after,
        "success_count": ok_count,
        "failed_count": len(results) - ok_count,
        "results": sorted(results, key=lambda item: str(item["symbol"])),
    }
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Run nightly tradeability sample sync.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--target-symbols", type=int, default=150)
    parser.add_argument("--history-start-date", default="2024-01-01")
    parser.add_argument("--incremental-buffer-days", type=int, default=14)
    parser.add_argument("--max-workers", type=int, default=2)
    parser.add_argument("--sync-meta", action="store_true")
    parser.add_argument("--include-global-pool", action="store_true")
    parser.add_argument("--include-fresh", action="store_true")
    parser.add_argument("--research-pool-manifest", default="", help="Optional repo-relative or absolute manifest path")
    args = parser.parse_args()

    payload = run_sample_sync(
        market=args.market,
        target_symbols=args.target_symbols,
        history_start_date=args.history_start_date,
        incremental_buffer_days=args.incremental_buffer_days,
        max_workers=args.max_workers,
        sync_meta=args.sync_meta,
        include_global_pool=args.include_global_pool,
        include_fresh=args.include_fresh,
        research_pool_manifest=args.research_pool_manifest,
    )
    print(pd.Series(payload).to_json(force_ascii=False, indent=2))


if __name__ == "__main__":
    main()
