"""
Tradeability Sidecar Runner (non-intrusive).

Purpose:
1) Compute NoSetup/Watch/TriggeredLong/RiskOff on latest market date.
2) Store outputs into quant_tradeability_signals table.
3) Keep fully isolated from existing ai_predictions_v2 main flow.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple

# Add backend to path (legacy support)
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
# Add project root to path (support 'backend.*' imports)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger


@dataclass
class Bar:
    date: str
    high: float
    low: float
    close: float
    volume: float
    ma5: float
    ma10: float
    ma20: float
    macd_hist: float
    change_percent: float


def safe_float(v) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def mean(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / float(len(values))


def calc_amp(bar: Bar) -> float:
    if bar.close <= 0:
        return 0.0
    return (bar.high - bar.low) / bar.close


def ensure_sidecar_table(conn) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS quant_tradeability_signals (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            market TEXT NOT NULL,
            strategy_version TEXT NOT NULL,
            setup_state TEXT NOT NULL,
            opportunity_score REAL NOT NULL,
            trigger_rule_hit INTEGER DEFAULT 0,
            risk_off_hit INTEGER DEFAULT 0,
            signal_payload TEXT,
            created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
            updated_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
            PRIMARY KEY (symbol, date, market, strategy_version)
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_qts_date_market ON quant_tradeability_signals(date DESC, market, strategy_version)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_qts_state_date ON quant_tradeability_signals(setup_state, date DESC)"
    )
    conn.commit()


def resolve_target_date(cursor, market: str, target_date: Optional[str]) -> Optional[str]:
    if target_date:
        return target_date
    row = cursor.execute(
        """
        SELECT MAX(dp.date)
        FROM daily_prices dp
        JOIN stock_meta sm ON sm.symbol = dp.symbol
        WHERE sm.market = ?
        """,
        (market,),
    ).fetchone()
    return row[0] if row and row[0] else None


def fetch_symbols_for_date(cursor, market: str, date_str: str) -> List[str]:
    rows = cursor.execute(
        """
        SELECT dp.symbol
        FROM daily_prices dp
        JOIN stock_meta sm ON sm.symbol = dp.symbol
        WHERE dp.date = ? AND sm.market = ?
        ORDER BY dp.symbol
        """,
        (date_str, market),
    ).fetchall()
    return [str(r[0]) for r in rows]


def fetch_history(cursor, symbol: str, date_str: str, lookback: int = 25) -> List[Bar]:
    rows = cursor.execute(
        """
        SELECT date, high, low, close, volume, ma5, ma10, ma20, macd_hist, change_percent
        FROM daily_prices
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC
        LIMIT ?
        """,
        (symbol, date_str, lookback),
    ).fetchall()
    rows = list(reversed(rows))
    out: List[Bar] = []
    for r in rows:
        out.append(
            Bar(
                date=str(r[0]),
                high=safe_float(r[1]),
                low=safe_float(r[2]),
                close=safe_float(r[3]),
                volume=safe_float(r[4]),
                ma5=safe_float(r[5]),
                ma10=safe_float(r[6]),
                ma20=safe_float(r[7]),
                macd_hist=safe_float(r[8]),
                change_percent=safe_float(r[9]),
            )
        )
    return out


def eval_state(
    history: Sequence[Bar],
    vcp_ratio: float,
    breakout_volume_mult: float,
    strong_close_threshold: float,
    momentum_change_threshold: float,
    risk_off_ma: int,
) -> Tuple[str, float, int, int, Dict[str, object]]:
    if len(history) < 21:
        return "NoSetup", 0.0, 0, 0, {"reason": "insufficient_history"}

    i = len(history) - 1
    bar = history[i]
    prev = history[i - 1]
    amp5 = mean([calc_amp(x) for x in history[i - 4 : i + 1]])
    amp20 = mean([calc_amp(x) for x in history[i - 19 : i + 1]])
    prev_vol5 = mean([x.volume for x in history[i - 5 : i]])

    c1 = amp20 > 0 and amp5 < amp20 * vcp_ratio
    c2 = (
        prev_vol5 > 0
        and bar.volume > breakout_volume_mult * prev_vol5
        and bar.close > bar.ma10
        and bar.close > bar.ma20
    )
    denom = bar.high - bar.low
    c3 = denom > 0 and ((bar.close - bar.low) / denom) >= strong_close_threshold
    c4 = bar.change_percent > momentum_change_threshold or bar.macd_hist > prev.macd_hist

    watch = c1 and c2
    trigger = watch and c3 and c4

    ma_line = bar.ma10
    if risk_off_ma == 5:
        ma_line = bar.ma5
    elif risk_off_ma == 20:
        ma_line = bar.ma20
    risk_off = bar.close > 0 and ma_line > 0 and bar.close < ma_line

    if trigger:
        setup_state = "TriggeredLong"
    elif watch:
        setup_state = "Watch"
    elif risk_off:
        setup_state = "RiskOff"
    else:
        setup_state = "NoSetup"

    score = 0.0
    if c1:
        score += 20.0
    if c2:
        score += 30.0
    if c3:
        score += 20.0
    if c4:
        score += 15.0
    if bar.close > bar.ma20 and bar.ma20 > 0:
        score += 10.0
    if bar.close > bar.ma10 and bar.ma10 > 0:
        score += 5.0
    score = max(0.0, min(100.0, score))

    payload = {
        "latest_date": bar.date,
        "cond_vcp_like": c1,
        "cond_breakout": c2,
        "cond_strong_close": c3,
        "cond_momentum": c4,
        "watch": watch,
        "trigger": trigger,
        "risk_off": risk_off,
        "amp5": round(amp5, 6),
        "amp20": round(amp20, 6),
        "prev_vol5": round(prev_vol5, 2),
        "close": bar.close,
        "ma5": bar.ma5,
        "ma10": bar.ma10,
        "ma20": bar.ma20,
    }
    return setup_state, score, 1 if trigger else 0, 1 if risk_off else 0, payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Run tradeability sidecar and upsert signals.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--date", default="", help="YYYY-MM-DD; default latest in market")
    parser.add_argument("--strategy-version", default="tradeability_v1")
    parser.add_argument("--dry-run", action="store_true")

    parser.add_argument("--vcp-ratio", type=float, default=0.9)
    parser.add_argument("--breakout-volume-mult", type=float, default=1.1)
    parser.add_argument("--strong-close-threshold", type=float, default=0.65)
    parser.add_argument("--momentum-change-threshold", type=float, default=4.0)
    parser.add_argument("--risk-off-ma", type=int, choices=[5, 10, 20], default=10)
    args = parser.parse_args()

    conn = get_connection()
    try:
        ensure_sidecar_table(conn)
        cur = conn.cursor()

        target_date = resolve_target_date(cur, args.market, args.date or None)
        if not target_date:
            logger.warning(f"⚠️ No target date found for market={args.market}")
            return

        symbols = fetch_symbols_for_date(cur, args.market, target_date)
        if not symbols:
            logger.warning(f"⚠️ No symbols found for market={args.market} date={target_date}")
            return

        logger.info(
            f"🚀 Tradeability sidecar running: market={args.market}, date={target_date}, symbols={len(symbols)}, dry_run={args.dry_run}"
        )

        rows = []
        state_counts: Dict[str, int] = {"NoSetup": 0, "Watch": 0, "TriggeredLong": 0, "RiskOff": 0}
        for symbol in symbols:
            history = fetch_history(cur, symbol, target_date, lookback=25)
            setup_state, score, trigger_hit, risk_off_hit, payload = eval_state(
                history=history,
                vcp_ratio=args.vcp_ratio,
                breakout_volume_mult=args.breakout_volume_mult,
                strong_close_threshold=args.strong_close_threshold,
                momentum_change_threshold=args.momentum_change_threshold,
                risk_off_ma=args.risk_off_ma,
            )
            state_counts[setup_state] = state_counts.get(setup_state, 0) + 1
            rows.append(
                (
                    symbol,
                    target_date,
                    args.market,
                    args.strategy_version,
                    setup_state,
                    round(score, 2),
                    int(trigger_hit),
                    int(risk_off_hit),
                    json.dumps(payload, ensure_ascii=False),
                )
            )

        if not args.dry_run:
            cur.executemany(
                """
                INSERT INTO quant_tradeability_signals
                (symbol, date, market, strategy_version, setup_state, opportunity_score, trigger_rule_hit, risk_off_hit, signal_payload)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, date, market, strategy_version) DO UPDATE SET
                    setup_state = excluded.setup_state,
                    opportunity_score = excluded.opportunity_score,
                    trigger_rule_hit = excluded.trigger_rule_hit,
                    risk_off_hit = excluded.risk_off_hit,
                    signal_payload = excluded.signal_payload,
                    updated_at = (datetime('now', '+8 hours'))
                """,
                rows,
            )
            conn.commit()

        logger.info(
            f"✅ Sidecar done. market={args.market}, date={target_date}, total={len(rows)}, states={state_counts}, dry_run={args.dry_run}"
        )
        print(
            json.dumps(
                {
                    "market": args.market,
                    "date": target_date,
                    "total": len(rows),
                    "state_counts": state_counts,
                    "dry_run": args.dry_run,
                    "strategy_version": args.strategy_version,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
