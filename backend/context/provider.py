"""
Market Context Provider
Integration with AkShare for Macro and Capital Flow Data.
"""
import logging
import time
import random
import re
import weakref
import os
import akshare as ak
import pandas as pd
from typing import Dict, Any, Optional, List
from datetime import datetime, date
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from concurrent.futures.thread import _worker, _threads_queues
from backend.logger import logger
from backend.database import get_connection
from backend.utils import get_market
try:
    import backend.config # Ensure NO_PROXY and other environment fixes are applied
except ImportError:
    pass


class _DaemonThreadPoolExecutor(ThreadPoolExecutor):
    """ThreadPoolExecutor whose workers do not block process exit."""

    def _adjust_thread_count(self):
        if self._idle_semaphore.acquire(timeout=0):
            return

        def weakref_cb(_, q=self._work_queue):
            q.put(None)

        num_threads = len(self._threads)
        if num_threads < self._max_workers:
            thread_name = '%s_%d' % (self._thread_name_prefix or self, num_threads)
            t = threading.Thread(
                name=thread_name,
                target=_worker,
                args=(
                    weakref.ref(self, weakref_cb),
                    self._work_queue,
                    self._initializer,
                    self._initargs,
                ),
            )
            t.daemon = True
            t.start()
            self._threads.add(t)
            _threads_queues[t] = self._work_queue

class MarketContextProvider:
    _instance = None
    _lock = threading.Lock()
    _executor_lock = threading.Lock()
    _executor = None
    
    # In-memory simple cache
    _cache = {
        "macro": {"data": None, "timestamp": None},
        "market_flow": {"data": None, "timestamp": None},
        "stock_flow": {} # {symbol: {data: ..., timestamp: ...}}
    }
    
    # Diagnostics Stats
    _stats = {
        "macro_attempts": 0, "macro_success": 0,
        "market_flow_attempts": 0, "market_flow_success": 0,
        "stock_flow_attempts": 0, "stock_flow_success": 0
    }
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(MarketContextProvider, cls).__new__(cls)
            if cls._executor is None:
                cls._executor = cls._make_executor()
        return cls._instance

    @classmethod
    def _make_executor(cls) -> _DaemonThreadPoolExecutor:
        return _DaemonThreadPoolExecutor(max_workers=5, thread_name_prefix="akshare")

    @classmethod
    def _get_executor(cls) -> _DaemonThreadPoolExecutor:
        with cls._executor_lock:
            if cls._executor is None:
                cls._executor = cls._make_executor()
            return cls._executor

    @classmethod
    def _reset_executor(cls):
        with cls._executor_lock:
            old_executor = cls._executor
            cls._executor = cls._make_executor()

        if old_executor is not None:
            old_executor.shutdown(wait=False, cancel_futures=True)
            logger.warning("♻️  Recreated AkShare executor after timeout to isolate stuck workers.")
        
    def get_diagnostics(self) -> Dict[str, Any]:
        """Return health statistics of data fetching."""
        return self._stats.copy()

    def _is_cache_valid(self, cache_entry: Dict, ttl_seconds: int) -> bool:
        if not cache_entry or not cache_entry.get("timestamp"):
            return False
        age = (datetime.now() - cache_entry["timestamp"]).total_seconds()
        return age < ttl_seconds

    def _safe_ak_fetch(
        self,
        func,
        *args,
        timeout: int = 60,
        max_retries: int = 2,
        **kwargs,
    ) -> Optional[Any]:
        """
        Safely call an AkShare function with retries and a timeout.
        Uses a thread pool to enforce the timeout globally.
        """
        retries = max(0, int(max_retries))
        base_delay = 1.0
        
        for i in range(retries + 1):
            try:
                attempt_str = f"(Attempt {i+1})" if i > 0 else ""
                logger.info(f"📡  AkShare Fetch: {func.__name__} {attempt_str}")
                
                # Use a daemonized executor so stale AkShare workers cannot pin process exit.
                future = self._get_executor().submit(func, *args, **kwargs)
                try:
                    return future.result(timeout=timeout)
                except TimeoutError:
                    logger.error(f"❌ AkShare TIMEOUT ({timeout}s) for {func.__name__}")
                    future.cancel()
                    self._reset_executor()
                    raise TimeoutError(f"AkShare function {func.__name__} timed out after {timeout}s")
                    
            except Exception as e:
                err_msg = str(e).lower()
                # Determine if it's a retryable network error
                is_retryable = any(x in err_msg for x in [
                    "timeout", "remote end closed", "connection aborted", 
                    "connection reset", "max retries", "connectionerror"
                ])
                
                if i < retries and is_retryable:
                    delay = base_delay * (2 ** i) + random.uniform(0, 0.5)
                    logger.warning(f"⚠️  Retryable Error in {func.__name__}: {type(e).__name__}. Retrying in {delay:.1f}s...")
                    time.sleep(delay)
                else:
                    logger.error(f"❌ Final Failure for {func.__name__}: {e}")
                    raise e

    @staticmethod
    def _parse_date(value: Any) -> Optional[date]:
        if value is None:
            return None
        text = str(value).strip()
        if not text or text.upper() == "N/A":
            return None

        quarter_match = re.search(r"(\d{4}).*?([1-4])", text)
        if quarter_match and ("Q" in text.upper() or "季" in text):
            y = int(quarter_match.group(1))
            q = int(quarter_match.group(2))
            m = q * 3
            d = 30 if m in (6, 9) else 31
            if m == 2:
                d = 28
            return date(y, m, d)

        month_match = re.match(r"^(\d{4})[-/年\.](\d{1,2})", text)
        if month_match:
            y = int(month_match.group(1))
            m = int(month_match.group(2))
            d = 28 if m == 2 else (30 if m in (4, 6, 9, 11) else 31)
            return date(y, m, d)

        full_match = re.match(r"^(\d{4})[-/年\.](\d{1,2})[-/月\.](\d{1,2})", text)
        if full_match:
            return date(int(full_match.group(1)), int(full_match.group(2)), int(full_match.group(3)))

        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y%m%d"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue
        return None

    def _extract_as_of_from_df(self, df: pd.DataFrame, candidate_columns: List[str], row_index: int = 0) -> Optional[Any]:
        if df is None or df.empty:
            return None
        idx = row_index if row_index < len(df) else 0
        row = df.iloc[idx]
        for c in candidate_columns:
            if c in df.columns:
                val = row.get(c)
                if pd.notna(val):
                    return val
        return None

    def _build_field_contract(
        self,
        *,
        value: Any,
        as_of: Optional[Any],
        source: str,
        fetched_at: datetime,
        freshness_days: int,
        skipped: bool = False,
    ) -> Dict[str, Any]:
        text_val = str(value).strip() if value is not None else ""
        missing = (
            value is None
            or text_val == ""
            or text_val.upper() == "N/A"
            or ("\u6682\u65e0\u6570\u636e" in text_val)
        )
        as_of_date = self._parse_date(as_of)
        status = "ok"
        freshness_score = 100

        if skipped:
            status = "skipped"
        elif missing:
            status = "missing"
            freshness_score = 0
        elif as_of_date is None:
            status = "no_as_of"
            freshness_score = 65
        else:
            age_days = max(0, (fetched_at.date() - as_of_date).days)
            if age_days <= freshness_days:
                status = "ok"
                freshness_score = 100
            elif age_days <= freshness_days * 2:
                status = "stale"
                freshness_score = 60
            else:
                status = "stale"
                freshness_score = 20

        return {
            "value": value,
            "as_of": str(as_of) if as_of is not None else None,
            "source": source,
            "fetched_at": fetched_at.isoformat(),
            "freshness_days": freshness_days,
            "status": status,
            "freshness_score": freshness_score,
        }

    @staticmethod
    def _score_quality(fields: Dict[str, Dict[str, Any]], required_fields: List[str], consistency_flags: Optional[List[str]] = None) -> Dict[str, Any]:
        consistency_flags = consistency_flags or []
        total = max(len(required_fields), 1)
        present = 0
        freshness_scores = []
        flags: List[str] = list(consistency_flags)

        for key in required_fields:
            item = fields.get(key, {})
            status = item.get("status", "missing")
            if status != "missing":
                present += 1
            freshness_scores.append(float(item.get("freshness_score", 0)))
            if status == "missing":
                flags.append(f"missing_{key}")
            elif status == "stale":
                flags.append(f"stale_{key}")

        completeness = round(100.0 * present / total, 1)
        freshness = round(sum(freshness_scores) / max(len(freshness_scores), 1), 1)
        consistency = max(0.0, 100.0 - 15.0 * len(consistency_flags))
        score = round(0.45 * completeness + 0.35 * freshness + 0.20 * consistency, 1)
        grade = "high" if score >= 85 else ("medium" if score >= 70 else "low")

        return {
            "score": score,
            "grade": grade,
            "completeness": completeness,
            "freshness": freshness,
            "consistency": round(consistency, 1),
            "flags": sorted(set(flags)),
        }

    @staticmethod
    def _parse_signed_flow(flow_text: str) -> Optional[float]:
        if not flow_text:
            return None
        match = re.search(r"([+-]?\d+(?:\.\d+)?)\s*亿", str(flow_text))
        if not match:
            return None
        try:
            return float(match.group(1))
        except (TypeError, ValueError):
            return None

    def _extract_sector_flows(self, df: pd.DataFrame, *, net_col: str, name_col: str, unit_divisor: float) -> Dict[str, Any]:
        if df.empty or net_col not in df.columns or name_col not in df.columns:
            return {"inflow": [], "outflow": [], "valid_rows": 0, "negative_count": 0}

        work = df.copy()
        work["net_val"] = pd.to_numeric(work[net_col], errors="coerce")
        work = work.dropna(subset=["net_val"])
        if work.empty:
            return {"inflow": [], "outflow": [], "valid_rows": 0, "negative_count": 0}

        def _fmt(row):
            name = row.get(name_col, "")
            net = float(row.get("net_val", 0.0)) / unit_divisor
            return f"{name}({net:+.2f}亿)"

        inflow_df = work[work["net_val"] > 0].sort_values("net_val", ascending=False)
        outflow_df = work[work["net_val"] < 0].sort_values("net_val", ascending=True)

        inflow = [_fmt(row) for _, row in inflow_df.head(3).iterrows()]
        if not inflow:
            inflow = [_fmt(row) for _, row in work.sort_values("net_val", ascending=False).head(3).iterrows()]

        outflow = [_fmt(row) for _, row in outflow_df.head(2).iterrows()]
        if not outflow:
            outflow = ["无明显净流出(>=0)"]

        return {
            "inflow": inflow,
            "outflow": outflow,
            "valid_rows": int(len(work)),
            "negative_count": int((work["net_val"] < 0).sum()),
        }

    def _get_hk_short_context(self, symbol: str) -> Dict[str, Any]:
        """Fetch HK short-selling context from local sync tables."""
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT trade_date, short_volume, short_turnover, short_volume_ratio, short_turnover_ratio, quality_flag
                FROM hk_short_selling_daily
                WHERE symbol = ?
                ORDER BY trade_date DESC
                LIMIT 1
                """,
                (symbol,),
            )
            daily = cur.fetchone()

            cur.execute(
                """
                SELECT report_week, short_interest_shares, short_interest_market_value, quality_flag
                FROM hk_short_interest_weekly
                WHERE symbol = ?
                ORDER BY report_week DESC
                LIMIT 1
                """,
                (symbol,),
            )
            weekly = cur.fetchone()

            cur.execute(
                """
                SELECT is_eligible, snapshot_date
                FROM hk_short_eligible_list
                WHERE symbol = ?
                ORDER BY snapshot_date DESC
                LIMIT 1
                """,
                (symbol,),
            )
            eligible = cur.fetchone()

            if not daily and not weekly and not eligible:
                return {
                    "summary": "港股做空数据暂无",
                    "big_order_inflow": "N/A",
                    "interpretation": "待同步",
                    "short_selling_context": {"has_data": False, "eligible": None},
                }

            daily_date = daily[0] if daily else None
            short_vol = float(daily[1]) if daily and daily[1] is not None else None
            short_amt = float(daily[2]) if daily and daily[2] is not None else None
            short_vol_ratio = float(daily[3]) if daily and daily[3] is not None else None
            short_amt_ratio = float(daily[4]) if daily and daily[4] is not None else None
            weekly_date = weekly[0] if weekly else None
            weekly_shares = float(weekly[1]) if weekly and weekly[1] is not None else None
            weekly_mv = float(weekly[2]) if weekly and weekly[2] is not None else None
            is_eligible = bool(eligible[0]) if eligible else None

            pressure_text = "做空压力数据不足"
            if short_amt_ratio is not None:
                if short_amt_ratio >= 0.2:
                    pressure_text = "做空压力偏高"
                elif short_amt_ratio >= 0.1:
                    pressure_text = "做空压力中性"
                else:
                    pressure_text = "做空压力偏低"

            ratio_text = f"{short_amt_ratio:.2%}" if short_amt_ratio is not None else "N/A"
            summary = f"做空成交比({daily_date or '-'})={ratio_text} | 周度申报做空仓位({weekly_date or '-'})"

            return {
                "summary": summary,
                "big_order_inflow": ratio_text,
                "interpretation": pressure_text,
                "short_selling_context": {
                    "has_data": True,
                    "eligible": is_eligible,
                    "daily": {
                        "trade_date": daily_date,
                        "short_volume": short_vol,
                        "short_turnover": short_amt,
                        "short_volume_ratio": short_vol_ratio,
                        "short_turnover_ratio": short_amt_ratio,
                        "quality_flag": daily[5] if daily else None,
                    },
                    "weekly": {
                        "report_week": weekly_date,
                        "short_interest_shares": weekly_shares,
                        "short_interest_market_value": weekly_mv,
                        "quality_flag": weekly[3] if weekly else None,
                    },
                    "eligible_snapshot_date": eligible[1] if eligible else None,
                },
            }
        except Exception as e:
            logger.warning(f"HK short context fetch failed for {symbol}: {e}")
            return {
                "summary": "港股做空数据暂不可用",
                "big_order_inflow": "N/A",
                "interpretation": "数据源异常",
                "short_selling_context": {"has_data": False, "error": str(e)},
            }
        finally:
            conn.close()

    def get_macro_context(self, skip_nasdaq: bool = False) -> Dict[str, Any]:
        """
        Fetch core macro indicators.
        Cache TTL: 24 hours (Macro data changes slowly)
        
        Args:
            skip_nasdaq: If True, skips the Nasdaq API call entirely.
                         Used when generating almanacs outside the valid
                         window (US market hasn't closed yet), so the data
                         would be stale/misleading.
        """
        self._stats["macro_attempts"] += 1
        
        # Invalidate stale cache missing nasdaq field (one-time migration guard)
        if self._cache["macro"]["data"] and "nasdaq" not in self._cache["macro"]["data"]:
            self._cache["macro"]["data"] = None

        if self._is_cache_valid(self._cache["macro"], 86400):
            cached = self._cache["macro"]["data"]
            # If caller wants nasdaq skipped but cache has real nasdaq data,
            # return a copy with nasdaq neutralized to avoid misleading usage
            if skip_nasdaq and cached.get("nasdaq") != "N/A":
                neutralized = {**cached, "nasdaq": "N/A", "nasdaq_skipped": True}
                fields = dict(neutralized.get("fields") or {})
                if "nasdaq" in fields:
                    fields["nasdaq"] = {
                        **fields["nasdaq"],
                        "value": "N/A",
                        "status": "skipped",
                    }
                    neutralized["fields"] = fields
                    neutralized["quality"] = self._score_quality(
                        fields,
                        ["gdp", "cpi", "bond_10y", "nasdaq"],
                    )
                return neutralized
            return cached

        logger.info("📡 Fetching Macro Data from AkShare...")
        try:
            tasks = {
                "gdp": (ak.macro_china_gdp, {}),
                "cpi": (ak.macro_china_cpi, {}),
                "bond": (ak.bond_zh_us_rate, {}),
            }
            if not skip_nasdaq:
                tasks["nasdaq"] = (ak.index_us_stock_sina, {"symbol": ".IXIC"})

            futures = {}
            executor = self._get_executor()
            for key, (func, kwargs) in tasks.items():
                futures[key] = executor.submit(self._safe_ak_fetch, func, **kwargs)

            # 1. GDP
            gdp_val = "N/A"
            try:
                df_gdp = futures["gdp"].result()
                if df_gdp is not None and not df_gdp.empty:
                    latest = df_gdp.iloc[0]
                    gdp_val = f"{latest['国内生产总值-同比增长']}% (Q{latest.get('季度', '')})"
            except Exception as e:
                logger.warning(f"Macro GDP fetch failed: {e}")

            # 2. CPI
            cpi_val = "N/A"
            try:
                df_cpi = futures["cpi"].result()
                if df_cpi is not None and not df_cpi.empty:
                    latest = df_cpi.iloc[0]
                    cpi_val = f"{latest['全国-同比增长']}% ({latest['月份']})"
            except Exception as e:
                logger.warning(f"Macro CPI fetch failed: {e}")

            # 3. 10Y Bond Yield
            bond_val = "N/A"
            try:
                df_bond = futures["bond"].result()
                if df_bond is not None and not df_bond.empty:
                    v_key = '中国国债收益率10年'
                    if v_key in df_bond.columns:
                        latest = df_bond.iloc[0]
                        val = latest[v_key]
                        if pd.notna(val):
                            bond_val = f"{val}%"
                        elif len(df_bond) > 1:
                            val_prev = df_bond.iloc[1][v_key]
                            if pd.notna(val_prev):
                                bond_val = f"{val_prev}%"
            except Exception as e:
                logger.warning(f"Macro Bond fetch failed: {e}")

            # 4. Global Context - Nasdaq
            nasdaq_pct = "N/A"
            nasdaq_as_of = None
            nasdaq_skipped = False
            if skip_nasdaq:
                logger.info("⏭️  Skipping Nasdaq fetch (skip_nasdaq=True, data would be stale)")
                nasdaq_skipped = True
            else:
                try:
                    df_nasdaq = futures["nasdaq"].result()
                    if df_nasdaq is not None and not df_nasdaq.empty and len(df_nasdaq) >= 2:
                        last = float(df_nasdaq.iloc[-1]['close'])
                        prev = float(df_nasdaq.iloc[-2]['close'])
                        change = (last - prev) / prev * 100
                        nasdaq_pct = f"{change:+.2f}%"
                        nasdaq_as_of = self._extract_as_of_from_df(df_nasdaq, ["date"], row_index=len(df_nasdaq) - 1)
                except Exception as e:
                    logger.warning(f"Global Nasdaq fetch failed: {e}")

            result = {
                "gdp": gdp_val,
                "cpi": cpi_val,
                "bond_10y": bond_val,
                "nasdaq": nasdaq_pct,
                "nasdaq_skipped": nasdaq_skipped,
                "summary": f"GDP:{gdp_val} | Bond10Y:{bond_val} | Nasdaq:{nasdaq_pct}"
            }
            fetched_at = datetime.now()
            fields = {
                "gdp": self._build_field_contract(
                    value=gdp_val, as_of=gdp_val, source="akshare:macro_china_gdp", fetched_at=fetched_at, freshness_days=120
                ),
                "cpi": self._build_field_contract(
                    value=cpi_val, as_of=cpi_val, source="akshare:macro_china_cpi", fetched_at=fetched_at, freshness_days=45
                ),
                "bond_10y": self._build_field_contract(
                    value=bond_val, as_of=fetched_at.date().isoformat(), source="akshare:bond_zh_us_rate", fetched_at=fetched_at, freshness_days=7
                ),
                "nasdaq": self._build_field_contract(
                    value=nasdaq_pct,
                    as_of=nasdaq_as_of or fetched_at.date().isoformat(),
                    source="akshare:index_us_stock_sina(.IXIC)",
                    fetched_at=fetched_at,
                    freshness_days=2,
                    skipped=nasdaq_skipped,
                ),
            }
            result["contract_version"] = "macro.v1"
            result["fields"] = fields
            result["quality"] = self._score_quality(fields, ["gdp", "cpi", "bond_10y", "nasdaq"])
            result["lineage"] = {
                "gdp": "akshare:macro_china_gdp",
                "cpi": "akshare:macro_china_cpi",
                "bond_10y": "akshare:bond_zh_us_rate",
                "nasdaq": "akshare:index_us_stock_sina(.IXIC)",
            }
            
            self._cache["macro"] = {"data": result, "timestamp": datetime.now()}
            self._stats["macro_success"] += 1
            return result
        except Exception as e:
            logger.error(f"❌ Macro Context Failed: {e}")
            return {"summary": "Macro data unavailable"}

    def get_market_flow_context(self) -> Dict[str, Any]:
        """
        Fetch market-wide capital flows (Northbound, Sector).
        Optimized to use the most stable domestic sources (THS/HSGT Summary).
        """
        self._stats["market_flow_attempts"] += 1
        
        if self._is_cache_valid(self._cache["market_flow"], 3600):
            return self._cache["market_flow"]["data"]

        logger.info("📡 Fetching Market Flow Data (Stable Route)...")
        
        north_val = "暂停披露"
        north_breadth = None
        top_inflow = []
        top_outflow = []
        fetched_at = datetime.now()
        north_source = "akshare:stock_hsgt_fund_flow_summary_em"
        sector_source = "unknown"
        consistency_flags: List[str] = []
        north_as_of = fetched_at.date().isoformat()
        sector_as_of = fetched_at.date().isoformat()

        # Yellow Pages MVP note:
        # "Sector ranking" style endpoints are frequently unstable (rate-limit/SSL/proxy).
        # We therefore anchor on a broad-market flow as the primary signal, and only
        # attempt sector detail when explicitly enabled or when broad-market is missing.

        # 1. Parallel Fetch for Northbound and optional Sector Detail
        executor = self._get_executor()
        enable_sector_detail = str(os.environ.get("YELLOWPAGES_SECTOR_DETAIL", "0")).strip() in {"1", "true", "True", "YES", "yes"}
        futures = {
            "north": executor.submit(self._safe_ak_fetch, ak.stock_hsgt_fund_flow_summary_em),
            # Broad-market is our primary and most stable route
            "broad": executor.submit(self._safe_ak_fetch, ak.stock_market_fund_flow),
            # Sector details are best-effort (often unstable). Keep them behind a flag.
            "em": executor.submit(
                self._safe_ak_fetch, ak.stock_sector_fund_flow_rank, indicator="今日", sector_type="行业资金流"
            ) if enable_sector_detail else None,
            "ths": executor.submit(self._safe_ak_fetch, ak.stock_fund_flow_industry, symbol="即时") if enable_sector_detail else None,
        }

        # 1.1 Process Northbound
        try:
            df_north = futures["north"].result()
            if df_north is not None and not df_north.empty:
                north_rows = df_north[df_north['资金方向'] == '北向']
                if not north_rows.empty:
                    winners = int(north_rows['上涨数'].sum())
                    losers = int(north_rows['下跌数'].sum())
                    flat = int(north_rows['持平数'].sum())
                    total = winners + losers + flat
                    
                    if total > 0:
                        win_ratio = winners / total
                        sentiment = "偏多" if win_ratio >= 0.65 else ("偏空" if win_ratio <= 0.35 else "均衡")
                        north_val = f"涨{winners}/跌{losers} ({sentiment})"
                        north_breadth = {
                            "winners": winners, "losers": losers, "flat": flat,
                            "win_ratio": round(win_ratio, 3), "sentiment": sentiment
                        }
                        logger.info(f"✅ Northbound breadth: {north_val}")
                    else:
                        logger.info("ℹ️  Northbound data has zero stocks (market may be closed)")
        except Exception as e:
            logger.warning(f"Northbound fetch issue: {e}")

        # 2. Sector Flows - Stable-first processing
        sector_fetched = False
        sector_detail_used = False

        # --- Primary: Broad Market (Stable Anchor) ---
        try:
            df_m = futures["broad"].result()
            if df_m is not None and not df_m.empty:
                m_flow = df_m.iloc[-1].get('主力净流入-净额', 0)
                top_inflow.append(f"全市场主力({m_flow/1e8:+.1f}亿)")
                sector_fetched = True
                sector_source = "akshare:stock_market_fund_flow"
                logger.info("✅ Broad market flow succeeded (primary).")
        except Exception as e:
            logger.warning(f"⚠️  Broad market flow failed: {e}")
        
        # --- Enhancement: Sector Details (Best-effort) ---
        # Only attempt if explicitly enabled AND (broad is missing OR we want extra detail).
        if enable_sector_detail:
            # --- Tier 1: Eastmoney Sector Rank ---
            try:
                if futures.get("em") is not None:
                    df_em = futures["em"].result()
                else:
                    df_em = None
                if df_em is not None and not df_em.empty:
                    net_col = '今日主力净流入-净额'
                    name_col = '名称'
                    if net_col in df_em.columns and name_col in df_em.columns:
                        df_em['net_val'] = pd.to_numeric(df_em[net_col], errors='coerce')
                        df_sorted = df_em.dropna(subset=['net_val']).sort_values('net_val', ascending=False)
                        
                        def fmt_em(row):
                            name = row.get(name_col, '')
                            net = row.get('net_val', 0) / 1e8  # 元 → 亿
                            return f"{name}({net:+.2f}亿)"
                        
                        # Keep broad-market as anchor, add sector details after it
                        extra_in = []
                        extra_out = []
                        for _, row in df_sorted.head(3).iterrows():
                            extra_in.append(fmt_em(row))
                        for _, row in df_sorted.tail(2).iterrows():
                            if float(row.get('net_val', 0)) < 0:
                                extra_out.append(fmt_em(row))
                        if extra_in:
                            top_inflow.extend(extra_in)
                        if extra_out:
                            top_outflow.extend(extra_out)
                        sector_detail_used = True
                        # If broad already succeeded, keep source anchored but record detail
                        if sector_source == "unknown":
                            sector_source = "akshare:stock_sector_fund_flow_rank"
                        logger.info(f"✅ Eastmoney Sector Detail Succeeded: {len(df_sorted)} sectors")
                    else:
                        logger.warning(f"EM sector flow columns mismatch: {list(df_em.columns)}")
                else:
                    logger.warning("EM sector flow empty")
            except Exception as e:
                logger.warning(f"⚠️  Eastmoney Sector Flow failed: {e}")
        
            # --- Tier 2: THS Sector Detail Fallback ---
            if not sector_detail_used:
                try:
                    if futures.get("ths") is not None:
                        df_sector = futures["ths"].result()
                    else:
                        df_sector = None
                    if df_sector is not None and not df_sector.empty:
                        df_sector['net_val'] = pd.to_numeric(df_sector['净额'], errors='coerce')
                        df_sorted = df_sector.dropna(subset=['net_val']).sort_values('net_val', ascending=False)
                        
                        def fmt_ths(row):
                            name = row.get('行业', '')
                            net = row.get('net_val', 0)  # THS 净额 already in 亿
                            return f"{name}({net:+.2f}亿)"

                        extra_in = []
                        extra_out = []
                        for _, row in df_sorted.head(3).iterrows():
                            extra_in.append(fmt_ths(row))
                        for _, row in df_sorted.tail(2).iterrows():
                            if float(row.get('net_val', 0)) < 0:
                                extra_out.append(fmt_ths(row))
                        if extra_in:
                            top_inflow.extend(extra_in)
                        if extra_out:
                            top_outflow.extend(extra_out)
                        sector_detail_used = True
                        if sector_source == "unknown":
                            sector_source = "akshare:stock_fund_flow_industry"
                        logger.info(f"✅ THS Industry Detail Fallback Succeeded: {len(df_sorted)} sectors")
                    else:
                        logger.warning("THS record empty")
                except Exception as e:
                    logger.error(f"❌ THS Sector Flow also failed: {e}")
        
        # If even broad-market failed, we consider the sector flow missing.
        if not sector_fetched:
            logger.warning("⚠️  Sector flow missing: broad-market route failed.")

        if not top_outflow:
            top_outflow = ["无明显净流出(>=0)"]
            consistency_flags.append("outflow_absent_non_negative_day")

        outflow_has_non_negative = False
        for item in top_outflow:
            parsed = self._parse_signed_flow(item)
            if parsed is not None and parsed >= 0:
                outflow_has_non_negative = True
                break
        if outflow_has_non_negative:
            consistency_flags.append("outflow_contains_non_negative_value")

        if sector_source == "unknown":
            if sector_fetched:
                sector_source = "akshare:sector_flow(primary_or_fallback)"
            else:
                sector_source = "akshare:stock_market_fund_flow(last_resort_or_empty)"

        result = {
            "northbound_net_inflow": north_val,
            "northbound_breadth": north_breadth,
            "top_inflow_sectors": ", ".join(top_inflow) if top_inflow else "暂无数据",
            "top_outflow_sectors": ", ".join(top_outflow) if top_outflow else "暂无数据",
            "summary": f"北向:{north_val} | 领涨:{', '.join(top_inflow[:2]) if top_inflow else 'N/A'} | 领跌:{', '.join(top_outflow[:1]) if top_outflow else 'N/A'}"
        }

        flow_fields = {
            "northbound_net_inflow": self._build_field_contract(
                value=north_val,
                as_of=north_as_of,
                source=north_source,
                fetched_at=fetched_at,
                freshness_days=2,
            ),
            "top_inflow_sectors": self._build_field_contract(
                value=result["top_inflow_sectors"],
                as_of=sector_as_of,
                source=sector_source,
                fetched_at=fetched_at,
                freshness_days=1,
            ),
            "top_outflow_sectors": self._build_field_contract(
                value=result["top_outflow_sectors"],
                as_of=sector_as_of,
                source=sector_source,
                fetched_at=fetched_at,
                freshness_days=1,
            ),
        }
        result["contract_version"] = "market_flow.v1"
        result["fields"] = flow_fields
        result["quality"] = self._score_quality(
            flow_fields,
            ["northbound_net_inflow", "top_inflow_sectors", "top_outflow_sectors"],
            consistency_flags=consistency_flags,
        )
        result["lineage"] = {"northbound": north_source, "sector_flow": sector_source}
        result["sector_detail_used"] = sector_detail_used
        result["sector_detail_enabled"] = enable_sector_detail

        self._cache["market_flow"] = {"data": result, "timestamp": datetime.now()}
        self._stats["market_flow_success"] += 1
        return result


    def get_stock_flow_context(self, symbol: str) -> Dict[str, Any]:
        """
        Fetch individual stock capital flow.
        Cache TTL: 30 mins
        """
        self._stats["stock_flow_attempts"] += 1
        
        # Symbol normalization for AkShare (if needed)
        # akshare input usually strict.
        # 600519 -> 600519
        
        # Check cache
        if symbol in self._cache["stock_flow"]:
            entry = self._cache["stock_flow"][symbol]
            if self._is_cache_valid(entry, 1800):
                return entry["data"]

        logger.info(f"📡 Fetching Flow Data for {symbol}...")
        try:
            # 1. Individual Flow (stock_individual_fund_flow)
            market_code = "sh" if symbol.startswith("6") else "sz"
            if symbol.startswith("4") or symbol.startswith("8"): market_code = "bj"
            # HK stocks might not work with this specific API, check docs
            # stock_individual_fund_flow is for A-share
            
            if get_market(symbol) == "HK":
                # HK stock: use local short-selling context synced by hk_short job.
                result = self._get_hk_short_context(symbol)
                self._cache["stock_flow"][symbol] = {"data": result, "timestamp": datetime.now()}
                self._stats["stock_flow_success"] += 1
                return result
            if get_market(symbol) == "US":
                result = {"summary": "US market flow is not supported in current free datasource."}
                self._cache["stock_flow"][symbol] = {"data": result, "timestamp": datetime.now()}
                self._stats["stock_flow_success"] += 1
                return result

            try:
                flow_timeout = int(os.getenv("AKSHARE_STOCK_FLOW_TIMEOUT_SEC", "12"))
            except Exception:
                flow_timeout = 12
            try:
                flow_retries = int(os.getenv("AKSHARE_STOCK_FLOW_RETRIES", "1"))
            except Exception:
                flow_retries = 1

            df = self._safe_ak_fetch(
                ak.stock_individual_fund_flow,
                stock=symbol,
                market=market_code,
                timeout=max(3, flow_timeout),
                max_retries=max(0, flow_retries),
            )
            
            flow_summary = "N/A"
            big_order_val = "N/A"
            
            if df is not None and not df.empty:
                # DataFrame usually has historical data. We want the LATEST date.
                # Columns: 日期, 收盘价, ... 主力净流入-净额, 超大单...
                latest = df.iloc[0] # Usually sorted DESC? Let's verify sort.
                # Actually akshare usually returns sorted by date ascending?
                # research script showed latest date at bottom (tail).
                latest = df.iloc[-1]
                
                # Check date freshness?
                data_date = str(latest.get('日期', ''))
                
                # Calculate "Main Force" = Super Large + Large
                # Or just use "主力净流入-净额" if available
                main_net = latest.get('主力净流入-净额', 0)
                
                def fmt_flow(val):
                    v = float(val)
                    if abs(v) > 100000000: return f"{v/100000000:+.2f}亿"
                    if abs(v) > 10000: return f"{v/10000:+.2f}万"
                    return f"{v:+.0f}"

                big_order_val = fmt_flow(main_net)
                
                # Semantic interpretation
                try:
                    net_float = float(main_net)
                    if net_float > 0: flow_summary = "主力净流入 (吸筹)"
                    elif net_float < 0: flow_summary = "主力净流出 (出货)"
                    else: flow_summary = "资金平衡"
                except (ValueError, TypeError):
                    flow_summary = "数据解析错误"

            result = {
                "big_order_inflow": big_order_val,
                "interpretation": flow_summary,
                "summary": f"主力资金: {big_order_val} [{flow_summary}]"
            }
            
            self._cache["stock_flow"][symbol] = {"data": result, "timestamp": datetime.now()}
            self._stats["stock_flow_success"] += 1
            return result
            
        except Exception as e:
            logger.warning(f"Stock flow fetch failed for {symbol}: {e}")
            return {
                "summary": "资金流数据暂不可用",
                "big_order_inflow": "N/A",
                "interpretation": "数据源异常"
            }
