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
        logger.info(f"⚙️ Running Rule Engine for {symbol} on {date}")
        prices = data.get('daily_prices', [])
        if not prices:
             return {"signal": "Side", "confidence": 0.0, "reasoning": self._build_reasoning("Side", "数据缺失", "无法获取价格数据", {})}
             
        try:
            if isinstance(prices, list) and len(prices) > 0:
                latest = prices[-1]
            else:
                latest = prices
            
            # Use Pandas Series for compatibility with QuantEngine
            import pandas as pd
            daily_series = pd.Series(latest)
            
            # Attempt to fetch extra context (Weekly/Monthly) locally since runner might not provide it
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
            summary = sig.reason
            close_val = latest.get('close', 0)
            reasoning_json = self._build_reasoning(sig.action, summary, sig.reason, sig.factors, close_val)
            
            # v3.3 Schema Support
            ma20 = sig.factors.get('ma20', 0)
            boll_lower = latest.get('boll_lower', ma20 * 0.95 if ma20 > 0 else close_val * 0.95)
            
            return {
                "signal": sig.action,
                "confidence": sig.confidence,
                "reasoning": reasoning_json,
                "support_price": ma20,
                "pressure_price": ma20 * 1.1,
                "token_usage_input": 0,
                "token_usage_output": 0,
                "execution_time_ms": 15
            }
            
        except Exception as e:
            logger.error(f"Rule Engine Error: {e}")
            return None
    
    def _build_reasoning(self, signal: str, summary: str, analysis: str, factors: Dict[str, Any], close: float = 0) -> str:
        """Build a JSON-formatted reasoning string consistent with v3.3 Schema."""
        ma20 = factors.get('ma20', 0)
        rsi = factors.get('rsi', 0)
        macd = factors.get('macd_hist', 0)
        
        # Calculate levels for tactics
        support = ma20 if ma20 > 0 else close * 0.95
        resistance = close * 1.05 if ma20 == 0 else (ma20 * 1.1 if close < ma20 else close * 1.1)
        stop_loss = support * 0.97
        
        reasoning_data = {
            "signal": signal,
            "confidence": 0.5 if signal == "Side" else 0.75,
            "summary": f"量化兜底信号：{summary}",
            "reasoning_trace": [
                {"step": "trend", "data": f"MA20={ma20:.2f}, 价格={close:.2f}。{analysis}", "conclusion": "趋势观察"},
                {"step": "momentum", "data": f"RSI={rsi:.1f}, MACD红柱={macd:.4f}", "conclusion": "动能评估"},
                {"step": "levels", "data": f"关键支撑位在 MA20 ({ma20:.2f}) 附近，上方阻力参考前高。", "conclusion": "空间格局"},
                {"step": "context", "data": "多周期共振分析：日、周、月趋势量化对比（系统预置规则）。", "conclusion": "多维对齐"},
                {"step": "psychology", "data": "遵循趋势跟踪纪律，避开波动较大的主观预期区间。", "conclusion": "博弈纪律"},
                {"step": "decision", "data": f"由于AI模块不可用，已切换至量化引擎根据均线偏离度执行兜底决策：{signal}", "conclusion": "量化契约"}
            ],
            "key_levels": {
                "immediate_support": [round(support, 2)],
                "immediate_resistance": [round(resistance, 2)],
                "stop_loss_reference": round(stop_loss, 2)
            },
            "tactics": {
                "holding_profit": [{"priority": "P1", "action": "持仓观察", "trigger": f"不跌破 {ma20:.2f}", "target_price": round(resistance, 2), "stop_advance_price": round(close, 2), "reason": "趋势未改"}],
                "holding_loss": [{"priority": "P1", "action": "严格止损", "trigger": f"有效跌破 {ma20:.2f}", "stop_loss_price": round(stop_loss, 2), "reason": "触发风险线"}],
                "empty": [{"priority": "P1", "action": "观望为主", "trigger": f"回调至 {support:.2f} 企稳", "buy_zone_price": round(support, 2), "reason": "等待趋势确认"}]
            },
            "counter_argument": f"如果价格放量跌破 {stop_loss:.2f} 且 RSi 进一步走弱，则量化做多逻辑彻底失效。",
            "conflict_resolution": "以均线系统为准，不带多空偏见，执行机械量化纪律。",
            "tomorrow_focus": f"关注价格在 {ma20:.2f} 均线附近的博弈强度。",
            "is_llm": False
        }
        return json.dumps(reasoning_data, ensure_ascii=False)
