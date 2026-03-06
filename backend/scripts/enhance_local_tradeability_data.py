"""
Enhance local tradeability research data using existing AkShare fetchers.

Purpose:
1) Expand local CN/HK daily data coverage for Layer-1 research.
2) Reuse existing fetch + indicator + storage logic instead of creating a parallel pipeline.
3) Keep the output local-only and safe for iterative experimentation.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Dict, List, Sequence, Tuple

import pandas as pd

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import execute_with_retry, get_connection
from fetchers import fetch_stock_data, sync_stock_meta
from logger import logger
from sync.prices import _calculate_indicators_safe
from backend.db_repo.queries import get_save_prices_sql


def _candidate_query(market: str, limit: int) -> str:
    if market == "CN":
        symbol_filter = "LENGTH(m.symbol) = 6 AND substr(m.symbol, 1, 1) IN ('0', '3', '6')"
    else:
        symbol_filter = "LENGTH(m.symbol) = 5"
    return f"""
        WITH coverage AS (
            SELECT
                m.symbol,
                m.name,
                COALESCE(COUNT(dp.date), 0) AS row_count,
                MAX(dp.date) AS last_date,
                CASE WHEN gp.symbol IS NOT NULL THEN 1 ELSE 0 END AS in_global_pool
            FROM stock_meta m
            LEFT JOIN daily_prices dp ON dp.symbol = m.symbol
            LEFT JOIN global_stock_pool gp ON gp.symbol = m.symbol
            WHERE m.market = ?
              AND {symbol_filter}
              AND m.name NOT LIKE '%ST%'
              AND m.name NOT LIKE '*ST%'
              AND m.name NOT LIKE '%退%'
            GROUP BY m.symbol, m.name, gp.symbol
        )
        SELECT symbol, name, row_count, last_date, in_global_pool
        FROM coverage
        ORDER BY in_global_pool DESC, row_count DESC, symbol ASC
        LIMIT {int(max(limit * 20, 6000))}
    """


def load_candidate_symbols(market: str, limit: int) -> List[Tuple[str, str, int, str | None, int]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        rows = cur.execute(_candidate_query(market, limit), (market,)).fetchall()
        candidates = [(str(r[0]), str(r[1]), int(r[2] or 0), str(r[3]) if r[3] else None, int(r[4] or 0)) for r in rows]
        if market != "CN":
            return candidates[:limit]
        return _select_cn_candidates(candidates, limit)
    finally:
        conn.close()


def _stable_bucket(symbol: str) -> int:
    # Stable pseudo-random ordering avoids code-order bias while keeping runs reproducible.
    return int(hashlib.md5(symbol.encode("utf-8")).hexdigest()[:8], 16)


def _board_quota(board_sizes: Dict[str, int], total_limit: int) -> Dict[str, int]:
    total = sum(board_sizes.values()) or 1
    quotas = {board: max(10, round(total_limit * size / total)) for board, size in board_sizes.items() if size > 0}
    assigned = sum(quotas.values())
    ordered_boards = sorted(board_sizes, key=lambda board: board_sizes[board], reverse=True)
    while assigned > total_limit and ordered_boards:
        for board in ordered_boards:
            if assigned <= total_limit:
                break
            if quotas.get(board, 0) > 10:
                quotas[board] -= 1
                assigned -= 1
    while assigned < total_limit and ordered_boards:
        for board in ordered_boards:
            if assigned >= total_limit:
                break
            quotas[board] = quotas.get(board, 0) + 1
            assigned += 1
    return quotas


def _select_cn_candidates(
    candidates: List[Tuple[str, str, int, str | None, int]],
    limit: int,
) -> List[Tuple[str, str, int, str | None, int]]:
    grouped: Dict[str, List[Tuple[str, str, int, str | None, int]]] = {"6": [], "0": [], "3": []}
    for row in candidates:
        board = row[0][0]
        if board in grouped:
            grouped[board].append(row)

    board_sizes = {board: len(rows) for board, rows in grouped.items()}
    quotas = _board_quota(board_sizes, limit)
    selected: List[Tuple[str, str, int, str | None, int]] = []

    for board, rows in grouped.items():
        watched = [row for row in rows if row[4] > 0]
        covered = [row for row in rows if row[4] == 0 and row[2] > 0]
        uncovered = [row for row in rows if row[4] == 0 and row[2] == 0]

        watched.sort(key=lambda row: (-row[4], -row[2], row[0]))
        covered.sort(key=lambda row: (-row[2], _stable_bucket(row[0])))
        uncovered.sort(key=lambda row: _stable_bucket(row[0]))

        quota = quotas.get(board, 0)
        board_selected: List[Tuple[str, str, int, str | None, int]] = []
        board_selected.extend(watched[: min(len(watched), quota)])
        need = quota - len(board_selected)
        if need > 0:
            board_selected.extend(covered[: min(len(covered), need)])
            need = quota - len(board_selected)
        if need > 0:
            board_selected.extend(uncovered[:need])
        selected.extend(board_selected)

    if len(selected) < limit:
        selected_symbols = {row[0] for row in selected}
        remainder = [row for row in candidates if row[0] not in selected_symbols]
        remainder.sort(key=lambda row: (-row[4], -row[2], _stable_bucket(row[0])))
        selected.extend(remainder[: limit - len(selected)])

    return selected[:limit]


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


def enhance_symbol(symbol: str, start_date: str) -> Dict[str, object]:
    try:
        raw = fetch_stock_data(symbol, period="daily", start_date=start_date.replace("-", ""))
        if raw.empty:
            return {"symbol": symbol, "ok": False, "rows": 0, "reason": "empty_fetch"}
        daily = _normalize_daily_df(raw)
        if daily.empty:
            return {"symbol": symbol, "ok": False, "rows": 0, "reason": "empty_after_normalize"}
        daily = _calculate_indicators_safe(daily)
        rows = _upsert_daily_prices(symbol, daily)
        return {
            "symbol": symbol,
            "ok": True,
            "rows": rows,
            "start_date": daily["date"].min(),
            "end_date": daily["date"].max(),
        }
    except Exception as e:
        logger.warning(f"Local enhancement failed for {symbol}: {e}")
        return {"symbol": symbol, "ok": False, "rows": 0, "reason": str(e)}


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Enhance local tradeability research data.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--target-symbols", type=int, default=200)
    parser.add_argument("--start-date", default="2024-01-01")
    parser.add_argument("--max-workers", type=int, default=4)
    parser.add_argument("--sync-meta", action="store_true")
    args = parser.parse_args()

    before = _market_summary(args.market)
    if args.sync_meta:
        sync_stock_meta()

    candidates = load_candidate_symbols(args.market, args.target_symbols)
    logger.info(f"Local enhancement starting. market={args.market}, candidates={len(candidates)}, start={args.start_date}")

    results: List[Dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as pool:
        futures = [pool.submit(enhance_symbol, symbol, args.start_date) for symbol, _, _, _, _ in candidates]
        for future in as_completed(futures):
            results.append(future.result())

    after = _market_summary(args.market)
    ok_count = sum(1 for x in results if x["ok"])
    payload = {
        "market": args.market,
        "run_at": datetime.now().isoformat(timespec="seconds"),
        "start_date": args.start_date,
        "target_symbols": args.target_symbols,
        "selected_candidates": [
            {
                "symbol": symbol,
                "name": name,
                "existing_rows": row_count,
                "last_date": last_date,
                "in_global_pool": in_global_pool,
            }
            for symbol, name, row_count, last_date, in_global_pool in candidates
        ],
        "before": before,
        "after": after,
        "success_count": ok_count,
        "failed_count": len(results) - ok_count,
        "results": results,
    }
    print(pd.Series(payload).to_json(force_ascii=False, indent=2))


if __name__ == "__main__":
    main()
