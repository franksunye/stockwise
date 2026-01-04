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
        prices = data.get('price_data', {})
        if not prices:
             return {"signal": "Side", "confidence": 0.0, "reasoning": self._build_reasoning("Side", "数据缺失", "无法获取价格数据")}
             
        try:
            if isinstance(prices, list) and len(prices) > 0:
                latest = prices[-1]
            else:
                latest = prices
                
            close = latest.get('close')
            ma5 = latest.get('ma5')
            ma20 = latest.get('ma20')
            
            if not (close and ma5 and ma20):
                return {"signal": "Side", "confidence": 0.0, "reasoning": self._build_reasoning("Side", "指标不足", "缺少必要的均线数据")}
            
            if close > ma5 > ma20:
                signal = "Long"
                confidence = 0.7
                summary = "均线多头排列，趋势向上"
                analysis = f"价格 {close:.2f} 站上 MA5({ma5:.2f}) 且 MA5 在 MA20({ma20:.2f}) 之上，形成多头排列"
            elif close < ma5 < ma20:
                signal = "Short"
                confidence = 0.7
                summary = "均线空头排列，趋势向下"
                analysis = f"价格 {close:.2f} 跌破 MA5({ma5:.2f}) 且 MA5 在 MA20({ma20:.2f}) 之下，形成空头排列"
            else:
                signal = "Side"
                confidence = 0.5
                summary = "均线缠绕，方向不明"
                analysis = f"价格 {close:.2f}，MA5({ma5:.2f})，MA20({ma20:.2f}) 交织缠绕，暂无明确趋势"
            
            reasoning_json = self._build_reasoning(signal, summary, analysis)
                
            return {
                "signal": signal,
                "confidence": confidence,
                "reasoning": reasoning_json,
                "support_price": ma20,
                "pressure_price": latest.get('ma60') or (ma20 * 1.1),
                "token_usage_input": 0,
                "token_usage_output": 0,
                "execution_time_ms": 10
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
