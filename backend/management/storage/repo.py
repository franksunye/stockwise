from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Iterable, List
from uuid import uuid4

from backend.database import get_connection
from backend.management.domain.position_state import PolicyResult, PositionState


def ensure_management_research_schema(conn) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS position_state_snapshots (
            id TEXT PRIMARY KEY,
            symbol TEXT NOT NULL,
            trade_date TEXT NOT NULL,
            entry_date TEXT NOT NULL,
            entry_price REAL NOT NULL,
            position_size REAL NOT NULL,
            holding_days INTEGER NOT NULL,
            close REAL NOT NULL,
            high REAL,
            low REAL,
            unrealized_pnl_pct REAL,
            mfe_pct REAL,
            mae_pct REAL,
            signal_state TEXT,
            confidence REAL,
            support_price REAL,
            resistance_price REAL,
            discipline_price REAL,
            breakout_confirmed INTEGER DEFAULT 0,
            near_resistance INTEGER DEFAULT 0,
            failed_breakout_risk INTEGER DEFAULT 0,
            partial_exit_done INTEGER DEFAULT 0,
            state_id TEXT,
            feature_payload TEXT,
            source_ref TEXT,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_position_state_unique
        ON position_state_snapshots(symbol, trade_date, entry_date)
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS management_policy_runs (
            run_id TEXT PRIMARY KEY,
            policy_id TEXT NOT NULL,
            universe TEXT NOT NULL,
            date_from TEXT NOT NULL,
            date_to TEXT NOT NULL,
            benchmark_policy_id TEXT,
            objective_id TEXT,
            params_json TEXT,
            sample_size INTEGER,
            triggered_by TEXT,
            note TEXT,
            created_at TIMESTAMP NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS management_policy_results (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            policy_id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            entry_date TEXT NOT NULL,
            exit_date TEXT,
            holding_days INTEGER,
            entry_price REAL NOT NULL,
            exit_price REAL,
            realized_pnl_pct REAL,
            max_drawdown_pct REAL,
            profit_giveback_pct REAL,
            win_flag INTEGER,
            action_count INTEGER DEFAULT 0,
            action_log_json TEXT,
            result_payload TEXT,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            FOREIGN KEY (run_id) REFERENCES management_policy_runs(run_id)
        )
        """
    )
    cur.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_management_policy_results_unique
        ON management_policy_results(run_id, policy_id, symbol, entry_date)
        """
    )


def persist_snapshots(snapshots: Iterable[PositionState]) -> None:
    conn = get_connection()
    try:
        ensure_management_research_schema(conn)
        cur = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        rows = []
        for s in snapshots:
            rows.append(
                (
                    f"{s.symbol}:{s.trade_date}:{s.entry_date}",
                    s.symbol,
                    s.trade_date,
                    s.entry_date,
                    s.entry_price,
                    s.position_size,
                    s.holding_days,
                    s.close,
                    s.high,
                    s.low,
                    s.unrealized_pnl_pct,
                    s.mfe_pct,
                    s.mae_pct,
                    s.signal_state,
                    s.confidence,
                    s.support_price,
                    s.resistance_price,
                    s.discipline_price,
                    1 if s.breakout_confirmed else 0,
                    1 if s.near_resistance else 0,
                    1 if s.failed_breakout_risk else 0,
                    1 if s.partial_exit_done else 0,
                    s.state_id,
                    json.dumps(s.feature_payload, ensure_ascii=False),
                    None,
                    now,
                    now,
                )
            )
        cur.executemany(
            """
            INSERT INTO position_state_snapshots
            (id, symbol, trade_date, entry_date, entry_price, position_size, holding_days, close, high, low,
             unrealized_pnl_pct, mfe_pct, mae_pct, signal_state, confidence, support_price, resistance_price,
             discipline_price, breakout_confirmed, near_resistance, failed_breakout_risk, partial_exit_done,
             state_id, feature_payload, source_ref, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(symbol, trade_date, entry_date) DO UPDATE SET
              position_size=excluded.position_size,
              holding_days=excluded.holding_days,
              close=excluded.close,
              high=excluded.high,
              low=excluded.low,
              unrealized_pnl_pct=excluded.unrealized_pnl_pct,
              mfe_pct=excluded.mfe_pct,
              mae_pct=excluded.mae_pct,
              signal_state=excluded.signal_state,
              confidence=excluded.confidence,
              support_price=excluded.support_price,
              resistance_price=excluded.resistance_price,
              discipline_price=excluded.discipline_price,
              breakout_confirmed=excluded.breakout_confirmed,
              near_resistance=excluded.near_resistance,
              failed_breakout_risk=excluded.failed_breakout_risk,
              partial_exit_done=excluded.partial_exit_done,
              state_id=excluded.state_id,
              feature_payload=excluded.feature_payload,
              updated_at=excluded.updated_at
            """,
            rows,
        )
        conn.commit()
    finally:
        conn.close()


def persist_run_and_results(
    policy_results: List[PolicyResult],
    universe: str,
    date_from: str,
    date_to: str,
    objective_id: str = "profit_giveback_control",
    benchmark_policy_id: str = "buy_and_hold_baseline",
    triggered_by: str = "manual",
) -> str:
    conn = get_connection()
    run_id = str(uuid4())
    try:
        ensure_management_research_schema(conn)
        cur = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            INSERT INTO management_policy_runs
            (run_id, policy_id, universe, date_from, date_to, benchmark_policy_id, objective_id, params_json, sample_size, triggered_by, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                "multi_policy_compare",
                universe,
                date_from,
                date_to,
                benchmark_policy_id,
                objective_id,
                json.dumps({}, ensure_ascii=False),
                len(policy_results),
                triggered_by,
                "POC run",
                now,
            ),
        )
        rows = []
        for result in policy_results:
            rows.append(
                (
                    f"{run_id}:{result.policy_id}:{result.symbol}:{result.entry_date}",
                    run_id,
                    result.policy_id,
                    result.symbol,
                    result.entry_date,
                    result.exit_date,
                    result.holding_days,
                    result.entry_price,
                    result.exit_price,
                    result.realized_pnl_pct,
                    result.max_drawdown_pct,
                    result.profit_giveback_pct,
                    1 if result.win_flag else 0 if result.win_flag is not None else None,
                    result.action_count,
                    json.dumps(result.action_log, ensure_ascii=False),
                    json.dumps(result.result_payload, ensure_ascii=False),
                    now,
                    now,
                )
            )
        cur.executemany(
            """
            INSERT INTO management_policy_results
            (id, run_id, policy_id, symbol, entry_date, exit_date, holding_days, entry_price, exit_price,
             realized_pnl_pct, max_drawdown_pct, profit_giveback_pct, win_flag, action_count,
             action_log_json, result_payload, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()
        return run_id
    finally:
        conn.close()

