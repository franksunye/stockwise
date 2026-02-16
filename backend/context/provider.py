
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

    def get_macro_context(self) -> Dict[str, Any]:
        """
        Fetch core macro indicators.
        Cache TTL: 24 hours (Macro data changes slowly)
        """
        # (This is sync usually but being called async in integration? No it's sync. Provider is sync.)
        self._stats["macro_attempts"] += 1
        
        if self._is_cache_valid(self._cache["macro"], 86400):
            return self._cache["macro"]["data"]

        logger.info("📡 Fetching Macro Data from AkShare...")
        try:
            # 1. GDP (Quarterly)
            gdp_val = "N/A"
            try:
                # macro_china_gdp returns current quarter
                df_gdp = ak.macro_china_gdp()
                if not df_gdp.empty:
                    # columns: 季度, 国内生产总值-绝对值, 国内生产总值-同比增长...
                    latest = df_gdp.iloc[0]
                    gdp_val = f"{latest['国内生产总值-同比增长']}% (Q{latest.get('季度', '')})"
            except Exception as e:
                logger.warning(f"Macro GDP fetch failed: {e}")

            # 2. CPI (Monthly)
            cpi_val = "N/A"
            try:
                df_cpi = ak.macro_china_cpi()
                if not df_cpi.empty:
                    # columns: 月份, 全国-同比增长...
                    latest = df_cpi.iloc[0]
                    cpi_val = f"{latest['全国-同比增长']}% ({latest['月份']})"
            except Exception as e:
                logger.warning(f"Macro CPI fetch failed: {e}")

            # 3. 10Y Bond Yield (Daily)
            bond_val = "N/A"
            try:
                # bond_zh_us_rate or similar
                # Using bond_zh_us_rate for CN 10Y
                df_bond = ak.bond_zh_us_rate()
                if not df_bond.empty:
                    # columns: 日期, 中国国债收益率2年, 中国国债收益率5年, 中国国债收益率10年...
                    latest = df_bond.iloc[0]
                    val = latest['中国国债收益率10年']
                    if pd.notna(val):
                        bond_val = f"{val}%"
                    else:
                         # Try previous day
                         if len(df_bond) > 1:
                             val_prev = df_bond.iloc[1]['中国国债收益率10年']
                             if pd.notna(val_prev):
                                 bond_val = f"{val_prev}%"
            except Exception as e:
                logger.warning(f"Macro Bond fetch failed: {e}")

            result = {
                "gdp": gdp_val,
                "cpi": cpi_val,
                "bond_10y": bond_val,
                "summary": f"GDP:{gdp_val} | CPI:{cpi_val} | Bond10Y:{bond_val}"
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
                df_north = ak.stock_hsgt_hist_em(symbol="北向资金")
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
                
            # 2. Sector Flows (Focus: Capital Inflow)
            top_sectors = []
            try:
                # stock_sector_fund_flow_rank: indicator="今日", sector_type="行业资金流"
                df_sector = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="行业资金流")
                if not df_sector.empty:
                    # columns: 排名, 名称, 今日主力净流入...
                    # Sort by inflow desc
                    # Actually standard response is sorted by rank
                    top3 = df_sector.head(3)
                    for _, row in top3.iterrows():
                        name = row.get('名称', '')
                        flow = row.get('今日主力净流入', '') # formatted string with unit
                        top_sectors.append(f"{name}({flow})")
            except Exception as e:
                logger.warning(f"Sector flow fetch failed: {e}")

            result = {
                "northbound_net_inflow": north_val,
                "top_inflow_sectors": ", ".join(top_sectors) if top_sectors else "暂无数据",
                "summary": f"北向:{north_val} | 领涨板块:{', '.join(top_sectors) if top_sectors else 'N/A'}"
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
                    try:
                        v = float(val)
                        if abs(v) > 100000000: return f"{v/100000000:+.2f}亿"
                        if abs(v) > 10000: return f"{v/10000:+.2f}万"
                        return f"{v:+.0f}"
                    except: return str(val)

                big_order_val = fmt_flow(main_net)
                
                # Semantic interpretation
                try:
                    net_float = float(main_net)
                    if net_float > 0: flow_summary = "主力净流入 (吸筹)"
                    elif net_float < 0: flow_summary = "主力净流出 (出货)"
                    else: flow_summary = "资金平衡"
                except:
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

