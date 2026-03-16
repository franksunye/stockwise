import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import akshare as ak
import pandas as pd

from backend.context.provider import MarketContextProvider
from backend.database import get_connection
from backend.logger import logger


def _isolated_ak_fetch(func, **kwargs) -> Any:
    """Helper to fetch from AkShare with high-reliability isolation fallback."""
    import time
    try:
        # Standard fetch
        res = func(**kwargs)
        if res is not None:
            return res
    except Exception:
        pass
    
    # Isolated fallback (No Proxy) with Jitter
    time.sleep(1.0) # Jitter to allow connection cooling
    original_no_proxy = os.environ.get('NO_PROXY')
    os.environ['NO_PROXY'] = '*'
    try:
        return func(**kwargs)
    except Exception as e:
        logger.warning(f"Isolated fetch failed for {func.__name__}: {e}")
        return None
    finally:
        if original_no_proxy is None:
            os.environ.pop('NO_PROXY', None)
        else:
            os.environ['NO_PROXY'] = original_no_proxy


def _fetch_breadth_stable() -> Tuple[Optional[int], Optional[int], Dict[str, Any]]:
    """Fetch market breadth using stable LeGu aggregate API."""
    try:
        df = _isolated_ak_fetch(ak.stock_market_activity_legu)
        if df is not None and not df.empty:
            adv = _safe_float(df[df["item"] == "上涨"]["value"].iloc[0])
            dec = _safe_float(df[df["item"] == "下跌"]["value"].iloc[0])
            if adv is not None and dec is not None:
                return int(adv), int(dec), {"status": "ok", "source": "akshare:stock_market_activity_legu"}
    except Exception as e:
        logger.warning(f"Stable breadth logic failed: {e}")
    return None, None, {"status": "missing", "source": "akshare:stock_market_activity_legu"}


def _fetch_total_turnover_stable() -> Tuple[Optional[float], Dict[str, Any]]:
    """Fetch total market turnover by summing SH and SZ indices."""
    try:
        df = _isolated_ak_fetch(ak.stock_zh_index_spot_em)
        if df is not None and not df.empty:
            sh = df[df["代码"] == "000001"]
            sz = df[df["代码"] == "399001"]
            if not sh.empty and not sz.empty:
                sh_amt = _safe_float(sh["成交额"].iloc[0])
                sz_amt = _safe_float(sz["成交额"].iloc[0])
                if sh_amt is not None and sz_amt is not None:
                    total_yi = (sh_amt + sz_amt) / 1e8
                    return total_yi, {"status": "ok", "source": "akshare:stock_zh_index_spot_em"}
    except Exception as e:
        logger.warning(f"Stable turnover logic failed: {e}")
    return None, {"status": "missing", "source": "akshare:stock_zh_index_spot_em"}




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


def _extract_limit_stats(fact_date: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    dt = fact_date.replace("-", "")
    result = {"limit_up": None, "limit_down": None, "broken_rate": None}
    status_meta = {"status": "missing", "source": "akshare:zt_pool"}
    try:
        up_df = _isolated_ak_fetch(ak.stock_zt_pool_em, date=dt)
        down_df = _isolated_ak_fetch(ak.stock_zt_pool_dtgc_em, date=dt)
        broken_df = _isolated_ak_fetch(ak.stock_zt_pool_zbgc_em, date=dt)
        
        limit_up = int(len(up_df)) if up_df is not None else 0
        limit_down = int(len(down_df)) if down_df is not None else 0
        broken_count = int(len(broken_df)) if broken_df is not None else 0
        
        result["limit_up"] = limit_up
        result["limit_down"] = limit_down
        denom = max(limit_up + broken_count, 1)
        result["broken_rate"] = round(broken_count / denom, 4)
        status_meta["status"] = "ok"
    except Exception as e:
        logger.warning(f"Limit stats logic failed: {e}")
        status_meta["error"] = str(e)
    return result, status_meta


def _extract_index_trend(symbol: str) -> Dict[str, Any]:
    out = {"symbol": symbol, "pct_1d": None, "pct_5d": None, "pct_20d": None, "direction": "flat", "status": "missing"}
    try:
        df = _isolated_ak_fetch(ak.stock_zh_index_daily_em, symbol=symbol)
        if df is None or df.empty or "close" not in df.columns:
            return out
        closes = pd.to_numeric(df["close"], errors="coerce").dropna().tolist()
        if len(closes) < 2:
            return out
        c_now = closes[-1]
        c_prev = closes[-2]
        c_5 = closes[-5] if len(closes) >= 5 else closes[0]
        c_20 = closes[-20] if len(closes) >= 20 else closes[0]
        
        out.update({
            "pct_1d": round((c_now / c_prev - 1) * 100, 2) if c_prev else 0,
            "pct_5d": round((c_now / c_5 - 1) * 100, 2) if c_5 else 0,
            "pct_20d": round((c_now / c_20 - 1) * 100, 2) if c_20 else 0,
            "direction": _to_direction(c_now - c_prev),
            "status": "ok"
        })
    except Exception as e:
        logger.warning(f"Index trend logic failed for {symbol}: {e}")
        out["error"] = str(e)
    return out


def _trend_3d(values: List[Optional[float]]) -> str:
    clean = [v for v in values if v is not None]
    if len(clean) < 2:
        return "unknown"
    delta = clean[-1] - clean[0]
    return _to_direction(delta, eps=1e-6)


def _compute_quality_and_gate(facts: Dict[str, Any]) -> Dict[str, Any]:
    # Yellow Pages MVP: do not hard-require fragile upstream modules.
    # We keep "breadth" as the only truly critical fetch; other modules may degrade.
    required = [
        "turnover",
        "breadth",
        "limit_stats",
        "core_indices",
        "northbound",
        "sector_flow",
    ]
    critical = ["breadth"]
    missing: List[str] = []
    for k in required:
        status = facts.get(k, {}).get("status")
        if status != "ok":
            missing.append(k)
    missing_critical = [k for k in critical if k in missing]

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
    # Gate: pass if critical data is present and overall coverage is decent.
    # This intentionally allows missing turnover / indices in constrained environments.
    gate_pass = (len(missing_critical) == 0) and (covered >= 2) and freshness_pass and (not conflict)

    flags = []
    if missing:
        flags.extend([f"missing_{x}" for x in missing])
    if conflict:
        flags.append("risk_conflict_detected")

    return {
        "required_fields": required,
        "critical_fields": critical,
        "missing_critical_fields": missing_critical,
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
            future_turnover = executor.submit(_fetch_total_turnover_stable)
            future_breadth = executor.submit(_fetch_breadth_stable)
            future_limit = executor.submit(_extract_limit_stats, fact_date)
            future_sh = executor.submit(_extract_index_trend, "sh000001")
            future_sz = executor.submit(_extract_index_trend, "sz399001")
            future_cyb = executor.submit(_extract_index_trend, "sz399006")
            future_flow = executor.submit(provider.get_market_flow_context)

            turnover_now, turnover_meta = future_turnover.result()
            adv, dec, breadth_meta = future_breadth.result()
            limit_stats, limit_meta = future_limit.result()
            idx_sh = future_sh.result()
            idx_sz = future_sz.result()
            idx_cyb = future_cyb.result()
            flow_data = future_flow.result()
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
                "total_amount_yi": round(float(turnover_now), 2) if turnover_now is not None else None,
                "ma5": round(float(ma5), 2) if ma5 is not None else None,
                "ma20": round(float(ma20), 2) if ma20 is not None else None,
                "ratio_5d": round(float(ratio5), 3) if ratio5 is not None else None,
                "ratio_20d": round(float(ratio20), 3) if ratio20 is not None else None,
            },
            "breadth": {
                "status": "ok" if breadth_ratio is not None else "missing",
                "source": breadth_meta.get("source"),
                "advancers": adv,
                "decliners": dec,
                "ratio": round(float(breadth_ratio), 3) if breadth_ratio is not None else None,
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
    # Only use existing if it has data AND passed the quality gate.
    # This allows re-triggering jobs to attempt fresh fetching if earlier attempts failed.
    if existing and existing.get("facts") and existing.get("quality") and existing.get("gate_pass"):
        return existing
    try:
        return generate_market_facts(fact_date)
    except Exception as e:
        logger.warning(f"generate_market_facts failed for {fact_date}, trying historical fallback: {e}")
        fallback = get_latest_market_facts_on_or_before(fact_date)
        if fallback and fallback.get("facts"):
            quality = fallback.get("quality")
            if not isinstance(quality, dict):
                quality = {}
            else:
                quality = dict(quality)
            
            flags_list = quality.get("flags")
            if not isinstance(flags_list, list):
                flags_list = []
            else:
                flags_list = list(flags_list)
                
            flags_list.append("stale_fallback_used")
            quality["flags"] = sorted(set(flags_list))
            quality["gate_pass"] = False
            quality["fallback_fact_date"] = fallback.get("fact_date")
            fallback["quality"] = quality
            fallback["gate_pass"] = False
            return fallback
        raise
