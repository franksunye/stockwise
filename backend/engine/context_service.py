"""
Context Service (Data Fact Layer)
负责计算和提供“硬事实”数据，解耦预测链与简报生成器。
核心能力：
1. 市场情绪 (Macro): 基于全市场(或观察池)当日涨跌分布计算。
2. 时空坐标 (Meso): 计算个股在不同周期(周/月/年)的价格百分位(Altitude)。
3. 量能分析 (Micro): 简单的量比计算。
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from logger import logger
from database import get_connection

# 关键指数代理 (Index Proxies) - 优先读取这些作为市场风向标
# 02800: 盈富基金 (港股恒指代理)
# sh000001: 上证指数
# 510300: 沪深300ETF
MARKET_ANCHORS = ["02800", "sh000001"]

class ContextService:
    def __init__(self):
        pass

    def get_context_facts(self, symbol: str, date_str: str) -> Dict[str, Any]:
        """
        获取指定股票在指定日期的全方位上下文事实。
        """
        facts = {
            "market_mood": self._calculate_market_mood(date_str),
            "altitude": self._calculate_altitude(symbol, date_str),
            "volume_status": self._analyze_volume(symbol, date_str)
        }
        return facts

    def _calculate_market_mood(self, date_str: str) -> str:
        """
        计算市场情绪：
        1. 优先查询关键指数 (Market Anchors) 的表现。
        2. 降级方案：统计当日数据库中所有股票的涨跌情况。
        """
        conn = get_connection()
        try:
            cursor = conn.cursor()
            
            # 1. Try to find Index Proxies first
            anchor_placeholders = ','.join([f"'{a}'" for a in MARKET_ANCHORS])
            cursor.execute(f"""
                SELECT symbol, change_percent 
                FROM daily_prices 
                WHERE date = ? AND symbol IN ({anchor_placeholders})
            """, (date_str,))
            anchors = cursor.fetchall()
            
            proxy_msg = ""
            if anchors:
                # Use the first available anchor as the primary mood
                # Ideally map symbols to names (e.g. 02800 -> 恒指)
                symbol_map = {"02800": "恒生指数(ETF)", "sh000001": "上证指数", "510300": "沪深300"}
                
                parts = []
                for sym, chg in anchors:
                    name = symbol_map.get(sym, sym)
                    parts.append(f"{name} {'涨' if chg > 0 else '跌'} {abs(chg):.2f}%")
                proxy_msg = "，".join(parts)
            
            # 2. Calculate Market Breadth (Ups/Downs) regardless of anchor
            cursor.execute("SELECT change_percent FROM daily_prices WHERE date = ?", (date_str,))
            rows = cursor.fetchall()
            
            if not rows or len(rows) < 3: 
                return proxy_msg if proxy_msg else ""
                
            changes = [r[0] for r in rows if r[0] is not None]
            if not changes: return proxy_msg
            
            up = sum(1 for c in changes if c > 0)
            down = sum(1 for c in changes if c < 0)
            median_change = np.median(changes)
            
            breadth_msg = f"(全市场涨{up}/跌{down}，中位数{median_change:+.2f}%)"
            
            if proxy_msg:
                return f"{proxy_msg}，{breadth_msg}"
            
            # Fallback if no proxy found
            sentiment = "中性"
            if median_change > 1.0: sentiment = "极度乐观"
            elif median_change > 0.3: sentiment = "温和上涨"
            elif median_change < -1.0: sentiment = "恐慌杀跌"
            elif median_change < -0.3: sentiment = "弱势回调"
            
            return f"市场情绪{sentiment} {breadth_msg}"
            
        except Exception as e:
            logger.warning(f"⚠️ Market mood calc failed: {e}")
            return ""
        finally:
            conn.close()

    def _calculate_altitude(self, symbol: str, date_str: str) -> Dict[str, str]:
        """
        计算时空海拔：当前价格处于过去 N 天的什么位置 (0% - 100%)。
        """
        conn = get_connection()
        try:
            # 获取过去 250 天 (约1年) 的收盘价
            df = pd.read_sql(f"""
                SELECT date, close 
                FROM daily_prices 
                WHERE symbol = '{symbol}' AND date <= '{date_str}'
                ORDER BY date DESC LIMIT 250
            """, conn)
            
            if df.empty or len(df) < 20:
                return {}
            
            current_close = df.iloc[0]['close']
            
            # Helper to calc percentile
            def get_position(days: int) -> str:
                if len(df) < days: return "数据不足"
                subset = df.head(days)
                high = subset['close'].max()
                low = subset['close'].min()
                if high == low: return "50% (横盘)"
                pos = (current_close - low) / (high - low) * 100
                
                desc = "底部"
                if pos > 80: desc = "顶部"
                elif pos > 60: desc = "高位"
                elif pos > 40: desc = "中位"
                elif pos > 20: desc = "低位"
                
                return f"{desc}区域 ({pos:.0f}%)"

            return {
                "month_stats": f"近20日处于{get_position(20)}",
                "quarter_stats": f"近60日处于{get_position(60)}",
                "year_stats": f"近250日处于{get_position(250)}"
            }
            
        except Exception as e:
            logger.warning(f"⚠️ Altitude calc failed for {symbol}: {e}")
            return {}
        finally:
            conn.close()

    def _analyze_volume(self, symbol: str, date_str: str) -> str:
        """
        量能分析：对比当日成交量与 5日均量。
        """
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT volume FROM daily_prices 
                WHERE symbol = ? AND date <= ?
                ORDER BY date DESC LIMIT 6
            """, (symbol, date_str))
            vols = [r[0] for r in cursor.fetchall()]
            
            if len(vols) < 2: return ""
            
            curr_vol = vols[0]
            avg_vol_5 = sum(vols[1:]) / len(vols[1:]) if vols[1:] else curr_vol
            
            if avg_vol_5 == 0: return ""
            
            ratio = curr_vol / avg_vol_5
            if ratio > 2.0: return f"放量 (量比 {ratio:.1f})"
            if ratio < 0.6: return f"缩量 (量比 {ratio:.1f})"
            return "平量"
            
        except Exception as e:
            return ""
        finally:
            conn.close()
