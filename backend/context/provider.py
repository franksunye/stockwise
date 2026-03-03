"""
Market Context Provider
Integration with AkShare for Macro and Capital Flow Data.
"""
import logging
import time
import random
import akshare as ak
import pandas as pd
from typing import Dict, Any
from datetime import datetime
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from backend.logger import logger
try:
    import backend.config # Ensure NO_PROXY and other environment fixes are applied
except ImportError:
    pass

class MarketContextProvider:
    _instance = None
    _lock = threading.Lock()
    _executor = ThreadPoolExecutor(max_workers=5) # Reusable thread pool for timeouts
    
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
        return cls._instance
        
    def get_diagnostics(self) -> Dict[str, Any]:
        """Return health statistics of data fetching."""
        return self._stats.copy()

    def _is_cache_valid(self, cache_entry: Dict, ttl_seconds: int) -> bool:
        if not cache_entry or not cache_entry.get("timestamp"):
            return False
        age = (datetime.now() - cache_entry["timestamp"]).total_seconds()
        return age < ttl_seconds

    def _safe_ak_fetch(self, func, *args, timeout=30, **kwargs):
        """
        Executes an AkShare function with a robust retry mechanism and mandatory timeout.
        Uses a shared ThreadPoolExecutor to avoid overhead.
        """
        max_retries = 2
        base_delay = 1.0
        
        for i in range(max_retries + 1):
            try:
                attempt_str = f"(Attempt {i+1})" if i > 0 else ""
                logger.info(f"📡  AkShare Fetch: {func.__name__} {attempt_str}")
                
                # Use shared executor for timeout enforcement
                future = self._executor.submit(func, *args, **kwargs)
                try:
                    return future.result(timeout=timeout)
                except TimeoutError:
                    logger.error(f"❌ AkShare TIMEOUT ({timeout}s) for {func.__name__}")
                    raise TimeoutError(f"AkShare function {func.__name__} timed out after {timeout}s")
                    
            except Exception as e:
                err_msg = str(e).lower()
                # Determine if it's a retryable network error
                is_retryable = any(x in err_msg for x in [
                    "timeout", "remote end closed", "connection aborted", 
                    "connection reset", "max retries", "connectionerror"
                ])
                
                if i < max_retries and is_retryable:
                    delay = base_delay * (2 ** i) + random.uniform(0, 0.5)
                    logger.warning(f"⚠️  Retryable Error in {func.__name__}: {type(e).__name__}. Retrying in {delay:.1f}s...")
                    time.sleep(delay)
                else:
                    logger.error(f"❌ Final Failure for {func.__name__}: {e}")
                    raise e

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
                return neutralized
            return cached

        logger.info("📡 Fetching Macro Data from AkShare...")
        try:
            # 1. GDP (Quarterly)
            gdp_val = "N/A"
            try:
                # macro_china_gdp returns current quarter
                df_gdp = self._safe_ak_fetch(ak.macro_china_gdp)
                if not df_gdp.empty:
                    # columns: 季度, 国内生产总值-绝对值, 国内生产总值-同比增长...
                    latest = df_gdp.iloc[0]
                    gdp_val = f"{latest['国内生产总值-同比增长']}% (Q{latest.get('季度', '')})"
            except Exception as e:
                logger.warning(f"Macro GDP fetch failed: {e}")

            # 2. CPI (Monthly)
            cpi_val = "N/A"
            try:
                df_cpi = self._safe_ak_fetch(ak.macro_china_cpi)
                if not df_cpi.empty:
                    # columns: 月份, 全国-同比增长...
                    latest = df_cpi.iloc[0]
                    cpi_val = f"{latest['全国-同比增长']}% ({latest['月份']})"
            except Exception as e:
                logger.warning(f"Macro CPI fetch failed: {e}")

            # 3. 10Y Bond Yield (Daily)
            bond_val = "N/A"
            try:
                # Using bond_zh_us_rate for CN 10Y
                df_bond = self._safe_ak_fetch(ak.bond_zh_us_rate)
                if not df_bond.empty:
                    # columns: 日期, 中国国债收益率2年, 中国国债收益率5年, 中国国债收益率10年...
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

            # 4. Global Context - Nasdaq (Daily)
            nasdaq_pct = "N/A"
            nasdaq_skipped = False
            if skip_nasdaq:
                logger.info("⏭️  Skipping Nasdaq fetch (skip_nasdaq=True, data would be stale)")
                nasdaq_skipped = True
            else:
                try:
                    # Using sina US stock index API
                    df_nasdaq = self._safe_ak_fetch(ak.index_us_stock_sina, symbol='.IXIC')
                    if not df_nasdaq.empty and len(df_nasdaq) >= 2:
                        last = float(df_nasdaq.iloc[-1]['close'])
                        prev = float(df_nasdaq.iloc[-2]['close'])
                        change = (last - prev) / prev * 100
                        nasdaq_pct = f"{change:+.2f}%"
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

        # 1. Northbound (Smart Money) - Breadth Signal
        # Since 2024-08-19, HKEX no longer discloses real-time northbound net buy amounts.
        # The '成交净买额' field permanently returns 0. However, the summary API still
        # provides northbound win/loss stock counts, which serve as a useful breadth signal.
        try:
            df_north = self._safe_ak_fetch(ak.stock_hsgt_fund_flow_summary_em)
            if not df_north.empty:
                north_rows = df_north[df_north['资金方向'] == '北向']
                if not north_rows.empty:
                    winners = int(north_rows['上涨数'].sum())
                    losers = int(north_rows['下跌数'].sum())
                    flat = int(north_rows['持平数'].sum())
                    total = winners + losers + flat
                    
                    if total > 0:
                        win_ratio = winners / total
                        if win_ratio >= 0.65:
                            sentiment = "偏多"
                        elif win_ratio <= 0.35:
                            sentiment = "偏空"
                        else:
                            sentiment = "均衡"
                        
                        north_val = f"涨{winners}/跌{losers} ({sentiment})"
                        north_breadth = {
                            "winners": winners,
                            "losers": losers,
                            "flat": flat,
                            "win_ratio": round(win_ratio, 3),
                            "sentiment": sentiment
                        }
                        logger.info(f"✅ Northbound breadth: {north_val}")
                    else:
                        logger.info("ℹ️  Northbound data has zero stocks (market may be closed)")
        except Exception as e:
            logger.warning(f"Northbound fetch issue: {e}")

        # 2. Sector Flows - 3-Tier Fallback Strategy
        # Primary:   Eastmoney stock_sector_fund_flow_rank (fast, reliable, 498 sectors, units: 元)
        # Fallback1: THS stock_fund_flow_industry (90 sectors, units: 亿, scraping can fail)
        # Fallback2: Broad market main force flow (coarse, last resort)
        
        sector_fetched = False
        
        # --- Tier 1: Eastmoney (Primary) ---
        try:
            df_em = self._safe_ak_fetch(
                ak.stock_sector_fund_flow_rank, indicator="今日", sector_type="行业资金流"
            )
            if not df_em.empty:
                net_col = '今日主力净流入-净额'
                name_col = '名称'
                if net_col in df_em.columns and name_col in df_em.columns:
                    df_em['net_val'] = pd.to_numeric(df_em[net_col], errors='coerce')
                    df_sorted = df_em.dropna(subset=['net_val']).sort_values('net_val', ascending=False)
                    
                    def fmt_em(row):
                        name = row.get(name_col, '')
                        net = row.get('net_val', 0) / 1e8  # 元 → 亿
                        return f"{name}({net:+.2f}亿)"
                    
                    for _, row in df_sorted.head(3).iterrows():
                        top_inflow.append(fmt_em(row))
                    for _, row in df_sorted.tail(2).iterrows():
                        top_outflow.append(fmt_em(row))
                    
                    sector_fetched = True
                    logger.info(f"✅ Eastmoney Sector Flow Succeeded: {len(df_sorted)} sectors, top={top_inflow[0] if top_inflow else 'N/A'}")
                else:
                    logger.warning(f"EM sector flow columns mismatch: {list(df_em.columns)}")
            else:
                raise ValueError("EM sector flow empty")
        except Exception as e:
            logger.warning(f"⚠️  Eastmoney Sector Flow failed, trying THS fallback: {e}")
        
        # --- Tier 2: THS Fallback ---
        if not sector_fetched:
            try:
                df_sector = self._safe_ak_fetch(ak.stock_fund_flow_industry, symbol="即时")
                if not df_sector.empty:
                    df_sector['net_val'] = pd.to_numeric(df_sector['净额'], errors='coerce')
                    df_sorted = df_sector.dropna(subset=['net_val']).sort_values('net_val', ascending=False)
                    
                    def fmt_ths(row):
                        name = row.get('行业', '')
                        net = row.get('net_val', 0)  # THS 净额 already in 亿
                        return f"{name}({net:+.2f}亿)"

                    for _, row in df_sorted.head(3).iterrows():
                        top_inflow.append(fmt_ths(row))
                    for _, row in df_sorted.tail(2).iterrows():
                        top_outflow.append(fmt_ths(row))
                    
                    sector_fetched = True
                    logger.info(f"✅ THS Industry Flow Fallback Succeeded: {len(df_sorted)} sectors")
                else:
                    raise ValueError("THS record empty")
            except Exception as e:
                logger.error(f"❌ THS Sector Flow also failed: {e}")
        
        # --- Tier 3: Broad Market (Last Resort) ---
        if not sector_fetched:
            try:
                df_m = self._safe_ak_fetch(ak.stock_market_fund_flow)
                if not df_m.empty:
                    m_flow = df_m.iloc[-1].get('主力净流入-净额', 0)
                    top_inflow.append(f"全市场主力({m_flow/1e8:+.1f}亿)")
                    logger.info("✅ Broad market flow (last resort) succeeded.")
            except Exception as fallback_e:
                logger.error(f"❌ All sector flow sources exhausted: {fallback_e}")

        result = {
            "northbound_net_inflow": north_val,
            "northbound_breadth": north_breadth,
            "top_inflow_sectors": ", ".join(top_inflow) if top_inflow else "暂无数据",
            "top_outflow_sectors": ", ".join(top_outflow) if top_outflow else "暂无数据",
            "summary": f"北向:{north_val} | 领涨:{', '.join(top_inflow[:2]) if top_inflow else 'N/A'} | 领跌:{', '.join(top_outflow[:1]) if top_outflow else 'N/A'}"
        }
        
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
            
            if len(symbol) == 5:
                # HK stock - this endpoint is A-share only; return stable fallback payload.
                result = {
                    "summary": "港股暂无资金流数据",
                    "big_order_inflow": "N/A",
                    "interpretation": "港股暂不支持主力资金流"
                }
                self._cache["stock_flow"][symbol] = {"data": result, "timestamp": datetime.now()}
                self._stats["stock_flow_success"] += 1
                return result

            df = ak.stock_individual_fund_flow(stock=symbol, market=market_code)
            
            flow_summary = "N/A"
            big_order_val = "N/A"
            
            if not df.empty:
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

