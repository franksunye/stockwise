from typing import Dict, Any
from .base import BasePredictionModel

class RuleAdapter(BasePredictionModel):
    async def predict(self, symbol: str, date: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Simple Rule Engine based on MA alignment.
        """
        # data expected to contain 'indicators' or 'prices'
        prices = data.get('price_data', {})
        if not prices:
             return {"signal": "Side", "confidence": 0.0, "reasoning": "No data"}
             
        # Extract latest close and MA
        try:
            # Assuming prices is a list of dicts or dict
            if isinstance(prices, list) and len(prices) > 0:
                latest = prices[-1]
            else:
                latest = prices
                
            close = latest.get('close')
            ma5 = latest.get('ma5')
            ma20 = latest.get('ma20')
            
            if not (close and ma5 and ma20):
                return {"signal": "Side", "confidence": 0.0, "reasoning": "Insufficient indicators"}
            
            if close > ma5 > ma20:
                signal = "Long"
                confidence = 0.7
                reasoning = "Price > MA5 > MA20 (Bullish Alignment)"
            elif close < ma5 < ma20:
                signal = "Short"
                confidence = 0.7
                reasoning = "Price < MA5 < MA20 (Bearish Alignment)"
            else:
                signal = "Side"
                confidence = 0.5
                reasoning = "Moving Averages Entangled"
                
            return {
                "signal": signal,
                "confidence": confidence,
                "reasoning": reasoning,
                "support_price": ma20,
                "pressure_price": ma60 if 'ma60' in latest else ma20 * 1.1,
                "token_usage_input": 0,
                "token_usage_output": 0,
                "execution_time_ms": 10
            }
            
        except Exception as e:
            return {"signal": "Side", "confidence": 0.0, "reasoning": f"Rule Error: {e}"}
