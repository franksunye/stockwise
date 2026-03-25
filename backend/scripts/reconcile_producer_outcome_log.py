import argparse
import json
import os
import sys
from collections import Counter
from typing import Any, Dict, List, Optional, Sequence, Tuple


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(ROOT_DIR)
sys.path.append(os.path.join(ROOT_DIR, "backend"))

from backend.database import get_connection  # noqa: E402
from backend.engine.semantic_registry import normalize_decision_semantic  # noqa: E402
from backend.engine.signal_semantics import normalize_signal_value  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reconcile ai_predictions_v2 and producer_outcome_log (read-only)."
    )
    parser.add_argument("--date-from", help="Inclusive trade date start (YYYY-MM-DD).")
    parser.add_argument("--date-to", help="Inclusive trade date end (YYYY-MM-DD).")
    parser.add_argument("--symbol", help="Optional symbol filter.")
    parser.add_argument("--producer-id", help="Optional model_id filter.")
    parser.add_argument("--mode-id", default="balanced_v1", help="Mode id for overlay reconciliation.")
    parser.add_argument("--limit", type=int, default=5000, help="Max rows per side. Default: 5000")
    parser.add_argument("--primary-only", action="store_true", help="Only reconcile ai_predictions_v2 primary rows.")
    parser.add_argument("--json-out", help="Optional path to save full JSON report.")
    return parser.parse_args()


def rows_to_dicts(cursor, rows: Sequence[Sequence[Any]]) -> List[Dict[str, Any]]:
    columns = [item[0] for item in (cursor.description or [])]
    return [dict(zip(columns, row)) for row in rows]


def query_rows(conn, sql: str, params: Sequence[Any] = ()) -> List[Dict[str, Any]]:
    cursor = conn.cursor()
    cursor.execute(sql, tuple(params))
    rows = cursor.fetchall()
    return rows_to_dicts(cursor, rows)


def normalize_signal(signal: Any) -> str:
    return normalize_signal_value(signal, "Side")


def normalize_semantic(value: Any) -> str:
    return normalize_decision_semantic(value, "暂无信号")


def overlay_from_semantic(base_signal: str, semantic: str) -> Tuple[str, str]:
    normalized = normalize_semantic(semantic)
    if normalized == "建议看多":
        return "Long", "TriggeredLong"
    if normalized == "建议防守":
        return "Short", "RiskOff"
    if normalized == "建议观察":
        return "Side", "Watch"
    if normalized == "暂无信号":
        return "Side", "NoSetup"
    return base_signal, "NoSetup"


def fetch_primary_predictions(conn, args: argparse.Namespace) -> List[Dict[str, Any]]:
    filters = ["1=1"]
    if args.primary_only:
        filters.append("p.is_primary = 1")
    params: List[Any] = []
    if args.date_from:
        filters.append("p.date >= ?")
        params.append(args.date_from)
    if args.date_to:
        filters.append("p.date <= ?")
        params.append(args.date_to)
    if args.symbol:
        filters.append("p.symbol = ?")
        params.append(args.symbol)
    if args.producer_id:
        filters.append("p.model_id = ?")
        params.append(args.producer_id)

    sql = f"""
    SELECT p.symbol, p.date AS trade_date, p.model_id AS producer_id, p.signal, p.confidence, p.ai_reasoning, p.is_primary
    FROM ai_predictions_v2 p
    WHERE {' AND '.join(filters)}
    ORDER BY p.date DESC, p.symbol ASC, p.model_id ASC
    LIMIT ?
    """
    return query_rows(conn, sql, [*params, args.limit])


def fetch_producer_outcomes(conn, args: argparse.Namespace) -> List[Dict[str, Any]]:
    filters = [
        "outcome_kind = 'prediction'",
        "producer_type = 'AI'",
    ]
    params: List[Any] = []
    if args.date_from:
        filters.append("trade_date >= ?")
        params.append(args.date_from)
    if args.date_to:
        filters.append("trade_date <= ?")
        params.append(args.date_to)
    if args.symbol:
        filters.append("symbol = ?")
        params.append(args.symbol)
    if args.producer_id:
        filters.append("producer_id = ?")
        params.append(args.producer_id)

    sql = f"""
    SELECT symbol, trade_date, producer_id, signal_state, decision_semantic, confidence, role_type, env
    FROM producer_outcome_log
    WHERE {' AND '.join(filters)}
    ORDER BY trade_date DESC, symbol ASC, producer_id ASC
    LIMIT ?
    """
    return query_rows(conn, sql, [*params, args.limit])


def compare_prediction_vs_outcome(
    primary_predictions: Sequence[Dict[str, Any]],
    outcomes: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    pred_map: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for row in primary_predictions:
        key = (str(row["symbol"]), str(row["trade_date"]), str(row["producer_id"]))
        pred_map[key] = {
            "signal_state": normalize_signal(row.get("signal")),
            "decision_semantic": normalize_semantic(row.get("signal")),
            "confidence": float(row.get("confidence") or 0.0),
        }

    out_map: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for row in outcomes:
        key = (str(row["symbol"]), str(row["trade_date"]), str(row["producer_id"]))
        out_map[key] = {
            "signal_state": normalize_signal(row.get("signal_state")),
            "decision_semantic": normalize_semantic(row.get("decision_semantic")),
            "confidence": float(row.get("confidence") or 0.0),
            "role_type": str(row.get("role_type") or ""),
            "env": str(row.get("env") or ""),
        }

    keys = sorted(set(pred_map.keys()) | set(out_map.keys()))
    mismatches: List[Dict[str, Any]] = []
    missing_in_outcome = 0
    missing_in_prediction = 0
    field_match_counter = Counter()

    for key in keys:
        left = pred_map.get(key)
        right = out_map.get(key)
        if not left:
            missing_in_prediction += 1
            if len(mismatches) < 100:
                mismatches.append({"key": key, "reason": "missing_in_ai_predictions_v2", "outcome": right})
            continue
        if not right:
            missing_in_outcome += 1
            if len(mismatches) < 100:
                mismatches.append({"key": key, "reason": "missing_in_producer_outcome_log", "prediction": left})
            continue

        signal_match = left["signal_state"] == right["signal_state"]
        semantic_match = left["decision_semantic"] == right["decision_semantic"]
        conf_match = abs(float(left["confidence"]) - float(right["confidence"])) <= 1e-6
        field_match_counter["signal_state"] += int(signal_match)
        field_match_counter["decision_semantic"] += int(semantic_match)
        field_match_counter["confidence"] += int(conf_match)
        field_match_counter["all"] += int(signal_match and semantic_match and conf_match)
        if not (signal_match and semantic_match and conf_match):
            if len(mismatches) < 100:
                mismatches.append(
                    {
                        "key": key,
                        "reason": "field_mismatch",
                        "prediction": left,
                        "outcome": right,
                    }
                )

    matched_pairs = len(keys) - missing_in_outcome - missing_in_prediction
    denominator = max(matched_pairs, 1)
    return {
        "totals": {
            "prediction_rows": len(pred_map),
            "outcome_rows": len(out_map),
            "union_keys": len(keys),
            "matched_pairs": matched_pairs,
            "missing_in_outcome": missing_in_outcome,
            "missing_in_prediction": missing_in_prediction,
        },
        "match_rates": {
            "signal_state": field_match_counter["signal_state"] / denominator,
            "decision_semantic": field_match_counter["decision_semantic"] / denominator,
            "confidence": field_match_counter["confidence"] / denominator,
            "all_fields": field_match_counter["all"] / denominator,
        },
        "mismatch_examples": mismatches[:20],
    }


def fetch_mode_overlay_rows(conn, args: argparse.Namespace) -> List[Dict[str, Any]]:
    filters = ["1=1"]
    if args.primary_only:
        filters.append("p.is_primary = 1")
    params: List[Any] = []
    if args.date_from:
        filters.append("p.date >= ?")
        params.append(args.date_from)
    if args.date_to:
        filters.append("p.date <= ?")
        params.append(args.date_to)
    if args.symbol:
        filters.append("p.symbol = ?")
        params.append(args.symbol)
    if args.producer_id:
        filters.append("p.model_id = ?")
        params.append(args.producer_id)

    sql = f"""
    SELECT
        p.symbol,
        p.date AS trade_date,
        p.model_id AS producer_id,
        p.signal AS base_signal,
        d.decision_semantic AS mode_decision_semantic,
        d.layer1_status AS mode_layer1_status,
        CASE
            WHEN d.decision_semantic IN ('建议看多', '建议进场', '进场') THEN 'Long'
            WHEN d.decision_semantic IN ('建议防守', '防守') THEN 'Short'
            WHEN d.decision_semantic IN ('建议观察', '观察', '暂无信号', '建议空仓', '空仓') THEN 'Side'
            ELSE p.signal
        END AS sql_overlay_signal,
        CASE
            WHEN d.decision_semantic IN ('建议看多', '建议进场', '进场') THEN 'TriggeredLong'
            WHEN d.decision_semantic IN ('建议防守', '防守') THEN 'RiskOff'
            WHEN d.decision_semantic IN ('暂无信号', '建议空仓', '空仓') THEN 'NoSetup'
            WHEN d.decision_semantic IN ('建议观察', '观察') THEN 'Watch'
            ELSE p.layer1_status
        END AS sql_overlay_layer1_status
    FROM ai_predictions_v2 p
    LEFT JOIN mode_decision_log d
      ON d.mode_id = ?
     AND d.symbol = p.symbol
     AND d.decision_date = p.date
    WHERE {' AND '.join(filters)}
    ORDER BY p.date DESC, p.symbol ASC, p.model_id ASC
    LIMIT ?
    """
    return query_rows(conn, sql, [args.mode_id, *params, args.limit])


def compare_mode_overlay(rows: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    total = 0
    comparable = 0
    signal_match = 0
    layer1_match = 0
    mismatches: List[Dict[str, Any]] = []

    for row in rows:
        total += 1
        semantic = row.get("mode_decision_semantic")
        if semantic is None:
            continue
        comparable += 1
        base_signal = normalize_signal(row.get("base_signal"))
        expected_signal, expected_layer1 = overlay_from_semantic(base_signal, str(semantic))
        actual_signal = normalize_signal(row.get("sql_overlay_signal"))
        actual_layer1 = str(row.get("sql_overlay_layer1_status") or "NoSetup")
        signal_ok = expected_signal == actual_signal
        layer1_ok = expected_layer1 == actual_layer1
        signal_match += int(signal_ok)
        layer1_match += int(layer1_ok)
        if not (signal_ok and layer1_ok) and len(mismatches) < 20:
            mismatches.append(
                {
                    "symbol": row.get("symbol"),
                    "trade_date": row.get("trade_date"),
                    "producer_id": row.get("producer_id"),
                    "mode_decision_semantic": normalize_semantic(semantic),
                    "expected_signal": expected_signal,
                    "expected_layer1_status": expected_layer1,
                    "actual_sql_overlay_signal": actual_signal,
                    "actual_mode_layer1_status": actual_layer1,
                }
            )

    denom = max(comparable, 1)
    return {
        "totals": {"rows": total, "comparable": comparable},
        "match_rates": {
            "overlay_signal": signal_match / denom,
            "overlay_layer1_status": layer1_match / denom,
        },
        "mismatch_examples": mismatches,
    }


def fetch_inventory_stats(conn) -> Dict[str, Any]:
    pred = query_rows(
        conn,
        "SELECT COUNT(*) AS c, MIN(date) AS min_date, MAX(date) AS max_date FROM ai_predictions_v2 WHERE is_primary = 1",
    )[0]
    outcome = query_rows(
        conn,
        "SELECT COUNT(*) AS c, MIN(trade_date) AS min_date, MAX(trade_date) AS max_date FROM producer_outcome_log WHERE outcome_kind='prediction' AND producer_type='AI'",
    )[0]
    return {
        "ai_predictions_v2_primary": {
            "rows": int(pred.get("c") or 0),
            "min_trade_date": pred.get("min_date"),
            "max_trade_date": pred.get("max_date"),
        },
        "producer_outcome_log_prediction": {
            "rows": int(outcome.get("c") or 0),
            "min_trade_date": outcome.get("min_date"),
            "max_trade_date": outcome.get("max_date"),
        },
    }


def main() -> None:
    args = parse_args()
    conn = get_connection()
    try:
        predictions = fetch_primary_predictions(conn, args)
        outcomes = fetch_producer_outcomes(conn, args)
        overlay_rows = fetch_mode_overlay_rows(conn, args)

        report = {
            "scope": {
                "date_from": args.date_from,
                "date_to": args.date_to,
                "symbol": args.symbol,
                "producer_id": args.producer_id,
                "mode_id": args.mode_id,
                "limit": args.limit,
            },
            "inventory": fetch_inventory_stats(conn),
            "prediction_outcome_reconciliation": compare_prediction_vs_outcome(predictions, outcomes),
            "mode_overlay_reconciliation": compare_mode_overlay(overlay_rows),
        }

        if args.json_out:
            with open(args.json_out, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            print(f"saved_json: {args.json_out}")

        print(json.dumps(report, ensure_ascii=False, indent=2))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
