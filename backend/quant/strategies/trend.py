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
            return QuantSignal(symbol, "Side", 0.0, {}, "No daily data")

        close = daily.get('close', 0)
        ma20 = daily.get('ma20', 0)
        rsi = daily.get('rsi', 50)
        macd_hist = daily.get('macd_hist', 0)
        
        # --- Multi-timeframe Trend ---
        monthly_row = data_context.get('monthly_row')
        weekly_row = data_context.get('weekly_row')
        
        # Monthly Trend
        monthly_trend = "Bull"
        if monthly_row is not None:
            if monthly_row.get('close', 0) <= monthly_row.get('ma20', 0):
                monthly_trend = "Bear"
        
        # Weekly Trend
        weekly_trend = "Bull"
        if weekly_row is not None:
             if weekly_row.get('close', 0) <= weekly_row.get('ma20', 0):
                weekly_trend = "Bear"

        # --- Base Signal Logic ---
        support_price = ma20 if ma20 > 0 else (close * 0.95)
        
        signal = 'Side'
        reason = "Neutral"
        
        if close < support_price * 0.98:
            signal = 'Short'
            reason = "Price broken below support level"
        elif close > ma20:
            signal = 'Long'
            reason = "Price standing above MA20"
        
        # Filter: RSI Choppiness
        if 45 <= rsi <= 55 and signal != 'Short':
            signal = 'Side'
            reason = "RSI in choppy zone (45-55)"

        # --- Resonance & Confidence ---
        resonance_count = 0
        if signal == 'Long':
            if monthly_trend == "Bull": resonance_count += 1
            if weekly_trend == "Bull": resonance_count += 1
        elif signal == 'Short':
            if monthly_trend == "Bear": resonance_count += 1
            if weekly_trend == "Bear": resonance_count += 1
            
        confidence_map = {0: 0.65, 1: 0.75, 2: 0.88}
        confidence = confidence_map.get(resonance_count, 0.60)
        
        if signal == 'Side':
            confidence = 0.50
            if "choppy" not in reason and "broken" not in reason:
                reason = "No clear trend signal"

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
            risk_level="High" if resonance_count < 2 else "Low"
        )
