import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import akshare as ak
import pandas as pd

from backend.context.provider import MarketContextProvider
from backend.database import get_connection
from backend.logger import logger


def _today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _safe_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        if isinstance(v, str):
            v = v.replace(",", "").strip()
            if not v:
                return None
        return float(v)
    except Exception:
        return None


def _parse_signed_number(text: str) -> Optional[float]:
    if not text:
        return None
    m = re.search(r"([+-]?\d+(?:\.\d+)?)", str(text))
    if not m:
        return None
    return _safe_float(m.group(1))


def _to_direction(delta: Optional[float], eps: float = 1e-9) -> str:
    if delta is None:
        return "flat"
    if delta > eps:
        return "up"
    if delta < -eps:
        return "down"
    return "flat"


def _compute_ma(values: List[float], window: int) -> Optional[float]:
    if len(values) < window:
        return None
    part = values[-window:]
    return sum(part) / window if part else None


def _ensure_market_facts_table() -> None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS market_facts_daily (
                fact_date TEXT PRIMARY KEY,
                facts_json TEXT NOT NULL,
                quality_json TEXT NOT NULL,
                gate_pass INTEGER NOT NULL DEFAULT 0,
                coverage_score REAL,
                created_at TIMESTAMP DEFAULT (datetime('now', '+8 hours')),
                updated_at TIMESTAMP DEFAULT (datetime('now', '+8 hours'))
            )
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_market_facts_gate_date ON market_facts_daily(gate_pass, fact_date DESC)"
        )
        conn.commit()
    finally:
        conn.close()


def _load_recent_facts(cur, fact_date: str, limit: int = 25) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT fact_date, facts_json, quality_json, gate_pass
        FROM market_facts_daily
        WHERE fact_date <= ?
        ORDER BY fact_date DESC
        LIMIT ?
        """,
        (fact_date, limit),
    )
    rows = cur.fetchall()
    out = []
    for row in rows:
        try:
            out.append(
                {
                    "fact_date": row[0],
                    "facts": json.loads(row[1]) if row[1] else {},
                    "quality": json.loads(row[2]) if row[2] else {},
                    "gate_pass": int(row[3]) if row[3] is not None else 0,
                }
            )
        except Exception:
            continue
    return out


def _fetch_a_spot() -> Tuple[Optional[pd.DataFrame], Dict[str, Any]]:
    try:
        df = ak.stock_zh_a_spot_em()
        if df is None or df.empty:
            return None, {"status": "missing", "source": "akshare:stock_zh_a_spot_em"}
        return df, {"status": "ok", "source": "akshare:stock_zh_a_spot_em", "sample_size": int(len(df))}
    except Exception as e:
        logger.warning(f"market facts spot fetch failed: {e}")
        return None, {"status": "missing", "source": "akshare:stock_zh_a_spot_em", "error": str(e)}


def _extract_turnover_from_spot(df: Optional[pd.DataFrame]) -> Tuple[Optional[float], Dict[str, Any]]:
    try:
        if df is None or df.empty:
            return None, {"status": "missing", "source": "akshare:stock_zh_a_spot_em"}
        amount_col = "成交额"
        if amount_col not in df.columns:
            return None, {"status": "missing", "source": "akshare:stock_zh_a_spot_em"}
        amounts = pd.to_numeric(df[amount_col], errors="coerce")
        total_amount_yi = float(amounts.fillna(0).sum()) / 1e8
        return total_amount_yi, {
            "status": "ok",
            "source": "akshare:stock_zh_a_spot_em",
            "sample_size": int(len(df)),
        }
    except Exception as e:
        logger.warning(f"market facts turnover fetch failed: {e}")
        return None, {"status": "missing", "source": "akshare:stock_zh_a_spot_em", "error": str(e)}


def _extract_breadth_from_spot(df: Optional[pd.DataFrame]) -> Tuple[Optional[int], Optional[int], Dict[str, Any]]:
    try:
        if df is None or df.empty or "涨跌幅" not in df.columns:
            return None, None, {"status": "missing", "source": "akshare:stock_zh_a_spot_em"}
        pct = pd.to_numeric(df["涨跌幅"], errors="coerce")
        adv = int((pct > 0).sum())
        dec = int((pct < 0).sum())
        return adv, dec, {
            "status": "ok",
            "source": "akshare:stock_zh_a_spot_em",
            "sample_size": int(len(df)),
        }
    except Exception as e:
        logger.warning(f"market facts breadth fetch failed: {e}")
        return None, None, {"status": "missing", "source": "akshare:stock_zh_a_spot_em", "error": str(e)}


def _extract_limit_stats(fact_date: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    dt = fact_date.replace("-", "")
    result = {"limit_up": None, "limit_down": None, "broken_rate": None}
    status = {"status": "missing", "source": "akshare:zt_pool"}
    try:
        up_df = ak.stock_zt_pool_em(date=dt)
        down_df = ak.stock_zt_pool_dtgc_em(date=dt)
        broken_df = ak.stock_zt_pool_zbgc_em(date=dt)
        limit_up = int(len(up_df)) if up_df is not None else 0
        limit_down = int(len(down_df)) if down_df is not None else 0
        broken_count = int(len(broken_df)) if broken_df is not None else 0
        result["limit_up"] = limit_up
        result["limit_down"] = limit_down
        denom = max(limit_up + broken_count, 1)
        result["broken_rate"] = round(broken_count / denom, 4)
        status = {"status": "ok", "source": "akshare:zt_pool"}
    except Exception as e:
        logger.warning(f"market facts limit stats fetch failed: {e}")
        status = {"status": "missing", "source": "akshare:zt_pool", "error": str(e)}
    return result, status


def _extract_index_trend(symbol: str) -> Dict[str, Any]:
    out = {"symbol": symbol, "pct_1d": None, "pct_5d": None, "pct_20d": None, "direction": "flat"}
    try:
        df = ak.stock_zh_index_daily_em(symbol=symbol)
        if df is None or df.empty or "close" not in df.columns:
            out["status"] = "missing"
            return out
        closes = pd.to_numeric(df["close"], errors="coerce").dropna().tolist()
        if len(closes) < 2:
            out["status"] = "missing"
            return out
        last = closes[-1]
        prev1 = closes[-2] if len(closes) >= 2 else None
        prev5 = closes[-6] if len(closes) >= 6 else None
        prev20 = closes[-21] if len(closes) >= 21 else None
        out["pct_1d"] = round((last - prev1) / prev1 * 100, 3) if prev1 else None
        out["pct_5d"] = round((last - prev5) / prev5 * 100, 3) if prev5 else None
        out["pct_20d"] = round((last - prev20) / prev20 * 100, 3) if prev20 else None
        out["direction"] = _to_direction(out["pct_1d"])
        out["status"] = "ok"
        return out
    except Exception as e:
        out["status"] = "missing"
        out["error"] = str(e)
        return out


def _trend_3d(values: List[Optional[float]]) -> str:
    clean = [v for v in values if v is not None]
    if len(clean) < 2:
        return "unknown"
    delta = clean[-1] - clean[0]
    return _to_direction(delta, eps=1e-6)


def _compute_quality_and_gate(facts: Dict[str, Any]) -> Dict[str, Any]:
    required = [
        "turnover",
        "breadth",
        "limit_stats",
        "core_indices",
        "northbound",
        "sector_flow",
    ]
    missing: List[str] = []
    for k in required:
        status = facts.get(k, {}).get("status")
        if status != "ok":
            missing.append(k)

    completeness = round(100.0 * (len(required) - len(missing)) / len(required), 1)

    dims = {
        "market_temperature": facts.get("breadth", {}).get("status") == "ok",
        "liquidity": facts.get("turnover", {}).get("status") == "ok",
        "trend_state": facts.get("core_indices", {}).get("status") == "ok",
        "fund_structure": (
            facts.get("northbound", {}).get("status") == "ok"
            and facts.get("sector_flow", {}).get("status") == "ok"
        ),
        "risk_divergence": (
            facts.get("turnover", {}).get("status") == "ok"
            and facts.get("breadth", {}).get("status") == "ok"
        ),
    }
    covered = sum(1 for v in dims.values() if v)
    coverage_score = round(100.0 * covered / 5.0, 1)

    missing_count = len(missing)
    freshness_pass = missing_count <= 1
    conflict = bool(facts.get("derived", {}).get("risk_conflict"))
    gate_pass = completeness >= 85.0 and covered >= 4 and freshness_pass and (not conflict)

    flags = []
    if missing:
        flags.extend([f"missing_{x}" for x in missing])
    if conflict:
        flags.append("risk_conflict_detected")

    return {
        "required_fields": required,
        "missing_fields": missing,
        "completeness": completeness,
        "dimensions": dims,
        "covered_dimensions": covered,
        "coverage_score": coverage_score,
        "freshness_pass": freshness_pass,
        "gate_pass": gate_pass,
        "flags": sorted(set(flags)),
    }


def generate_market_facts(fact_date: Optional[str] = None) -> Dict[str, Any]:
    fact_date = fact_date or _today_str()
    _ensure_market_facts_table()

    provider = MarketContextProvider()

    conn = get_connection()
    try:
        cur = conn.cursor()
        recent = _load_recent_facts(cur, fact_date, limit=30)
        prev_turnovers = [
            _safe_float((item.get("facts") or {}).get("turnover", {}).get("total_amount_yi"))
            for item in reversed(recent)
            if item.get("fact_date") < fact_date
        ]

        # Parallel Fetching
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=6) as executor:
            future_spot = executor.submit(_fetch_a_spot)
            future_limit = executor.submit(_extract_limit_stats, fact_date)
            future_sh = executor.submit(_extract_index_trend, "sh000001")
            future_sz = executor.submit(_extract_index_trend, "sz399001")
            future_cyb = executor.submit(_extract_index_trend, "sz399006")
            future_flow = executor.submit(provider.get_market_flow_context)

            spot_df, _spot_meta = future_spot.result()
            limit_stats, limit_meta = future_limit.result()
            idx_sh = future_sh.result()
            idx_sz = future_sz.result()
            idx_cyb = future_cyb.result()
            flow_data = future_flow.result()

        turnover_now, turnover_meta = _extract_turnover_from_spot(spot_df)
        turnover_series = [v for v in prev_turnovers if v is not None]
        if turnover_now is not None:
            turnover_series = turnover_series + [turnover_now]
        ma5 = _compute_ma(turnover_series, 5)
        ma20 = _compute_ma(turnover_series, 20)
        ratio5 = (turnover_now / ma5) if (turnover_now is not None and ma5 and ma5 > 0) else None
        ratio20 = (turnover_now / ma20) if (turnover_now is not None and ma20 and ma20 > 0) else None
        if ratio5 is None:
            vol_type = "flat"
        elif ratio5 >= 1.15:
            vol_type = "high"
        elif ratio5 <= 0.85:
            vol_type = "low"
        else:
            vol_type = "flat"

        adv, dec, breadth_meta = _extract_breadth_from_spot(spot_df)
        breadth_ratio = None
        if adv is not None and dec is not None and (adv + dec) > 0:
            breadth_ratio = adv / (adv + dec)
        prev_breadth = [
            _safe_float((item.get("facts") or {}).get("breadth", {}).get("ratio"))
            for item in reversed(recent)
            if item.get("fact_date") < fact_date
        ]
        breadth_trend = _trend_3d((prev_breadth + [breadth_ratio])[-3:])
        if breadth_ratio is None:
            breadth_type = "neutral"
        elif breadth_ratio >= 0.6:
            breadth_type = "bull"
        elif breadth_ratio <= 0.4:
            breadth_type = "bear"
        else:
            breadth_type = "neutral"

        idx_ok = all(i.get("status") == "ok" for i in [idx_sh, idx_sz, idx_cyb])
        core_indices = {
            "status": "ok" if idx_ok else "missing",
            "source": "akshare:stock_zh_index_daily_em",
            "items": {"sh000001": idx_sh, "sz399001": idx_sz, "sz399006": idx_cyb},
        }
        north = flow_data.get("northbound_breadth")
        north_score = None
        north_sentiment = "unknown"
        if isinstance(north, dict):
            north_score = _safe_float(north.get("win_ratio"))
            north_sentiment = str(north.get("sentiment") or "unknown")
        north_status = "ok" if north_score is not None else "missing"
        prev_north = [
            _safe_float((item.get("facts") or {}).get("northbound", {}).get("score"))
            for item in reversed(recent)
            if item.get("fact_date") < fact_date
        ]
        north_trend = _trend_3d((prev_north + [north_score])[-3:])

        top_in = str(flow_data.get("top_inflow_sectors") or "")
        top_out = str(flow_data.get("top_outflow_sectors") or "")
        first_in = top_in.split(",")[0].strip() if top_in else ""
        first_out = top_out.split(",")[0].strip() if top_out else ""
        first_in_val = _parse_signed_number(first_in)
        prev_sector_vals = [
            _parse_signed_number(str((item.get("facts") or {}).get("sector_flow", {}).get("top_inflow_head") or ""))
            for item in reversed(recent)
            if item.get("fact_date") < fact_date
        ]
        sector_trend = _trend_3d((prev_sector_vals + [first_in_val])[-3:])
        sector_status = "ok" if (top_in and "暂无数据" not in top_in and top_out) else "missing"

        fund_type = "neutral"
        if north_score is not None and first_in_val is not None:
            if north_score >= 0.55 and first_in_val > 0:
                fund_type = "inflow"
            elif north_score <= 0.45 and first_in_val <= 0:
                fund_type = "outflow"

        risk_conflict = (vol_type == "low" and breadth_type == "bull") or (vol_type == "high" and breadth_type == "bear")

        facts = {
            "version": "market_facts.v1",
            "fact_date": fact_date,
            "turnover": {
                "status": "ok" if turnover_now is not None else "missing",
                "source": turnover_meta.get("source"),
                "total_amount_yi": round(turnover_now, 2) if turnover_now is not None else None,
                "ma5": round(ma5, 2) if ma5 is not None else None,
                "ma20": round(ma20, 2) if ma20 is not None else None,
                "ratio_5d": round(ratio5, 3) if ratio5 is not None else None,
                "ratio_20d": round(ratio20, 3) if ratio20 is not None else None,
            },
            "breadth": {
                "status": "ok" if breadth_ratio is not None else "missing",
                "source": breadth_meta.get("source"),
                "advancers": adv,
                "decliners": dec,
                "ratio": round(breadth_ratio, 3) if breadth_ratio is not None else None,
                "trend_3d": breadth_trend,
            },
            "limit_stats": {
                "status": limit_meta.get("status", "missing"),
                "source": limit_meta.get("source"),
                "limit_up": limit_stats.get("limit_up"),
                "limit_down": limit_stats.get("limit_down"),
                "broken_rate": limit_stats.get("broken_rate"),
            },
            "core_indices": core_indices,
            "northbound": {
                "status": north_status,
                "source": "akshare:stock_hsgt_fund_flow_summary_em",
                "summary": flow_data.get("northbound_net_inflow"),
                "score": north_score,
                "sentiment": north_sentiment,
                "trend_3d": north_trend,
            },
            "sector_flow": {
                "status": sector_status,
                "source": (flow_data.get("lineage") or {}).get("sector_flow"),
                "top_inflow": top_in,
                "top_outflow": top_out,
                "top_inflow_head": first_in,
                "top_outflow_head": first_out,
                "trend_3d": sector_trend,
            },
            "derived": {
                "vol_type": vol_type,
                "breadth_type": breadth_type,
                "fund_type": fund_type,
                "risk_conflict": risk_conflict,
            },
        }

        quality = _compute_quality_and_gate(facts)

        cur.execute("SELECT 1 FROM market_facts_daily WHERE fact_date = ?", (fact_date,))
        exists = cur.fetchone()
        payload_facts = json.dumps(facts, ensure_ascii=False)
        payload_quality = json.dumps(quality, ensure_ascii=False)
        gate_pass = 1 if quality.get("gate_pass") else 0

        if exists:
            cur.execute(
                """
                UPDATE market_facts_daily
                SET facts_json = ?, quality_json = ?, gate_pass = ?, coverage_score = ?, updated_at = datetime('now', '+8 hours')
                WHERE fact_date = ?
                """,
                (payload_facts, payload_quality, gate_pass, quality.get("coverage_score"), fact_date),
            )
        else:
            cur.execute(
                """
                INSERT INTO market_facts_daily
                (fact_date, facts_json, quality_json, gate_pass, coverage_score)
                VALUES (?, ?, ?, ?, ?)
                """,
                (fact_date, payload_facts, payload_quality, gate_pass, quality.get("coverage_score")),
            )
        conn.commit()

        return {"fact_date": fact_date, "facts": facts, "quality": quality}
    finally:
        conn.close()


def get_market_facts(fact_date: str) -> Optional[Dict[str, Any]]:
    _ensure_market_facts_table()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT fact_date, facts_json, quality_json, gate_pass
            FROM market_facts_daily
            WHERE fact_date = ?
            """,
            (fact_date,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "fact_date": row[0],
            "facts": json.loads(row[1]) if row[1] else {},
            "quality": json.loads(row[2]) if row[2] else {},
            "gate_pass": bool(row[3]),
        }
    finally:
        conn.close()


def get_latest_market_facts_on_or_before(fact_date: str) -> Optional[Dict[str, Any]]:
    _ensure_market_facts_table()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT fact_date, facts_json, quality_json, gate_pass
            FROM market_facts_daily
            WHERE fact_date <= ?
            ORDER BY fact_date DESC
            LIMIT 1
            """,
            (fact_date,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "fact_date": row[0],
            "facts": json.loads(row[1]) if row[1] else {},
            "quality": json.loads(row[2]) if row[2] else {},
            "gate_pass": bool(row[3]),
        }
    finally:
        conn.close()


def get_or_generate_market_facts(fact_date: str) -> Dict[str, Any]:
    existing = get_market_facts(fact_date)
    if existing and existing.get("facts") and existing.get("quality"):
        return existing
    try:
        return generate_market_facts(fact_date)
    except Exception as e:
        logger.warning(f"generate_market_facts failed for {fact_date}, trying historical fallback: {e}")
        fallback = get_latest_market_facts_on_or_before(fact_date)
        if fallback and fallback.get("facts"):
            quality = dict(fallback.get("quality") or {})
            flags = list(quality.get("flags") or [])
            flags.append("stale_fallback_used")
            quality["flags"] = sorted(set(flags))
            quality["gate_pass"] = False
            quality["fallback_fact_date"] = fallback.get("fact_date")
            fallback["quality"] = quality
            fallback["gate_pass"] = False
            return fallback
        raise
