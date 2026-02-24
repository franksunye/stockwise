
"""
Market Context Provider
Integration with AkShare for Macro and Capital Flow Data.
"""
import akshare as ak
import pandas as pd
from typing import Dict, Any, Optional
from datetime import datetime
import threading
from backend.logger import logger
try:
    import backend.config # Ensure NO_PROXY and other environment fixes are applied
except ImportError:
    pass

class MarketContextProvider:
    _instance = None
    _lock = threading.Lock()
    
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

    def _safe_ak_fetch(self, func, *args, **kwargs):
        """
        Executes an AkShare function with a retry mechanism that handles 
        ProxyErrors/SSLErrors by attempting a direct connection.
        """
        import os
        import time
        from requests.exceptions import ProxyError, ConnectionError, SSLError
        
        max_retries = 2
        for i in range(max_retries + 1):
            try:
                # First attempt: use standard akshare call (respects env proxies)
                return func(*args, **kwargs)
            except (ProxyError, ConnectionError, SSLError, Exception) as e:
                if i < max_retries:
                    err_msg = str(e).lower()
                    is_network_issue = any(x in err_msg for x in ["proxy", "ssleof", "remote end closed", "connection aborted", "max retries"])
                    
                    if is_network_issue:
                        logger.warning(f"⚠️  AkShare Connection Issue (Attempt {i+1}): {e}. Retrying with direct connection bypass...")
                        
                        # Temporarily clear proxies for this retry
                        old_http = os.environ.get("HTTP_PROXY")
                        old_https = os.environ.get("HTTPS_PROXY")
                        os.environ.pop("HTTP_PROXY", None)
                        os.environ.pop("HTTPS_PROXY", None)
                        
                        try:
                            # Small delay
                            time.sleep(0.5)
                            return func(*args, **kwargs)
                        except Exception as retry_err:
                            logger.error(f"❌ Direct bypass failed: {retry_err}")
                            if i == max_retries - 1: raise retry_err
                        finally:
                            # Restore proxies 
                            if old_http: os.environ["HTTP_PROXY"] = old_http
                            if old_https: os.environ["HTTPS_PROXY"] = old_https
                    else:
                        time.sleep(1)
                        continue
                else:
                    raise e

    def get_macro_context(self) -> Dict[str, Any]:
        """
        Fetch core macro indicators.
        Cache TTL: 24 hours (Macro data changes slowly)
        """
        # (This is sync usually but being called async in integration? No it's sync. Provider is sync.)
        self._stats["macro_attempts"] += 1
        
        # [DEBUG] Force clear cache if nasdaq is missing to ensure it gets updated in the first run
        if self._cache["macro"]["data"] and "nasdaq" not in self._cache["macro"]["data"]:
            self._cache["macro"]["data"] = None

        if self._is_cache_valid(self._cache["macro"], 86400):
            return self._cache["macro"]["data"]

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
        Cache TTL: 1 hour (Intraday changes)
        """
        self._stats["market_flow_attempts"] += 1
        
        if self._is_cache_valid(self._cache["market_flow"], 3600):
            return self._cache["market_flow"]["data"]

        logger.info("📡 Fetching Market Flow Data from AkShare...")
        try:
            # 1. Northbound (Smart Money)
            north_val = "N/A"
            try:
                df_north = self._safe_ak_fetch(ak.stock_hsgt_hist_em, symbol="北向资金")
                if not df_north.empty:
                    # columns: 日期, 当日成交净买额, ...
                    latest = df_north.iloc[-1]
                    val = latest['当日成交净买额']
                    if pd.notna(val):
                        try:
                            val_float = float(val)
                            # Check for NaN again just in case
                            if val_float != val_float: # Is NaN
                                north_val = "N/A"
                            elif abs(val_float) > 10000: 
                                 # Unit usually RMB Yuan. 10亿 = 1,000,000,000
                                 val_b = val_float / 100000000
                                 north_val = f"{val_b:+.2f}亿"
                            else:
                                 north_val = f"{val_float:+.2f}"
                        except:
                            north_val = str(val)
            except Exception as e:
                logger.warning(f"Northbound fetch failed: {e}")
                
            # 2. Sector Flows (Inflow & Outflow)
            top_inflow = []
            top_outflow = []
            try:
                df_sector = self._safe_ak_fetch(ak.stock_sector_fund_flow_rank, indicator="今日", sector_type="行业资金流")
                if not df_sector.empty:
                    # Sector flow rank returns sorted by net inflow (usually)
                    
                    def fmt_row(row):
                        name = row.get('名称', '')
                        flow = None
                        for field in ['今日主力净流入-净额', '今日主力净流入', '今日主力净流入-净额量', '净流入']:
                            val = row.get(field)
                            if val is not None and str(val).lower() != 'nan':
                                flow = val
                                break
                        if flow is not None and not isinstance(flow, str):
                            try:
                                v = float(flow)
                                if abs(v) > 100000000: flow = f'{v/100000000:+.2f}亿'
                                elif abs(v) > 10000: flow = f'{v/10000:+.1f}万'
                                else: flow = f'{v:+.0f}'
                            except: flow = str(flow)
                        return f"{name}({flow})" if flow else name

                    # Top 3 Inflow
                    for _, row in df_sector.head(3).iterrows():
                        top_inflow.append(fmt_row(row))
                    
                    # Top 2 Outflow (Last rows)
                    for _, row in df_sector.tail(2).iterrows():
                        top_outflow.append(fmt_row(row))
                else:
                    # Try raw fallback if AkShare returns empty but didn't throw
                    raise ValueError("AkShare returned empty sector data")
            except Exception as e:
                logger.warning(f"Sector flow fetch failed (Attempt 1): {e}. Trying raw direct fetch...")
                try:
                    # Final High-Quality Fallback: Manual direct fetch bypassing everything
                    import requests
                    import json
                    url = "http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=50&po=1&np=1&ut=b2884a393a59ad64002292a3e90d46a5&fltt=2&invt=2&fid0=f62&fs=m%3A90+t%3A2&stat=1&fields=f12%2Cf14%2Cf62&rt=52975239"
                    
                    # Force a clean session with no proxies
                    session = requests.Session()
                    session.trust_env = False 
                    
                    r = session.get(url, timeout=10, proxies={'http': None, 'https': None}, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Referer": "https://quote.eastmoney.com/"
                    })
                    
                    if r.status_code == 200:
                        data = r.json()
                        diff = data.get('data', {}).get('diff', [])
                        if diff:
                            # Sort by f62 (Capital Flow)
                            sorted_diff = sorted(diff, key=lambda x: x.get('f62', 0) if x.get('f62') else 0, reverse=True)
                            
                            def fmt_item(item):
                                name = item.get('f14', '未知')
                                f = item.get('f62', 0)
                                if abs(f) > 100000000: flow = f'{f/100000000:+.2f}亿'
                                elif abs(f) > 10000: flow = f'{f/10000:+.1f}万'
                                else: flow = f'{f:+.0f}'
                                return f"{name}({flow})"

                            for item in sorted_diff[:3]:
                                top_inflow.append(fmt_item(item))
                            for item in sorted_diff[-2:]:
                                top_outflow.append(fmt_item(item))
                            logger.info(f"✅ Raw Direct Fetch Succeeded: {len(top_inflow)} inflows found.")
                except Exception as raw_e:
                    logger.error(f"❌ All sector flow attempts failed: {raw_e}")

            result = {
                "northbound_net_inflow": north_val,
                "top_inflow_sectors": ", ".join(top_inflow) if top_inflow else "暂无数据",
                "top_outflow_sectors": ", ".join(top_outflow) if top_outflow else "暂无数据",
                "summary": f"北向:{north_val} | 领涨:{', '.join(top_inflow[:2]) if top_inflow else 'N/A'} | 领跌:{', '.join(top_outflow[:1]) if top_outflow else 'N/A'}"
            }
            
            self._cache["market_flow"] = {"data": result, "timestamp": datetime.now()}
            self._stats["market_flow_success"] += 1
            return result
        except Exception as e:
            logger.error(f"❌ Market Flow Context Failed: {e}")
            return {"summary": "Market flow unavailable"}

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

