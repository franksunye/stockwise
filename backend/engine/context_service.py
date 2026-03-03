"""
World-Class Context Service (Knowledge Fact Layer)
Provides high-quality, synthesized data facts for AI consumers.
Standardizes how AI 'sees' the market and individual stocks.
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import threading

try:
    from backend.logger import logger
    from backend.database import get_connection
except ImportError:
    from logger import logger
    from database import get_connection

# Global Market Anchors for mood calculation
MARKET_ANCHORS = {
    "HK": ["02800"],
    "CN": ["sh000001", "sh000300", "510300"]
}
MARKET_SYMBOL_MAP = {
    "02800": "恒生指数(ETF)", 
    "sh000001": "上证指数", 
    "sh000300": "沪深300",
    "510300": "沪深300ETF"
}

class ContextService:
    _instance = None
    _lock = threading.Lock()
    
    # Simple In-Memory Cache for global market data (invalidated by date)
    _global_cache = {}

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ContextService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        # Prevent re-initialization if using singleton
        if hasattr(self, '_initialized'): return
        self._initialized = True
        
        # Initialize Context Provider for external data (AkShare)
        from backend.context.provider import MarketContextProvider
        self.provider = MarketContextProvider()

    async def get_comprehensive_context(self, symbol: str, date_str: str, stock_name: str = None) -> Dict[str, Any]:
        """
        API: Get a rich, structured context for a specific stock on a specific date.
        Combines macro, meso, and micro facts.
        """
        # Fallback to batch-of-one
        results = await self.get_batch_comprehensive_context([symbol], date_str, {symbol: stock_name or symbol})
        return results.get(symbol, {})

    async def get_batch_comprehensive_context(self, symbols: List[str], date_str: str, name_map: Dict[str, str] = None) -> Dict[str, Dict]:
        """
        High-Performance Batch Context Fetching:
        Calculates altitude, volume and market mood for multiple symbols in optimized queries.
        Augmented with Macro and Money Flow data.
        """
        if not symbols: return {}
        name_map = name_map or {}
        
        # 1. Macro & Market Flow (Fetched once per batch)
        # Note: These operations might take time if not cached, so we do them serially for now.
        # Ideally, we should async these, but AkShare is sync requests.
        try:
            macro_ctx = self.provider.get_macro_context()
            market_flow_ctx = self.provider.get_market_flow_context()
        except Exception as e:
            logger.error(f"Context Provider Error: {e}")
            macro_ctx = {"summary": "数据暂缺"}
            market_flow_ctx = {"summary": "数据暂缺"}

        # 2. Market Mood (Cached by market within the call)
        # We need to know which market each symbol belongs to
        markets = set()
        for s in symbols:
            markets.add("HK" if len(s) == 5 else "CN")
        
        moods = {m: self._get_cached_market_mood(date_str, "02800" if m == "HK" else "sh000001") for m in markets}
        
        # 3. Meso & Micro: Altitude and Volume (The heavy lifting)
        # Use optimized SQL to calculate stats for all symbols
        conn = get_connection()
        try:
            cursor = conn.cursor()
            placeholders = ','.join(['?' for _ in symbols])
            
            # This query calculates:
            # - Current price (rn=1)
            # - Max/Min over different windows (20, 60, 250)
            # - Current vs Avg Volume
            sql = f"""
                WITH RankedPrices AS (
                    SELECT 
                        symbol, date, close, volume,
                        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) as rn
                    FROM daily_prices
                    WHERE symbol IN ({placeholders}) AND date <= ?
                )
                SELECT 
                    symbol,
                    MAX(CASE WHEN rn = 1 THEN close END) as curr_price,
                    MAX(CASE WHEN rn = 1 THEN volume END) as curr_vol,
                    -- Altitude ranges
                    MAX(CASE WHEN rn <= 20 THEN close END) as hi_20,
                    MIN(CASE WHEN rn <= 20 THEN close END) as lo_20,
                    MAX(CASE WHEN rn <= 60 THEN close END) as hi_60,
                    MIN(CASE WHEN rn <= 60 THEN close END) as lo_60,
                    MAX(CASE WHEN rn <= 250 THEN close END) as hi_250,
                    MIN(CASE WHEN rn <= 250 THEN close END) as lo_250,
                    -- Volume avg (2-6)
                    AVG(CASE WHEN rn BETWEEN 2 AND 6 THEN volume END) as avg_vol_prev
                FROM RankedPrices
                WHERE rn <= 250
                GROUP BY symbol
            """
            cursor.execute(sql, (*symbols, date_str))
            rows = cursor.fetchall()
            
            batch_results = {}
            for row in rows:
                sym, curr_p, curr_v, hi20, lo20, hi60, lo60, hi250, lo250, avg_v = row
                
                # Fetch Stock specific flow (Individual Big Orders)
                # This might be slow if batch is large. 
                # For small batches (daily prediction usually runs in chunks), it is acceptable.
                stock_flow_ctx = self.provider.get_stock_flow_context(sym)

                # helper to determine zone
                def get_zone(p, hi, lo):
                    if not hi or not lo or hi == lo: return "横盘"
                    pct = (p - lo) / (hi - lo) * 100
                    zone = "历史高位" if pct > 85 else ("风险位" if pct > 70 else ("中位" if pct > 40 else ("机会位" if pct > 15 else "底部强支撑")))
                    return f"{zone} ({pct:.0f}%)"
                
                # helper for volume
                vol_status = "量能平稳"
                if curr_v and avg_v and avg_v > 0:
                    ratio = curr_v / avg_v
                    if ratio > 2.2: vol_status = f"异常放量 (量比 {ratio:.1f}x)"
                    elif ratio > 1.5: vol_status = f"温和放量 (量比 {ratio:.1f}x)"
                    elif ratio < 0.5: vol_status = f"极度缩量 (量比 {ratio:.1f}x)"
                
                m = "HK" if len(sym) == 5 else "CN"
                batch_results[sym] = {
                    "meta": {"symbol": sym, "name": name_map.get(sym, sym), "date": date_str},
                    "market_context": moods.get(m),
                    "macro_context": macro_ctx,         # Added
                    "market_flow_context": market_flow_ctx, # Added
                    "stock_flow_context": stock_flow_ctx,   # Added
                    "price_altitude": {
                        "short_term_20d": get_zone(curr_p, hi20, lo20) if hi20 else "数据不足",
                        "medium_term_60d": get_zone(curr_p, hi60, lo60) if hi60 else "数据不足",
                        "long_term_250d": get_zone(curr_p, hi250, lo250) if hi250 else "数据不足"
                    },
                    "volume_status": vol_status,
                    "timestamp": datetime.now().isoformat()
                }
            
            # Fill missing with empty context
            for sym in symbols:
                if sym not in batch_results:
                    m = "HK" if len(sym) == 5 else "CN"
                    batch_results[sym] = {
                        "meta": {"symbol": sym, "name": name_map.get(sym, sym), "date": date_str},
                        "market_context": moods.get(m),
                        "macro_context": macro_ctx,
                        "market_flow_context": market_flow_ctx,
                        "stock_flow_context": {"summary": "无数据"},
                        "price_altitude": {"info": "历史数据不足"},
                        "volume_status": "量能未知"
                    }
                    
            return batch_results
        except Exception as e:
            logger.error(f"❌ Batch Context Failed: {e}")
            return {}
        finally:
            conn.close()

    def _get_cached_market_mood(self, date_str: str, target_symbol: str = None) -> str:
        """Fetch market mood with date and market-based caching."""
        market = "CN"
        if target_symbol and len(target_symbol) == 5:
            market = "HK"
            
        cache_key = f"market_mood_{market}_{date_str}"
        if cache_key in self._global_cache:
            return self._global_cache[cache_key]
        
        mood = self._calculate_market_mood(date_str, market)
        self._global_cache[cache_key] = mood
        return mood

    def _calculate_market_mood(self, date_str: str, market: str = "CN") -> str:
        """
        Analyze market sentiment:
        1. Query Index Proxies (02800, sh000001, 510300).
        2. Calculate Market Breadth (Advancers vs Decliners).
        """
        symbol_map = MARKET_SYMBOL_MAP
        
        conn = get_connection()
        try:
            cursor = conn.cursor()
            
            # Index performance (Filtered by Market)
            market_anchors = MARKET_ANCHORS.get(market, [])
            anchor_placeholders = ','.join([f"'{a}'" for a in market_anchors])
            
            cursor.execute(f"""
                SELECT symbol, change_percent 
                FROM daily_prices 
                WHERE date = ? AND symbol IN ({anchor_placeholders})
            """, (date_str,))
            anchors = cursor.fetchall()
            
            proxy_parts = []
            for sym, chg in anchors:
                name = symbol_map.get(sym, sym)
                proxy_parts.append(f"{name} {'涨' if chg > 0 else '跌'} {abs(chg):.2f}%")
            proxy_msg = "，".join(proxy_parts)
            
            # Market Breadth (Filtered by Market)
            if market == "HK":
                # HK stocks have 5 digits
                cursor.execute("""
                    SELECT change_percent FROM daily_prices 
                    WHERE date = ? AND length(symbol) = 5
                """, (date_str,))
            else:
                # CN stocks have != 5 digits (usually 6)
                cursor.execute("""
                    SELECT change_percent FROM daily_prices 
                    WHERE date = ? AND length(symbol) != 5
                """, (date_str,))
            rows = cursor.fetchall()
            
            if not rows or len(rows) < 5: 
                return proxy_msg if proxy_msg else "市场数据正在同步中。"
                
            changes = [r[0] for r in rows if r[0] is not None]
            up = sum(1 for c in changes if c > 0)
            down = len(changes) - up
            median_chg = np.median(changes)
            
            sample_size = len(changes)
            scope = f"{market}市场" if sample_size > 500 else f"{market}核心池"
            breadth = f"({scope}涨{up}/跌{down}，中位数{median_chg:+.2f}%)"
            
            return f"{proxy_msg}，{breadth}" if proxy_msg else f"{market}情绪{breadth}"
            
        except Exception as e:
            logger.warning(f"⚠️ Market mood error: {e}")
            return "市场情绪数据暂时不可用。"
        finally:
            conn.close()

    def _calculate_altitude(self, symbol: str, date_str: str) -> Dict[str, str]:
        """
        Cycle Analysis: Where is the current price relative to historical range?
        Returns qualitative descriptions.
        """
        conn = get_connection()
        try:
            # Fetch last 250 trading days
            query = f"""
                SELECT close FROM daily_prices 
                WHERE symbol = '{symbol}' AND date <= '{date_str}'
                ORDER BY date DESC LIMIT 250
            """
            df = pd.read_sql(query, conn)
            
            if df.empty or len(df) < 10:
                return {"info": "历史数据不足以进行周期分析"}
            
            curr_price = df.iloc[0]['close']
            
            def analyze_range(days: int) -> str:
                subset = df.head(days)
                if len(subset) < days * 0.7: return "数据不足"
                hi, lo = subset['close'].max(), subset['close'].min()
                if hi == lo: return "横盘"
                pct = (curr_price - lo) / (hi - lo) * 100
                
                zone = "历史高位" if pct > 85 else ("风险位" if pct > 70 else ("中位" if pct > 40 else ("机会位" if pct > 15 else "底部强支撑")))
                return f"{zone} ({pct:.0f}%)"

            return {
                "short_term_20d": analyze_range(20),
                "medium_term_60d": analyze_range(60),
                "long_term_250d": analyze_range(250)
            }
        except Exception as e:
            logger.error(f"⚠️ Altitude failed for {symbol}: {e}")
            return {}
        finally:
            conn.close()

    def _analyze_volume(self, symbol: str, date_str: str) -> str:
        """Volume behavior analysis."""
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(f"SELECT volume FROM daily_prices WHERE symbol=? AND date<=? ORDER BY date DESC LIMIT 6", (symbol, date_str))
            vols = [r[0] for r in cursor.fetchall() if r[0]]
            if len(vols) < 2: return "量能平稳"
            
            ratio = vols[0] / (sum(vols[1:]) / len(vols[1:]))
            if ratio > 2.2: return f"异常放量 (量比 {ratio:.1f}x)"
            if ratio > 1.5: return f"温和放量 (量比 {ratio:.1f}x)"
            if ratio < 0.5: return f"极度缩量 (量比 {ratio:.1f}x)"
            return "量能平稳"
        except: return "量能未知"
        finally: conn.close()

    async def get_batch_predictions_and_reflection(self, symbols: List[str], date_str: str) -> Dict[str, Dict]:
        """
        World-Class Batch Fetching:
        Gets AI predictions and a history of previous signals for reflection.
        """
        if not symbols: return {}
        
        conn = get_connection()
        try:
            cursor = conn.cursor()
            placeholders = ','.join(['?' for _ in symbols])
            
            # 1. Fetch current primary predictions
            sql_curr = f"""
                SELECT symbol, signal, confidence, ai_reasoning, support_price, pressure_price
                FROM ai_predictions_v2 
                WHERE symbol IN ({placeholders}) AND date = ? AND is_primary = 1
            """
            cursor.execute(sql_curr, (*symbols, date_str))
            
            curr_results = {}
            for row in cursor.fetchall():
                curr_results[row[0]] = {
                    'signal': row[1], 'confidence': row[2], 'reasoning': row[3],
                    'support': row[4], 'pressure': row[5]
                }
            
            # 2. Fetch history (Last 3 predictions before date_str)
            sql_hist = f"""
                SELECT symbol, date, signal, validation_status, actual_change, confidence, support_price, pressure_price, model_id
                FROM (
                    SELECT 
                        symbol, date, signal, validation_status, actual_change, confidence, support_price, pressure_price, model_id,
                        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) as rn
                    FROM ai_predictions_v2
                    WHERE symbol IN ({placeholders}) AND date < ? AND is_primary = 1
                )
                WHERE rn <= 3
                ORDER BY symbol, date DESC
            """
            cursor.execute(sql_hist, (*symbols, date_str))
            
            hist_by_symbol = {}
            for row in cursor.fetchall():
                sym = row[0]
                if sym not in hist_by_symbol: hist_by_symbol[sym] = []
                hist_by_symbol[sym].append({
                    'date': row[1],
                    'signal': row[2],
                    'status': row[3],
                    'change': row[4],
                    'confidence': row[5],
                    'support': row[6],
                    'pressure': row[7],
                    'model_id': row[8]
                })
            
            # 3. Assemble combined results
            final_results = {}
            for sym in symbols:
                p = curr_results.get(sym, {})
                h = hist_by_symbol.get(sym, [])
                
                reflection = {}
                if h:
                    latest_h = h[0]
                    reflection = {
                        'prev_signal': latest_h['signal'],
                        'prev_status': latest_h['status'],
                        'prev_change': latest_h['change'],
                        'history': h 
                    }
                
                final_results[sym] = {
                    **p,
                    'reflection': reflection
                }
                
            return final_results
        finally:
            conn.close()

    async def get_batch_technical_facts(self, symbols: List[str]) -> Dict[str, Dict]:
        """Fetch latest technical facts for multiple symbols."""
        if not symbols: return {}
        
        conn = get_connection()
        try:
            cursor = conn.cursor()
            placeholders = ','.join(['?' for _ in symbols])
            
            sql = f"""
                SELECT symbol, close, change_percent, rsi, macd, high, low
                FROM daily_prices
                WHERE symbol IN ({placeholders})
                AND date = (SELECT MAX(date) FROM daily_prices WHERE symbol = daily_prices.symbol)
            """
            cursor.execute(sql, symbols)
            return {
                row[0]: {
                    'close': row[1], 'change': row[2], 'rsi': row[3], 
                    'macd': row[4], 'high': row[5], 'low': row[6]
                } for row in cursor.fetchall()
            }
        finally:
            conn.close()
