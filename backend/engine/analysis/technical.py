from typing import Dict, Any, List, Optional
import math

class TechnicalAnalyzer:
    """
    The 'Quant' component of the Hybrid Architecture.
    Responsible for calculating indisputable mathematical facts from raw price data.
    """
    
    @staticmethod
    def analyze(daily_prices: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not daily_prices:
            return {}

        latest = daily_prices[-1]
        prev = daily_prices[-2] if len(daily_prices) > 1 else latest
        
        close = latest.get('close', 0)
        ma20 = latest.get('ma20', 0)
        
        # --- 1. Momentum Analysis (MACD & RSI) ---
        macd = latest.get('macd', 0) or 0
        macd_signal = latest.get('macd_signal', 0) or 0
        rsi = latest.get('rsi', 0) or 50
        
        # MACD Status
        if macd > macd_signal:
            macd_status = "金叉 (Bullish)"
            macd_desc = "DIF > DEA"
        else:
            macd_status = "死叉 (Bearish)" 
            macd_desc = "DIF < DEA"
            
        # RSI Status
        if rsi > 70:
            rsi_status = "超买 (Overbought)"
        elif rsi < 30:
            rsi_status = "超卖 (Oversold)"
        else:
            rsi_status = "中性 (Neutral)"

        # --- 2. Trend Analysis (MA20) ---
        # Compare current close vs MA20
        if close > ma20:
            trend_status = "多头 (Bullish)"
            trend_desc = "Price > MA20"
        else:
            trend_status = "空头 (Bearish)"
            trend_desc = "Price < MA20"
            
        # --- 3. Level Analysis (Bollinger) ---
        boll_upper = latest.get('boll_upper', 0)
        boll_lower = latest.get('boll_lower', 0)
        
        if boll_upper > 0 and close >= boll_upper * 0.99:
            level_status = "触及上轨 (Resistance Test)"
        elif boll_lower > 0 and close <= boll_lower * 1.01:
            level_status = "触及下轨 (Support Test)"
        else:
            level_status = "通道内运行 (In Range)"

        return {
            "momentum": {
                "macd": {"status": macd_status, "desc": macd_desc, "dif": macd, "dea": macd_signal},
                "rsi": {"status": rsi_status, "value": rsi}
            },
            "trend": {
                "ma20": {"status": trend_status, "desc": trend_desc, "value": ma20}
            },
            "level": {
                "bollinger": {"status": level_status, "upper": boll_upper, "lower": boll_lower}
            },
            "price": {
                "close": close
            }
        }

    @staticmethod
    def generate_fact_sheet(metrics: Dict[str, Any]) -> str:
        """
        Generates the string block to be injected into the Prompt.
        """
        if not metrics:
            return ""
            
        m = metrics.get('momentum', {})
        t = metrics.get('trend', {})
        l = metrics.get('level', {})
        p = metrics.get('price', {})
        
        return f"""
## 关键技术指标事实 (硬性数学结论，严禁修改)
1. **MACD动能**: {m.get('macd', {}).get('status')} [{m.get('macd', {}).get('desc')}] -> (DIF={m.get('macd', {}).get('dif'):.3f})
2. **RSI状态**: {m.get('rsi', {}).get('status')} -> (Value={m.get('rsi', {}).get('value'):.1f})
3. **趋势状态**: {t.get('ma20', {}).get('status')} [{t.get('ma20', {}).get('desc')}] -> (Close={p.get('close')} vs MA20={t.get('ma20', {}).get('value'):.2f})
4. **布林位置**: {l.get('bollinger', {}).get('status')}
"""
