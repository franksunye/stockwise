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

    async def get_comprehensive_context(self, symbol: str, date_str: str, stock_name: str = None) -> Dict[str, Any]:
        """
        API: Get a rich, structured context for a specific stock on a specific date.
        Combines macro, meso, and micro facts.
        """
        # 1. Macro: Market Mood
        market_mood = self._get_cached_market_mood(date_str)
        
        # 2. Meso: Price Altitude (Positioning in cycles)
        altitude = self._calculate_altitude(symbol, date_str)
        
        # 3. Micro: Volume and Momentum
        volume_status = self._analyze_volume(symbol, date_str)
        
        # 4. Fundamental/Meta
        meta = {
            "symbol": symbol,
            "name": stock_name or symbol,
            "date": date_str
        }

        return {
            "meta": meta,
            "market_context": market_mood,
            "price_altitude": altitude,
            "volume_status": volume_status,
            "timestamp": datetime.now().isoformat()
        }

    def _get_cached_market_mood(self, date_str: str) -> str:
        """Fetch market mood with date-based caching."""
        cache_key = f"market_mood_{date_str}"
        if cache_key in self._global_cache:
            return self._global_cache[cache_key]
        
        mood = self._calculate_market_mood(date_str)
        self._global_cache[cache_key] = mood
        return mood

    def _calculate_market_mood(self, date_str: str) -> str:
        """
        Analyze market sentiment:
        1. Query Index Proxies (02800, sh000001, 510300).
        2. Calculate Market Breadth (Advancers vs Decliners).
        """
        MARKET_ANCHORS = ["02800", "sh000001", "510300"]
        symbol_map = {"02800": "恒生指数(ETF)", "sh000001": "上证指数", "510300": "沪深300"}
        
        conn = get_connection()
        try:
            cursor = conn.cursor()
            
            # Index performance
            anchor_placeholders = ','.join([f"'{a}'" for a in MARKET_ANCHORS])
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
            
            # Market Breadth
            cursor.execute("SELECT change_percent FROM daily_prices WHERE date = ?", (date_str,))
            rows = cursor.fetchall()
            
            if not rows or len(rows) < 5: 
                return proxy_msg if proxy_msg else "市场数据正在同步中。"
                
            changes = [r[0] for r in rows if r[0] is not None]
            up = sum(1 for c in changes if c > 0)
            down = len(changes) - up
            median_chg = np.median(changes)
            
            sample_size = len(changes)
            scope = "全市场" if sample_size > 1000 else "核心观察池"
            breadth = f"({scope}涨{up}/跌{down}，中位数{median_chg:+.2f}%)"
            
            return f"{proxy_msg}，{breadth}" if proxy_msg else f"{scope}情绪{breadth}"
            
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
        Gets AI predictions, yesterday's signals, and reflection meta in ONE query.
        """
        if not symbols: return {}
        
        conn = get_connection()
        try:
            cursor = conn.cursor()
            placeholders = ','.join(['?' for _ in symbols])
            
            sql = f"""
                SELECT 
                    p.symbol, p.signal, p.confidence, p.ai_reasoning, p.support_price, p.pressure_price, 
                    prev.signal as prev_signal, prev.validation_status as prev_status, prev.actual_change as prev_change
                FROM ai_predictions_v2 p
                LEFT JOIN ai_predictions_v2 prev ON p.symbol = prev.symbol 
                     AND prev.date = date(p.date, '-1 day') 
                     AND prev.is_primary = 1
                WHERE p.symbol IN ({placeholders}) AND p.date = ? AND p.is_primary = 1
            """
            cursor.execute(sql, (*symbols, date_str))
            
            results = {}
            for row in cursor.fetchall():
                results[row[0]] = {
                    'signal': row[1], 'confidence': row[2], 'reasoning': row[3],
                    'support': row[4], 'pressure': row[5],
                    'reflection': {
                        'prev_signal': row[6], 'prev_status': row[7], 'prev_change': row[8],
                    }
                }
            return results
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
                SELECT symbol, close, change_percent, rsi, macd
                FROM daily_prices
                WHERE symbol IN ({placeholders})
                AND date = (SELECT MAX(date) FROM daily_prices WHERE symbol = daily_prices.symbol)
            """
            cursor.execute(sql, symbols)
            return {row[0]: {'close': row[1], 'change': row[2], 'rsi': row[3], 'macd': row[4]} for row in cursor.fetchall()}
        finally:
            conn.close()
