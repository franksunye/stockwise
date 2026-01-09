from typing import Dict, Any, List
from .base import BaseStep
from ..context import ChainContext

class IndicatorStep(BaseStep):
    """
    Step 2: Technical Analysis (Daily)
    Focuses on MA trend, MACD momentum, and RSI levels.
    """
    async def build_prompt(self, context: ChainContext) -> str:
        prices = context.input_data.get('daily_prices', [])
        if not prices:
            return "Error: No price data available."
            
        latest = prices[-1]
        
        # Pre-calculate simple signals to help weak models
        ma_summary = self._analyze_ma(latest)
        macd_summary = self._analyze_macd(latest)
        
        prompt = f"""### 步骤2：日线技术面深度解析
请基于以下最新技术指标进行分析：

## 1. 均线系统 (趋势)
- **MA5**: {latest.get('ma5', 0):.2f}
- **MA20**: {latest.get('ma20', 0):.2f} (生命线)
- **MA60**: {latest.get('ma60', 0):.2f} (决策线)
- **收盘价**: {latest.get('close', 0):.2f}
- **机器预判**: {ma_summary}

## 2. 动能指标 (MACD & RSI)
- **MACD (DIF)**: {latest.get('macd', 0):.3f}
- **Signal (DEA)**: {latest.get('macd_signal', 0):.3f}
- **Histogram**: {latest.get('macd_hist', 0):.3f}
- **机器预判**: {macd_summary}
- **RSI (6/12/24)**: {latest.get('rsi', 0):.1f} / {latest.get('kdj_k', 0):.1f} (KDJ_K)

## 3. 布林带 (波动)
- **上轨**: {latest.get('boll_upper', 0):.2f}
- **中轨**: {latest.get('boll_mid', 0):.2f}
- **下轨**: {latest.get('boll_lower', 0):.2f}

## 任务指令
1. **趋势判定**：价格是在MA20之上还是之下？MA20是向上还是向下？
2. **动能确认**：MACD是金叉还是死叉？红柱是在放大还是缩小？RSI是否超买/超卖？
3. **关键压力/支撑**：找出哪怕一个显眼的压力位（如MA60或布林上轨）。
4. **输出结论**：总结日线级别的多空力量对比（例如：「多头略占优，但动能减弱」）。
"""
        return prompt

    async def parse_response(self, response: str, context: ChainContext):
        context.artifacts["indicator"] = response
        context.structured_memory["technical_insight"] = response[:400] # Compress

    def _analyze_ma(self, p):
        close = p.get('close', 0)
        ma20 = p.get('ma20', 0)
        if close > ma20:
             return "站稳MA20之上 (偏多)"
        return "跌破MA20 (偏空/震荡)"

    def _analyze_macd(self, p):
        hist = p.get('macd_hist', 0)
        if hist > 0:
            return "红柱 (多头动能)"
        return "绿柱 (空头动能)"


class MultiPeriodStep(BaseStep):
    """
    Step 3: Multi-period Confirmation.
    Checks Weekly/Monthly trends to filter out daily noise.
    """
    async def build_prompt(self, context: ChainContext) -> str:
        w_prices = context.input_data.get('weekly_prices', [])
        m_prices = context.input_data.get('monthly_prices', [])
        
        # Get latest weekly/monthly data (if available)
        last_w = w_prices[-1] if w_prices else {}
        last_m = m_prices[-1] if m_prices else {}
        
        prompt = f"""### 步骤3：多周期共振验证
为了避免"日线骗线"，我们需要检查周线和月线的大趋势。

## 1. 周线数据 (中线趋势)
- **收盘**: {last_w.get('close', 'N/A')}
- **MA20 (周线生命线)**: {last_w.get('ma20', 'N/A')}
- **MACD柱**: {last_w.get('macd_hist', 'N/A')}
- **趋势状态**: {"多头排列" if last_w.get('close', 0) > last_w.get('ma20', 99999) else "空头/调整"}

## 2. 月线数据 (长线格局)
- **收盘**: {last_m.get('close', 'N/A')}
- **MA20**: {last_m.get('ma20', 'N/A')}
- **MACD柱**: {last_m.get('macd_hist', 'N/A')}

## 任务指令
1. **共振检查**：日线看涨，周线是否也看涨？如果日线涨但周线被MA20压制，则可能是"反弹"而非"反转"。
2. **位置评估**：当前股价处于历史（月线）的高位还是低位？
3. **矛盾裁决**：如果日线和周线冲突，以周线（中线趋势）为准。
4. **输出结论**：给出「多周期综合评级」（例如：日线反弹，周线空头，建议观望）。
"""
        return prompt
    
    async def parse_response(self, response: str, context: ChainContext):
        context.artifacts["multi_period"] = response
        context.structured_memory["period_insight"] = response[:300]
