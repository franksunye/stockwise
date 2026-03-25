import argparse
import os
import sys
import time
from statistics import mean
from typing import Any, Dict, List, Optional, Sequence, Tuple


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(ROOT_DIR)
sys.path.append(os.path.join(ROOT_DIR, "backend"))

from backend.database import get_connection  # noqa: E402


SEMANTIC_ALIASES = {
    "建议空仓": "暂无信号",
    "空仓": "暂无信号",
    "防守": "建议防守",
    "观察": "建议观察",
    "进场": "建议看多",
    "建议进场": "建议看多",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare two-step mode overlay vs single SQL join/CTE."
    )
    parser.add_argument("--user-id", help="Sample symbols from this user's watchlist.")
    parser.add_argument("--symbols", help="Comma-separated symbols. Overrides watchlist sampling.")
    parser.add_argument("--mode-id", default="balanced_v1", help="Mode id to compare. Default: balanced_v1")
    parser.add_argument("--history-limit", type=int, default=15, help="Rows per symbol. Default: 15")
    parser.add_argument("--max-symbols", type=int, default=30, help="Max sampled symbols. Default: 30")
    parser.add_argument("--iterations", type=int, default=5, help="Benchmark iterations. Default: 5")
    return parser.parse_args()


def placeholders(count: int) -> str:
    return ",".join(["?"] * count)


def rows_to_dicts(cursor, rows: Sequence[Sequence[Any]]) -> List[Dict[str, Any]]:
    columns = [item[0] for item in (cursor.description or [])]
    return [dict(zip(columns, row)) for row in rows]


def query_rows(conn, sql: str, params: Sequence[Any] = ()) -> List[Dict[str, Any]]:
    cursor = conn.cursor()
    cursor.execute(sql, tuple(params))
    rows = cursor.fetchall()
    return rows_to_dicts(cursor, rows)


def query_one(conn, sql: str, params: Sequence[Any] = ()) -> Optional[Dict[str, Any]]:
    rows = query_rows(conn, sql, params)
    return rows[0] if rows else None


def normalize_symbols(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def normalize_semantic(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return SEMANTIC_ALIASES.get(text, text)


def pick_default_user(conn) -> Optional[str]:
    row = query_one(
        conn,
        """
        SELECT uw.user_id, COUNT(*) AS watch_count
        FROM user_watchlist uw
        INNER JOIN users u ON uw.user_id = u.user_id
        WHERE LOWER(COALESCE(u.subscription_tier, '')) = 'pro'
        GROUP BY uw.user_id
        ORDER BY watch_count DESC, uw.user_id ASC
        LIMIT 1
        """,
    )
    return str(row["user_id"]) if row and row.get("user_id") else None


def fetch_watchlist_symbols(conn, user_id: str, max_symbols: int) -> List[str]:
    rows = query_rows(
        conn,
        """
        SELECT symbol
        FROM user_watchlist
        WHERE user_id = ?
        ORDER BY added_at DESC, symbol ASC
        LIMIT ?
        """,
        [user_id, max_symbols],
    )
    return [str(row["symbol"]) for row in rows if row.get("symbol")]


def resolve_sample_symbols(conn, args: argparse.Namespace) -> Tuple[Optional[str], List[str]]:
    direct_symbols = normalize_symbols(args.symbols)
    if direct_symbols:
        return args.user_id, direct_symbols[: args.max_symbols]
    user_id = args.user_id or pick_default_user(conn)
    if not user_id:
        return None, []
    return user_id, fetch_watchlist_symbols(conn, user_id, args.max_symbols)


def fetch_predictions_two_step(conn, symbols: Sequence[str], history_limit: int) -> List[Dict[str, Any]]:
    if not symbols:
        return []
    sql = f"""
    WITH ranked AS (
        SELECT
            p.symbol,
            p.date,
            p.target_date,
            p.signal,
            p.layer1_status,
            p.confidence,
            ROW_NUMBER() OVER (PARTITION BY p.symbol ORDER BY p.date DESC) AS rn
        FROM ai_predictions_v2 p
        WHERE p.is_primary = 1
          AND p.symbol IN ({placeholders(len(symbols))})
    )
    SELECT symbol, date, target_date, signal, layer1_status, confidence
    FROM ranked
    WHERE rn <= ?
    ORDER BY symbol ASC, date DESC
    """
    return query_rows(conn, sql, [*symbols, history_limit])


def fetch_mode_rows(conn, mode_id: str, symbols: Sequence[str], decision_dates: Sequence[str]) -> List[Dict[str, Any]]:
    if not symbols or not decision_dates:
        return []
    sql = f"""
    SELECT mode_id, symbol, decision_date, decision_semantic, layer1_status
    FROM mode_decision_log
    WHERE mode_id = ?
      AND symbol IN ({placeholders(len(symbols))})
      AND decision_date IN ({placeholders(len(decision_dates))})
    ORDER BY symbol ASC, decision_date DESC
    """
    return query_rows(conn, sql, [mode_id, *symbols, *decision_dates])


def apply_overlay_two_step(predictions: Sequence[Dict[str, Any]], mode_rows: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    mode_map = {
        (str(row["symbol"]), str(row["decision_date"])): {
            "decision_semantic": normalize_semantic(row.get("decision_semantic")),
            "mode_layer1_status": str(row.get("layer1_status") or ""),
        }
        for row in mode_rows
    }
    out: List[Dict[str, Any]] = []
    for row in predictions:
        enriched = dict(row)
        mode_row = mode_map.get((str(row["symbol"]), str(row["date"])))
        semantic = mode_row["decision_semantic"] if mode_row else ""
        overlay_signal = str(row.get("signal") or "")
        overlay_layer1 = str(row.get("layer1_status") or "")
        if semantic == "建议看多" or semantic == "建议进场":
            overlay_signal = "Long"
            overlay_layer1 = "TriggeredLong"
        elif semantic == "建议观察":
            overlay_signal = "Side"
            overlay_layer1 = "Watch"
        elif semantic == "建议防守":
            overlay_signal = "Short"
            overlay_layer1 = "RiskOff"
        elif semantic == "暂无信号":
            overlay_signal = "Side"
            overlay_layer1 = "NoSetup"
        enriched["decision_semantic"] = semantic
        enriched["overlay_signal"] = overlay_signal
        enriched["overlay_layer1_status"] = overlay_layer1
        out.append(enriched)
    return out


def fetch_single_sql(conn, symbols: Sequence[str], history_limit: int, mode_id: str) -> List[Dict[str, Any]]:
    if not symbols:
        return []
    sql = f"""
    WITH ranked AS (
        SELECT
            p.symbol,
            p.date,
            p.target_date,
            p.signal,
            p.layer1_status,
            p.confidence,
            ROW_NUMBER() OVER (PARTITION BY p.symbol ORDER BY p.date DESC) AS rn
        FROM ai_predictions_v2 p
        WHERE p.is_primary = 1
          AND p.symbol IN ({placeholders(len(symbols))})
    ),
    base AS (
        SELECT symbol, date, target_date, signal, layer1_status, confidence
        FROM ranked
        WHERE rn <= ?
    )
    SELECT
        b.symbol,
        b.date,
        b.target_date,
        b.signal,
        b.layer1_status,
        b.confidence,
        CASE
            WHEN d.decision_semantic IN ('建议空仓', '空仓') THEN '暂无信号'
            WHEN d.decision_semantic = '防守' THEN '建议防守'
            WHEN d.decision_semantic = '观察' THEN '建议观察'
            WHEN d.decision_semantic IN ('进场', '建议进场') THEN '建议看多'
            ELSE COALESCE(d.decision_semantic, '')
        END AS decision_semantic,
        CASE
            WHEN d.decision_semantic = '建议进场' OR d.decision_semantic = '进场' THEN 'Long'
            WHEN d.decision_semantic = '建议防守' OR d.decision_semantic = '防守' THEN 'Short'
            WHEN d.decision_semantic IN ('暂无信号', '建议空仓', '空仓') THEN 'Side'
            WHEN d.decision_semantic = '建议观察' OR d.decision_semantic = '观察' THEN 'Side'
            ELSE b.signal
        END AS overlay_signal,
        CASE
            WHEN d.decision_semantic IN ('建议看多', '建议进场', '进场') THEN 'TriggeredLong'
            WHEN d.decision_semantic = '建议防守' OR d.decision_semantic = '防守' THEN 'RiskOff'
            WHEN d.decision_semantic IN ('暂无信号', '建议空仓', '空仓') THEN 'NoSetup'
            WHEN d.decision_semantic = '建议观察' OR d.decision_semantic = '观察' THEN 'Watch'
            ELSE b.layer1_status
        END AS overlay_layer1_status
    FROM base b
    LEFT JOIN mode_decision_log d
      ON d.mode_id = ?
     AND d.symbol = b.symbol
     AND d.decision_date = b.date
    ORDER BY b.symbol ASC, b.date DESC
    """
    return query_rows(conn, sql, [*symbols, history_limit, mode_id])


def compare_rows(two_step_rows: Sequence[Dict[str, Any]], single_sql_rows: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    key_fields = ("symbol", "date")
    relevant_fields = ("target_date", "decision_semantic", "overlay_signal", "overlay_layer1_status")
    two_map = {(str(row["symbol"]), str(row["date"])): row for row in two_step_rows}
    single_map = {(str(row["symbol"]), str(row["date"])): row for row in single_sql_rows}

    all_keys = sorted(set(two_map.keys()) | set(single_map.keys()))
    mismatches: List[Dict[str, Any]] = []
    matched = 0
    for key in all_keys:
        left = two_map.get(key)
        right = single_map.get(key)
        if not left or not right:
            mismatches.append({"key": key, "reason": "missing_row"})
            continue
        diff = {}
        for field in relevant_fields:
            left_val = str(left.get(field) or "")
            right_val = str(right.get(field) or "")
            if left_val != right_val:
                diff[field] = {"two_step": left_val, "single_sql": right_val}
        if diff:
            mismatches.append({"key": key, "diff": diff})
        else:
            matched += 1
    return {
        "row_count_two_step": len(two_step_rows),
        "row_count_single_sql": len(single_sql_rows),
        "matched_rows": matched,
        "all_keys": len(all_keys),
        "mismatch_count": len(mismatches),
        "mismatch_examples": mismatches[:10],
    }


def benchmark(conn, symbols: Sequence[str], history_limit: int, mode_id: str, iterations: int) -> Dict[str, Any]:
    two_step_times: List[float] = []
    single_sql_times: List[float] = []
    last_two_step_rows: List[Dict[str, Any]] = []
    last_single_sql_rows: List[Dict[str, Any]] = []

    for _ in range(max(1, iterations)):
        started = time.perf_counter()
        predictions = fetch_predictions_two_step(conn, symbols, history_limit)
        decision_dates = sorted({str(row["date"]) for row in predictions})
        mode_rows = fetch_mode_rows(conn, mode_id, symbols, decision_dates)
        two_step_rows = apply_overlay_two_step(predictions, mode_rows)
        finished = time.perf_counter()
        two_step_times.append((finished - started) * 1000)
        last_two_step_rows = two_step_rows

        started = time.perf_counter()
        single_sql_rows = fetch_single_sql(conn, symbols, history_limit, mode_id)
        finished = time.perf_counter()
        single_sql_times.append((finished - started) * 1000)
        last_single_sql_rows = single_sql_rows

    comparison = compare_rows(last_two_step_rows, last_single_sql_rows)
    avg_two = mean(two_step_times) if two_step_times else 0.0
    avg_single = mean(single_sql_times) if single_sql_times else 0.0
    return {
        "comparison": comparison,
        "timing_ms": {
            "two_step_total_ms": round(avg_two, 2),
            "single_sql_total_ms": round(avg_single, 2),
            "delta_ms": round(avg_single - avg_two, 2),
            "delta_pct": round(((avg_single - avg_two) / avg_two) * 100, 2) if avg_two else 0.0,
        },
    }


def print_report(db_source: str, user_id: Optional[str], symbols: Sequence[str], mode_id: str, history_limit: int, result: Dict[str, Any]) -> None:
    timing = result["timing_ms"]
    comparison = result["comparison"]

    print("=" * 80)
    print("Investment Mode Single SQL Experiment")
    print("=" * 80)
    print(f"DB_SOURCE: {db_source}")
    print(f"User ID: {user_id or '-'}")
    print(f"Symbols: {len(symbols)}")
    print(f"Mode ID: {mode_id}")
    print(f"History Limit: {history_limit}")
    print("-" * 80)
    print("Correctness")
    print(f"  Two-step Rows: {comparison['row_count_two_step']}")
    print(f"  Single SQL Rows: {comparison['row_count_single_sql']}")
    print(f"  Matched Rows: {comparison['matched_rows']}/{comparison['all_keys']}")
    print(f"  Mismatches: {comparison['mismatch_count']}")
    if comparison["mismatch_examples"]:
        print("  Mismatch Examples")
        for item in comparison["mismatch_examples"][:5]:
            print(f"    {item}")
    print("Performance")
    print(f"  Two-step Total: {timing['two_step_total_ms']} ms")
    print(f"  Single SQL Total: {timing['single_sql_total_ms']} ms")
    print(f"  Delta: {timing['delta_ms']} ms ({timing['delta_pct']}%)")
    print("=" * 80)


def main() -> int:
    args = parse_args()
    db_source = os.getenv("DB_SOURCE", "cloud").lower()
    conn = get_connection()
    try:
        user_id, symbols = resolve_sample_symbols(conn, args)
        if not symbols:
            print("No symbols resolved. Provide --symbols or a valid --user-id.")
            return 1
        result = benchmark(
            conn=conn,
            symbols=symbols,
            history_limit=max(1, args.history_limit),
            mode_id=args.mode_id.strip() or "balanced_v1",
            iterations=max(1, args.iterations),
        )
        print_report(
            db_source=db_source,
            user_id=user_id,
            symbols=symbols,
            mode_id=args.mode_id.strip() or "balanced_v1",
            history_limit=max(1, args.history_limit),
            result=result,
        )
        return 0
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
