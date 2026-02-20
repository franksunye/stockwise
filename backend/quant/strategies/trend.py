from typing import Dict, Any
import pandas as pd
from .base import BaseStrategy
from ..types import QuantSignal

class TrendStrategy(BaseStrategy):
    """
    Standard Trend Following Strategy
    Replicates the logic from backend/engine/ai_service.py:_generate_rule_based_prediction
    """
    
    def analyze(self, symbol: str, data_context: Dict[str, Any]) -> QuantSignal:
        daily = data_context.get('daily_row')
        if daily is None:
            return QuantSignal(symbol, "Side", 0.0, {}, "缺少日线数据")

        close = daily.get('close', 0)
        ma20 = daily.get('ma20', 0)
        rsi = daily.get('rsi', 50)
        macd_hist = daily.get('macd_hist', 0)
        
        # --- Multi-timeframe Trend ---
        monthly_row = data_context.get('monthly_row')
        weekly_row = data_context.get('weekly_row')
        
        # Monthly Trend
        monthly_trend = "多" # Bull
        if monthly_row is not None:
            if monthly_row.get('close', 0) <= monthly_row.get('ma20', 0):
                monthly_trend = "空" # Bear
        
        # Weekly Trend
        weekly_trend = "多" # Bull
        if weekly_row is not None:
             if weekly_row.get('close', 0) <= weekly_row.get('ma20', 0):
                weekly_trend = "空" # Bear

        # --- Base Signal Logic ---
        support_price = ma20 if ma20 > 0 else (close * 0.95)
        
        signal = 'Side'
        reason = "中性"
        
        if close < support_price * 0.98:
            signal = 'Short'
            reason = "价格跌破均线支撑"
        elif close > ma20:
            signal = 'Long'
            reason = "价格站上 MA20 均线"
        
        # Filter: RSI Choppiness
        if 45 <= rsi <= 55 and signal != 'Short':
            signal = 'Side'
            reason = "RSI 处于震荡区间 (45-55)"

        # --- Resonance & Confidence ---
        resonance_count = 0
        if signal == 'Long':
            if monthly_trend == "多": resonance_count += 1
            if weekly_trend == "多": resonance_count += 1
        elif signal == 'Short':
            if monthly_trend == "空": resonance_count += 1
            if weekly_trend == "空": resonance_count += 1
            
        confidence_map = {0: 0.65, 1: 0.75, 2: 0.88}
        confidence = confidence_map.get(resonance_count, 0.60)
        
        if signal == 'Side':
            confidence = 0.50
            if "震荡" not in reason and "跌破" not in reason:
                reason = "无明确趋势信号"

        # Construct Factors for visibility
        factors = {
            "close": close,
            "ma20": ma20,
            "rsi": rsi,
            "macd_hist": macd_hist,
            "monthly_trend": monthly_trend,
            "weekly_trend": weekly_trend,
            "resonance": resonance_count
        }

        return QuantSignal(
            symbol=symbol,
            action=signal,
            confidence=confidence,
            factors=factors,
            reason=reason,
            risk_level="高" if resonance_count < 2 else "低"
        )
