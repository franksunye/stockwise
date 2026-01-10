import json
from typing import Dict, Any
from .base import BasePredictionModel
from backend.logger import logger

class RuleAdapter(BasePredictionModel):
    async def predict(self, symbol: str, date: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Rule Engine based on MA alignment.
        Returns reasoning in JSON format consistent with LLM models.
        """
        prices = data.get('daily_prices', [])
        if not prices:
             return {"signal": "Side", "confidence": 0.0, "reasoning": self._build_reasoning("Side", "数据缺失", "无法获取价格数据")}
             
        try:
            if isinstance(prices, list) and len(prices) > 0:
                latest = prices[-1]
            else:
                latest = prices
            
            # Use Pandas Series for compatibility with QuantEngine
            import pandas as pd
            daily_series = pd.Series(latest)
            
            # Attempt to fetch extra context (Weekly/Monthly) locally since runner might not provide it
            # This makes RuleAdapter smarter than before
            from backend.database import get_connection
            conn = get_connection()
            cursor = conn.cursor()
            
            monthly_series = None
            try:
                cursor.execute("SELECT * FROM monthly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
                m_row = cursor.fetchone()
                if m_row:
                    m_cols = [d[0] for d in cursor.description]
                    monthly_series = pd.Series(dict(zip(m_cols, m_row)))
            except: pass
            
            weekly_series = None
            try:
                cursor.execute("SELECT * FROM weekly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
                w_row = cursor.fetchone()
                if w_row:
                    w_cols = [d[0] for d in cursor.description]
                    weekly_series = pd.Series(dict(zip(w_cols, w_row)))
            except: pass
            
            conn.close()
            
            # Call Quant Engine
            from backend.quant.engine import QuantEngine
            engine = QuantEngine()
            
            context = {
                'daily_row': daily_series,
                'weekly_row': weekly_series,
                'monthly_row': monthly_series
            }
            
            result = engine.run(symbol, context, "trend")
            sig = result.signal
            
            # Map back to API format
            summary = f"{sig.action}: {sig.reason}"
            reasoning_json = self._build_reasoning(sig.action, summary, sig.reason)
            
            # For pressure/support, use factors if available or fallback
            ma20 = sig.factors.get('ma20', 0)
            
            return {
                "signal": sig.action,
                "confidence": sig.confidence,
                "reasoning": reasoning_json,
                "support_price": ma20,
                "pressure_price": ma20 * 1.1, # Simple est
                "token_usage_input": 0,
                "token_usage_output": 0,
                "execution_time_ms": 15
            }
            
        except Exception as e:
            logger.error(f"Rule Engine Error: {e}")
            return None
    
    def _build_reasoning(self, signal: str, summary: str, analysis: str) -> str:
        """Build a JSON-formatted reasoning string consistent with LLM output."""
        reasoning_data = {
            "signal": signal,
            "summary": summary,
            "reasoning_trace": [
                {"step": "trend", "data": analysis, "conclusion": summary}
            ],
            "tactics": {
                "holding": [{"priority": "P1", "action": "持仓观察", "trigger": "均线信号变化", "reason": summary}],
                "empty": [{"priority": "P1", "action": "观望为主", "trigger": "等待趋势确认", "reason": summary}]
            },
            "conflict_resolution": "遵循均线趋势原则",
            "is_llm": False
        }
        return json.dumps(reasoning_data, ensure_ascii=False)
