import argparse
import json
import os
import sys
import time
from collections import defaultdict
from statistics import mean
from typing import Any, Dict, List, Optional, Sequence, Tuple


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(ROOT_DIR)
sys.path.append(os.path.join(ROOT_DIR, "backend"))

from backend.database import get_connection  # noqa: E402


CORE_MODE_IDS = ["steady_v1", "balanced_v1", "aggressive_v1"]
SEMANTIC_TO_SIGNAL = {
    "建议进场": ("Long", "TriggeredLong"),
    "建议观察": ("Side", "Watch"),
    "建议防守": ("Short", "RiskOff"),
    "暂无信号": ("Side", "NoSetup"),
}
SEMANTIC_ALIASES = {
    "建议空仓": "暂无信号",
    "空仓": "暂无信号",
    "防守": "建议防守",
    "观察": "建议观察",
    "进场": "建议进场",
}
RAW_SIGNAL_TO_SEMANTIC = {
    "Long": "建议进场",
    "Short": "建议防守",
    "Side": "建议观察",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only experiment for investment mode signal unification."
    )
    parser.add_argument("--user-id", help="Sample symbols from this user's watchlist.")
    parser.add_argument(
        "--symbols",
        help="Comma-separated symbol list. Overrides watchlist sampling.",
    )
    parser.add_argument(
        "--history-limit",
        type=int,
        default=15,
        help="Recent prediction rows per symbol to inspect. Default: 15",
    )
    parser.add_argument(
        "--max-symbols",
        type=int,
        default=30,
        help="Maximum symbols to sample from watchlist. Default: 30",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=5,
        help="Benchmark iterations. Default: 5",
    )
    parser.add_argument(
        "--mode-ids",
        default="steady_v1,balanced_v1,aggressive_v1",
        help="Comma-separated mode ids. Default: steady_v1,balanced_v1,aggressive_v1",
    )
    parser.add_argument(
        "--json-out",
        help="Optional path to save the raw result json.",
    )
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
        f"""
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


def fetch_primary_predictions(conn, symbols: Sequence[str], history_limit: int) -> List[Dict[str, Any]]:
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
            p.model_id,
            p.is_primary,
            ROW_NUMBER() OVER (PARTITION BY p.symbol ORDER BY p.date DESC) AS rn
        FROM ai_predictions_v2 p
        WHERE p.is_primary = 1
          AND p.symbol IN ({placeholders(len(symbols))})
    )
    SELECT symbol, date, target_date, signal, layer1_status, confidence, model_id, is_primary
    FROM ranked
    WHERE rn <= ?
    ORDER BY symbol ASC, date DESC
    """
    return query_rows(conn, sql, [*symbols, history_limit])


def fetch_mode_rows(
    conn,
    mode_ids: Sequence[str],
    symbols: Sequence[str],
    decision_dates: Sequence[str],
) -> List[Dict[str, Any]]:
    if not mode_ids or not symbols or not decision_dates:
        return []

    sql = f"""
    SELECT mode_id, symbol, decision_date, decision_semantic, layer1_status, confidence
    FROM mode_decision_log
    WHERE mode_id IN ({placeholders(len(mode_ids))})
      AND symbol IN ({placeholders(len(symbols))})
      AND decision_date IN ({placeholders(len(decision_dates))})
    ORDER BY mode_id ASC, symbol ASC, decision_date DESC
    """
    return query_rows(conn, sql, [*mode_ids, *symbols, *decision_dates])


def merge_overlay(
    predictions: Sequence[Dict[str, Any]],
    mode_rows: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    mode_map: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for row in mode_rows:
        key = (str(row["mode_id"]), str(row["symbol"]), str(row["decision_date"]))
        normalized = dict(row)
        normalized["decision_semantic"] = normalize_semantic(row.get("decision_semantic"))
        mode_map[key] = normalized

    prediction_keys = [(str(row["symbol"]), str(row["date"])) for row in predictions]
    total_predictions = len(predictions)
    unique_prediction_keys = sorted(set(prediction_keys))

    coverage_by_mode: Dict[str, Dict[str, Any]] = {}
    missing_examples: Dict[str, List[Dict[str, str]]] = {}
    for mode_id in sorted({str(row["mode_id"]) for row in mode_rows} | set(CORE_MODE_IDS)):
        hit_count = 0
        missing: List[Dict[str, str]] = []
        for symbol, decision_date in unique_prediction_keys:
            if (mode_id, symbol, decision_date) in mode_map:
                hit_count += 1
            elif len(missing) < 10:
                missing.append({"symbol": symbol, "decision_date": decision_date})
        denominator = len(unique_prediction_keys) or 1
        coverage_by_mode[mode_id] = {
            "hits": hit_count,
            "total_keys": len(unique_prediction_keys),
            "coverage_rate": hit_count / denominator,
        }
        missing_examples[mode_id] = missing

    grouped_semantics: Dict[Tuple[str, str], Dict[str, str]] = defaultdict(dict)
    for row in mode_rows:
        grouped_semantics[(str(row["symbol"]), str(row["decision_date"]))][str(row["mode_id"])] = normalize_semantic(
            row["decision_semantic"]
        )

    divergence_examples: List[Dict[str, Any]] = []
    complete_keys = 0
    divergent_keys = 0
    for key, mode_values in grouped_semantics.items():
        if not all(mode_id in mode_values for mode_id in CORE_MODE_IDS):
            continue
        complete_keys += 1
        semantics = [mode_values[mode_id] for mode_id in CORE_MODE_IDS]
        if len(set(semantics)) > 1:
            divergent_keys += 1
            if len(divergence_examples) < 10:
                divergence_examples.append(
                    {
                        "symbol": key[0],
                        "decision_date": key[1],
                        "steady_v1": mode_values.get("steady_v1"),
                        "balanced_v1": mode_values.get("balanced_v1"),
                        "aggressive_v1": mode_values.get("aggressive_v1"),
                    }
                )

    balanced_conflicts = 0
    balanced_comparable = 0
    conflict_examples: List[Dict[str, Any]] = []
    for row in predictions:
        raw_semantic = RAW_SIGNAL_TO_SEMANTIC.get(str(row.get("signal") or ""))
        if not raw_semantic:
            continue
        balanced = mode_map.get(("balanced_v1", str(row["symbol"]), str(row["date"])))
        if not balanced:
            continue
        balanced_comparable += 1
        balanced_semantic = str(balanced["decision_semantic"])
        if balanced_semantic != raw_semantic:
            balanced_conflicts += 1
            if len(conflict_examples) < 10:
                conflict_examples.append(
                    {
                        "symbol": str(row["symbol"]),
                        "decision_date": str(row["date"]),
                        "raw_signal": str(row.get("signal")),
                        "raw_semantic": raw_semantic,
                        "balanced_semantic": balanced_semantic,
                    }
                )

    overlay_preview: List[Dict[str, Any]] = []
    for row in predictions[:10]:
        balanced = mode_map.get(("balanced_v1", str(row["symbol"]), str(row["date"])))
        if not balanced:
            continue
        semantic = str(balanced["decision_semantic"])
        mapped_signal, mapped_layer1 = SEMANTIC_TO_SIGNAL.get(
            semantic,
            (str(row.get("signal") or "Side"), str(row.get("layer1_status") or "Watch")),
        )
        overlay_preview.append(
            {
                "symbol": str(row["symbol"]),
                "decision_date": str(row["date"]),
                "raw_signal": str(row.get("signal") or ""),
                "raw_layer1_status": str(row.get("layer1_status") or ""),
                "balanced_semantic": semantic,
                "overlay_signal": mapped_signal,
                "overlay_layer1_status": mapped_layer1,
            }
        )

    return {
        "prediction_rows": total_predictions,
        "unique_prediction_keys": len(unique_prediction_keys),
        "coverage_by_mode": coverage_by_mode,
        "missing_examples": missing_examples,
        "complete_core_keys": complete_keys,
        "divergent_core_keys": divergent_keys,
        "divergence_rate": (divergent_keys / complete_keys) if complete_keys else 0.0,
        "divergence_examples": divergence_examples,
        "balanced_raw_conflict_count": balanced_conflicts,
        "balanced_raw_comparable": balanced_comparable,
        "balanced_raw_conflict_rate": (
            balanced_conflicts / balanced_comparable if balanced_comparable else 0.0
        ),
        "conflict_examples": conflict_examples,
        "overlay_preview": overlay_preview,
    }


def benchmark(
    conn,
    symbols: Sequence[str],
    history_limit: int,
    mode_ids: Sequence[str],
    iterations: int,
) -> Dict[str, Any]:
    baseline_times: List[float] = []
    lookup_times: List[float] = []
    merge_times: List[float] = []
    total_times: List[float] = []

    latest_predictions: List[Dict[str, Any]] = []
    latest_mode_rows: List[Dict[str, Any]] = []
    latest_summary: Dict[str, Any] = {}

    for _ in range(max(1, iterations)):
        started = time.perf_counter()
        baseline_started = time.perf_counter()
        predictions = fetch_primary_predictions(conn, symbols, history_limit)
        baseline_finished = time.perf_counter()

        decision_dates = sorted({str(row["date"]) for row in predictions})
        lookup_started = time.perf_counter()
        mode_rows = fetch_mode_rows(conn, mode_ids, symbols, decision_dates)
        lookup_finished = time.perf_counter()

        merge_started = time.perf_counter()
        summary = merge_overlay(predictions, mode_rows)
        merge_finished = time.perf_counter()

        baseline_times.append((baseline_finished - baseline_started) * 1000)
        lookup_times.append((lookup_finished - lookup_started) * 1000)
        merge_times.append((merge_finished - merge_started) * 1000)
        total_times.append((merge_finished - started) * 1000)

        latest_predictions = predictions
        latest_mode_rows = mode_rows
        latest_summary = summary

    baseline_avg = mean(baseline_times) if baseline_times else 0.0
    lookup_avg = mean(lookup_times) if lookup_times else 0.0
    merge_avg = mean(merge_times) if merge_times else 0.0
    total_avg = mean(total_times) if total_times else 0.0

    return {
        "predictions": latest_predictions,
        "mode_rows": latest_mode_rows,
        "summary": latest_summary,
        "timing_ms": {
            "baseline_query_ms": round(baseline_avg, 2),
            "overlay_lookup_ms": round(lookup_avg, 2),
            "merge_ms": round(merge_avg, 2),
            "overlay_total_ms": round(total_avg, 2),
            "overlay_overhead_ms": round(lookup_avg + merge_avg, 2),
            "overlay_overhead_pct": round(((lookup_avg + merge_avg) / baseline_avg) * 100, 2)
            if baseline_avg
            else 0.0,
        },
    }


def print_report(
    db_source: str,
    user_id: Optional[str],
    symbols: Sequence[str],
    mode_ids: Sequence[str],
    history_limit: int,
    result: Dict[str, Any],
) -> None:
    summary = result["summary"]
    timing = result["timing_ms"]

    print("=" * 80)
    print("Investment Mode Signal Unification Experiment")
    print("=" * 80)
    print(f"DB_SOURCE: {db_source}")
    print(f"User ID: {user_id or '-'}")
    print(f"Symbols: {len(symbols)}")
    print(f"History Limit: {history_limit}")
    print(f"Mode IDs: {', '.join(mode_ids)}")
    print("-" * 80)

    print("Coverage")
    for mode_id in mode_ids:
        item = summary["coverage_by_mode"].get(mode_id, {})
        print(
            f"  {mode_id}: {item.get('hits', 0)}/{item.get('total_keys', 0)} "
            f"({item.get('coverage_rate', 0.0):.2%})"
        )

    print("Correctness")
    print(f"  Prediction Rows: {summary['prediction_rows']}")
    print(f"  Unique Keys: {summary['unique_prediction_keys']}")
    print(
        f"  Core Divergence: {summary['divergent_core_keys']}/{summary['complete_core_keys']} "
        f"({summary['divergence_rate']:.2%})"
    )
    print(
        f"  Balanced vs Raw Conflict: {summary['balanced_raw_conflict_count']}/"
        f"{summary['balanced_raw_comparable']} "
        f"({summary['balanced_raw_conflict_rate']:.2%})"
    )

    print("Performance")
    print(f"  Baseline Query: {timing['baseline_query_ms']} ms")
    print(f"  Overlay Lookup: {timing['overlay_lookup_ms']} ms")
    print(f"  Merge: {timing['merge_ms']} ms")
    print(f"  Overlay Total: {timing['overlay_total_ms']} ms")
    print(
        f"  Overlay Overhead: {timing['overlay_overhead_ms']} ms "
        f"({timing['overlay_overhead_pct']}%)"
    )

    if summary["divergence_examples"]:
        print("Divergence Examples")
        for item in summary["divergence_examples"][:5]:
            print(
                f"  {item['symbol']} {item['decision_date']} | "
                f"steady={item['steady_v1']} | balanced={item['balanced_v1']} | "
                f"aggressive={item['aggressive_v1']}"
            )

    if summary["conflict_examples"]:
        print("Balanced Conflict Examples")
        for item in summary["conflict_examples"][:5]:
            print(
                f"  {item['symbol']} {item['decision_date']} | raw={item['raw_signal']} "
                f"({item['raw_semantic']}) -> balanced={item['balanced_semantic']}"
            )

    for mode_id in mode_ids:
        missing = summary["missing_examples"].get(mode_id) or []
        if not missing:
            continue
        print(f"Missing Examples: {mode_id}")
        for item in missing[:3]:
            print(f"  {item['symbol']} {item['decision_date']}")

    print("=" * 80)


def main() -> int:
    args = parse_args()
    mode_ids = [item.strip() for item in args.mode_ids.split(",") if item.strip()]
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
            mode_ids=mode_ids,
            iterations=max(1, args.iterations),
        )

        payload = {
            "db_source": db_source,
            "user_id": user_id,
            "symbols": symbols,
            "history_limit": max(1, args.history_limit),
            "mode_ids": mode_ids,
            "summary": result["summary"],
            "timing_ms": result["timing_ms"],
        }

        print_report(
            db_source=db_source,
            user_id=user_id,
            symbols=symbols,
            mode_ids=mode_ids,
            history_limit=max(1, args.history_limit),
            result=result,
        )

        if args.json_out:
            with open(args.json_out, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False, indent=2)
            print(f"Saved JSON report to: {args.json_out}")
        return 0
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
