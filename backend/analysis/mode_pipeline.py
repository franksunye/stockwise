"""
Investment Mode data pipeline (Spec 47, backend phase-1).

Builds:
1) mode_decision_log
2) mode_simulated_trade_ledger
3) mode_performance_snapshot
"""
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from backend.database import get_connection
from backend.logger import logger

DEFAULT_MODE_ID = "balanced_v1"
SUPPORTED_MODES = ["steady_v1", "balanced_v1", "aggressive_v1", "observe_only_v1"]
HORIZONS = {"7d": 7, "30d": 30, "90d": 90}
DEFAULT_STRATEGY_VERSION = "tradeability_v2"
DEFAULT_RULE_VERSION = "mode_sim_v1"


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _cutoff_date(as_of_date: str, days: int) -> str:
    date_obj = datetime.strptime(as_of_date, "%Y-%m-%d")
    return (date_obj - timedelta(days=days - 1)).strftime("%Y-%m-%d")


def _semantic_from_layer1(layer1_status: Optional[str], signal: Optional[str]) -> str:
    if layer1_status == "TriggeredLong":
        return "建议进场"
    if layer1_status == "Watch":
        return "建议观察"
    if layer1_status == "RiskOff":
        return "建议防守"
    if layer1_status == "NoSetup":
        return "建议空仓"

    # Fallback by legacy signal.
    if signal == "Long":
        return "建议进场"
    if signal == "Side":
        return "建议观察"
    return "建议观察"


def _semantic_by_mode(mode_id: str, layer1_status: Optional[str], signal: Optional[str]) -> str:
    # "仅观察"模式不输出进场结论，保持 2C 克制边界
    if mode_id == "observe_only_v1":
        return "建议观察"
    return _semantic_from_layer1(layer1_status, signal)


def ensure_mode_pipeline_schema(conn) -> None:
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_investment_mode (
            user_id TEXT PRIMARY KEY,
            mode_id TEXT NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            updated_by TEXT DEFAULT 'user'
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mode_decision_log (
            id TEXT PRIMARY KEY,
            mode_id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            decision_date TEXT NOT NULL,
            strategy_version TEXT NOT NULL,
            decision_semantic TEXT NOT NULL,
            layer1_status TEXT,
            trigger_flags TEXT,
            reasoning_snapshot TEXT,
            confidence REAL,
            job_id TEXT,
            rule_version TEXT,
            triggered_by TEXT,
            created_at TIMESTAMP NOT NULL
        )
    """)
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mode_decision_unique
        ON mode_decision_log(mode_id, symbol, decision_date, strategy_version)
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mode_simulated_trade_ledger (
            id TEXT PRIMARY KEY,
            mode_id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            entry_date TEXT NOT NULL,
            exit_date TEXT,
            entry_price REAL NOT NULL,
            exit_price REAL,
            holding_days INTEGER,
            trade_status TEXT NOT NULL,
            decision_source_id TEXT NOT NULL,
            pnl_pct REAL,
            max_drawdown_pct REAL,
            rule_version TEXT NOT NULL,
            job_id TEXT,
            triggered_by TEXT,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
        )
    """)
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mode_ledger_unique
        ON mode_simulated_trade_ledger(mode_id, symbol, entry_date, rule_version)
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mode_performance_snapshot (
            mode_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            horizon TEXT NOT NULL,
            segment_key TEXT DEFAULT 'all',
            coverage REAL,
            hit_rate REAL,
            max_drawdown REAL,
            sample_size INTEGER,
            payoff_ratio REAL,
            stability_score REAL,
            job_id TEXT,
            rule_version TEXT,
            triggered_by TEXT,
            as_of_date TEXT NOT NULL,
            computed_at TIMESTAMP NOT NULL,
            PRIMARY KEY (mode_id, scope, horizon, as_of_date, segment_key)
        )
    """)
    try:
        cursor.execute("ALTER TABLE ai_predictions_v2 ADD COLUMN mode_id TEXT")
    except Exception as e:
        err = str(e).lower()
        if "duplicate column" not in err and "already exists" not in err:
            raise
    for sql in [
        "ALTER TABLE mode_decision_log ADD COLUMN job_id TEXT",
        "ALTER TABLE mode_decision_log ADD COLUMN rule_version TEXT",
        "ALTER TABLE mode_decision_log ADD COLUMN triggered_by TEXT",
        "ALTER TABLE mode_simulated_trade_ledger ADD COLUMN job_id TEXT",
        "ALTER TABLE mode_simulated_trade_ledger ADD COLUMN triggered_by TEXT",
        "ALTER TABLE mode_performance_snapshot ADD COLUMN job_id TEXT",
        "ALTER TABLE mode_performance_snapshot ADD COLUMN rule_version TEXT",
        "ALTER TABLE mode_performance_snapshot ADD COLUMN triggered_by TEXT",
    ]:
        try:
            cursor.execute(sql)
        except Exception as e:
            err = str(e).lower()
            if "duplicate column" not in err and "already exists" not in err:
                raise


def _upsert_mode_decisions(
    conn,
    mode_id: str,
    decision_date: str,
    job_id: str,
    rule_version: str,
    triggered_by: str,
) -> int:
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT symbol, date, target_date, signal, confidence,
               layer1_status, layer1_trigger_hit, layer1_risk_off_hit, ai_reasoning
        FROM ai_predictions_v2
        WHERE date = ? AND is_primary = 1
        """,
        (decision_date,),
    )
    rows = cursor.fetchall()
    now = datetime.now(timezone.utc).isoformat()
    count = 0
    for row in rows:
        symbol = row[0]
        signal = row[3]
        confidence = row[4]
        layer1_status = row[5]
        trigger_hit = int(row[6] or 0)
        risk_off_hit = int(row[7] or 0)
        reasoning_raw = row[8] or ""
        reasoning_snapshot = str(reasoning_raw)[:240]
        decision_semantic = _semantic_by_mode(mode_id, layer1_status, signal)
        trigger_flags = json.dumps(
            {"layer1_trigger_hit": trigger_hit, "layer1_risk_off_hit": risk_off_hit},
            ensure_ascii=False,
        )
        decision_id = f"{mode_id}:{symbol}:{decision_date}:{DEFAULT_STRATEGY_VERSION}"

        cursor.execute(
            """
            INSERT INTO mode_decision_log
            (id, mode_id, symbol, decision_date, strategy_version, decision_semantic,
             layer1_status, trigger_flags, reasoning_snapshot, confidence, job_id, rule_version, triggered_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(mode_id, symbol, decision_date, strategy_version) DO UPDATE SET
              decision_semantic=excluded.decision_semantic,
              layer1_status=excluded.layer1_status,
              trigger_flags=excluded.trigger_flags,
              reasoning_snapshot=excluded.reasoning_snapshot,
              confidence=excluded.confidence,
              job_id=excluded.job_id,
              rule_version=excluded.rule_version,
              triggered_by=excluded.triggered_by
            """,
            (
                decision_id,
                mode_id,
                symbol,
                decision_date,
                DEFAULT_STRATEGY_VERSION,
                decision_semantic,
                layer1_status,
                trigger_flags,
                reasoning_snapshot,
                confidence,
                job_id,
                rule_version,
                triggered_by,
                now,
            ),
        )
        count += 1
    return count


def _upsert_mode_ledger(
    conn,
    mode_id: str,
    decision_date: str,
    job_id: str,
    rule_version: str,
    triggered_by: str,
) -> int:
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT d.id, d.symbol, d.decision_date, p.target_date, p.confidence
        FROM mode_decision_log d
        JOIN ai_predictions_v2 p
          ON p.symbol = d.symbol AND p.date = d.decision_date
         AND COALESCE(p.mode_id, ?) = d.mode_id
        WHERE d.mode_id = ? AND d.decision_date = ? AND p.is_primary = 1
        """,
        (DEFAULT_MODE_ID, mode_id, decision_date),
    )
    rows = cursor.fetchall()
    now = datetime.now(timezone.utc).isoformat()
    count = 0
    for decision_id, symbol, entry_date, target_date, _confidence in rows:
        cursor.execute(
            "SELECT close FROM daily_prices WHERE symbol = ? AND date = ? LIMIT 1",
            (symbol, entry_date),
        )
        entry_row = cursor.fetchone()
        if not entry_row:
            continue
        entry_price = float(entry_row[0])
        cursor.execute(
            "SELECT close FROM daily_prices WHERE symbol = ? AND date = ? LIMIT 1",
            (symbol, target_date),
        )
        exit_row = cursor.fetchone()

        if exit_row:
            exit_price = float(exit_row[0])
            pnl_pct = (exit_price - entry_price) / entry_price if entry_price > 0 else 0.0
            trade_status = "closed"
            holding_days = max(
                1,
                (datetime.strptime(target_date, "%Y-%m-%d") - datetime.strptime(entry_date, "%Y-%m-%d")).days,
            )
            max_drawdown_pct = min(0.0, pnl_pct)
        else:
            exit_price = None
            pnl_pct = None
            trade_status = "open"
            holding_days = None
            max_drawdown_pct = None

        ledger_id = f"{mode_id}:{symbol}:{entry_date}:{rule_version}"
        cursor.execute(
            """
            INSERT INTO mode_simulated_trade_ledger
            (id, mode_id, symbol, entry_date, exit_date, entry_price, exit_price, holding_days,
             trade_status, decision_source_id, pnl_pct, max_drawdown_pct, rule_version, job_id, triggered_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(mode_id, symbol, entry_date, rule_version) DO UPDATE SET
              exit_date=excluded.exit_date,
              exit_price=excluded.exit_price,
              holding_days=excluded.holding_days,
              trade_status=excluded.trade_status,
              pnl_pct=excluded.pnl_pct,
              max_drawdown_pct=excluded.max_drawdown_pct,
              job_id=excluded.job_id,
              triggered_by=excluded.triggered_by,
              updated_at=excluded.updated_at
            """,
            (
                ledger_id,
                mode_id,
                symbol,
                entry_date,
                target_date if exit_row else None,
                entry_price,
                exit_price,
                holding_days,
                trade_status,
                decision_id,
                pnl_pct,
                max_drawdown_pct,
                rule_version,
                job_id,
                triggered_by,
                now,
                now,
            ),
        )
        count += 1
    return count


def _calc_metrics(rows: List) -> Dict[str, Optional[float]]:
    sample_size = len(rows)
    if sample_size == 0:
        return {
            "sample_size": 0,
            "hit_rate": None,
            "max_drawdown": None,
            "payoff_ratio": None,
            "stability_score": None,
        }

    pnls = [float(r[0]) for r in rows if r[0] is not None]
    if not pnls:
        return {
            "sample_size": 0,
            "hit_rate": None,
            "max_drawdown": None,
            "payoff_ratio": None,
            "stability_score": None,
        }

    wins = [x for x in pnls if x > 0]
    losses = [x for x in pnls if x <= 0]
    hit_rate = len(wins) / len(pnls) if pnls else None
    max_drawdown = min(pnls) if pnls else None
    avg_win = sum(wins) / len(wins) if wins else None
    avg_loss_abs = abs(sum(losses) / len(losses)) if losses else None
    payoff_ratio = (avg_win / avg_loss_abs) if avg_win is not None and avg_loss_abs else None
    stability_score = None
    if hit_rate is not None and max_drawdown is not None:
        stability_score = max(0.0, min(1.0, hit_rate - abs(max_drawdown)))
    return {
        "sample_size": len(pnls),
        "hit_rate": hit_rate,
        "max_drawdown": max_drawdown,
        "payoff_ratio": payoff_ratio,
        "stability_score": stability_score,
    }


def _upsert_snapshot_row(
    cursor,
    mode_id: str,
    scope: str,
    horizon: str,
    segment_key: str,
    coverage: Optional[float],
    metrics: Dict[str, Optional[float]],
    as_of_date: str,
    job_id: str,
    rule_version: str,
    triggered_by: str,
) -> None:
    computed_at = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        """
        INSERT OR REPLACE INTO mode_performance_snapshot
        (mode_id, scope, horizon, segment_key, coverage, hit_rate, max_drawdown,
         sample_size, payoff_ratio, stability_score, job_id, rule_version, triggered_by, as_of_date, computed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            mode_id,
            scope,
            horizon,
            segment_key,
            coverage,
            metrics["hit_rate"],
            metrics["max_drawdown"],
            metrics["sample_size"],
            metrics["payoff_ratio"],
            metrics["stability_score"],
            job_id,
            rule_version,
            triggered_by,
            as_of_date,
            computed_at,
        ),
    )


def _refresh_snapshots(
    conn,
    mode_id: str,
    as_of_date: str,
    job_id: str,
    rule_version: str,
    triggered_by: str,
) -> int:
    cursor = conn.cursor()
    created = 0
    for horizon, days in HORIZONS.items():
        cutoff = _cutoff_date(as_of_date, days)

        # Universal scope
        cursor.execute(
            """
            SELECT pnl_pct
            FROM mode_simulated_trade_ledger
            WHERE mode_id = ? AND trade_status = 'closed' AND entry_date BETWEEN ? AND ?
            """,
            (mode_id, cutoff, as_of_date),
        )
        rows = cursor.fetchall()
        metrics = _calc_metrics(rows)

        cursor.execute(
            """
            SELECT COUNT(*)
            FROM mode_decision_log
            WHERE mode_id = ? AND decision_date BETWEEN ? AND ?
            """,
            (mode_id, cutoff, as_of_date),
        )
        decision_total = int(cursor.fetchone()[0] or 0)
        coverage = (metrics["sample_size"] / decision_total) if decision_total > 0 else None
        _upsert_snapshot_row(
            cursor,
            mode_id,
            "universal",
            horizon,
            "all",
            coverage,
            metrics,
            as_of_date,
            job_id,
            rule_version,
            triggered_by,
        )
        created += 1

        # Pool scope: by user watchlist
        cursor.execute(
            """
            SELECT DISTINCT w.user_id
            FROM user_watchlist w
            LEFT JOIN user_investment_mode uim ON uim.user_id = w.user_id
            WHERE COALESCE(uim.mode_id, ?) = ?
            """,
            (DEFAULT_MODE_ID, mode_id),
        )
        users = [r[0] for r in cursor.fetchall()]
        for user_id in users:
            cursor.execute(
                """
                SELECT l.pnl_pct
                FROM mode_simulated_trade_ledger l
                JOIN user_watchlist w ON w.symbol = l.symbol
                WHERE l.mode_id = ? AND l.trade_status = 'closed'
                  AND l.entry_date BETWEEN ? AND ?
                  AND w.user_id = ?
                """,
                (mode_id, cutoff, as_of_date, user_id),
            )
            user_rows = cursor.fetchall()
            user_metrics = _calc_metrics(user_rows)
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM mode_decision_log d
                JOIN user_watchlist w ON w.symbol = d.symbol
                WHERE d.mode_id = ? AND d.decision_date BETWEEN ? AND ? AND w.user_id = ?
                """,
                (mode_id, cutoff, as_of_date, user_id),
            )
            user_decisions = int(cursor.fetchone()[0] or 0)
            user_coverage = (user_metrics["sample_size"] / user_decisions) if user_decisions > 0 else None
            _upsert_snapshot_row(
                cursor,
                mode_id,
                "pool",
                horizon,
                f"user:{user_id}",
                user_coverage,
                user_metrics,
                as_of_date,
                job_id,
                rule_version,
                triggered_by,
            )
            created += 1
    return created


def run_mode_pipeline(
    as_of_date: Optional[str] = None,
    mode_id: Optional[str] = None,
    job_id: Optional[str] = None,
    rule_version: str = DEFAULT_RULE_VERSION,
    triggered_by: str = "scheduler",
) -> Dict[str, int]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        ensure_mode_pipeline_schema(conn)
        target_date = as_of_date
        if not target_date:
            cursor.execute("SELECT MAX(date) FROM ai_predictions_v2 WHERE is_primary = 1")
            row = cursor.fetchone()
            target_date = row[0] if row and row[0] else _today_str()

        final_job_id = job_id or f"mode-{uuid.uuid4().hex[:12]}"
        modes = [mode_id] if mode_id else SUPPORTED_MODES
        decisions = 0
        ledger_rows = 0
        snapshots = 0
        for current_mode in modes:
            decisions += _upsert_mode_decisions(conn, current_mode, target_date, final_job_id, rule_version, triggered_by)
            ledger_rows += _upsert_mode_ledger(conn, current_mode, target_date, final_job_id, rule_version, triggered_by)
            snapshots += _refresh_snapshots(conn, current_mode, target_date, final_job_id, rule_version, triggered_by)

        conn.commit()
        stats = {
            "date": target_date,
            "modes": len(modes),
            "decision_rows": decisions,
            "ledger_rows": ledger_rows,
            "snapshot_rows": snapshots,
            "job_id": final_job_id,
            "rule_version": rule_version,
            "triggered_by": triggered_by,
        }
        logger.info(f"✅ Mode pipeline finished: {stats}")
        return stats
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
