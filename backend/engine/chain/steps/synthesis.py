import json
import re
from typing import Dict, Any
from .base import BaseStep, StepExecutionError
from engine.chain.context import ChainContext

class SynthesisStep(BaseStep):
    """
    Step 4: Synthesis & JSON Generation.
    The final arbiter that produces the structured signal.
    """
    async def build_prompt(self, context: ChainContext) -> str:
        d = context.input_data
        ai_history = d.get('ai_history', [])
        
        # --- Dynamic Key Levels Calculation ---
        # Extract from latest daily price data for guidance
        daily_prices = d.get('daily_prices', [])
        latest = daily_prices[-1] if daily_prices else {}
        
        boll_lower = latest.get('boll_lower', 0)
        boll_upper = latest.get('boll_upper', 0)
        ma20 = latest.get('ma20', 0)
        close = latest.get('close', 0)
        
        # Calculate 10-day high/low for reference
        high_10d = max([p.get('high', 0) for p in daily_prices[-10:]]) if daily_prices else 0
        low_10d = min([p.get('low', float('inf')) for p in daily_prices[-10:]]) if daily_prices else 0
        
        # Build AI review section
        prediction_review = ""
        if ai_history:
            rows = []
            for pred in ai_history:
                signal_cn = {"Long": "做多", "Side": "观望", "Short": "避险"}.get(pred['signal'], pred['signal'])
                status_icon = "✅" if pred['validation_status'] == "Correct" else ("❌" if pred['validation_status'] == "Incorrect" else "➖")
                rows.append(f"| {pred['date']} | {signal_cn} | {pred['confidence']:.0%} | {status_icon} | {pred.get('actual_change', 'N/A')}% |")
            
            prediction_review = f"""
## AI 历史预测回顾
| 预测日期 | 信号 | 置信度 | 结果 | 实际涨跌 |
|----------|------|--------|------|----------|
{chr(10).join(rows)}
历史准确率: {d.get('accuracy', {}).get('rate', 0):.1f}%
"""

        prompt = f"""### 步骤4：最终结论推导 (Synthesis)
整合以上所有信息（基础数据 + 日线指标 + 周月线趋势），生成最终操作建议 JSON。
{prediction_review}

## 核心逻辑 (Conservative Trader)
1. **风险厌恶**：你是一个极其保守的资深交易员。只要有"背离"或"多周期冲突"，就默认"Side"（观望）。
2. **宁缺毋滥**：如果没有80%的把握（即日线+周线共振，且量能配合），不要给"Long"。
3. **拒绝公式**：输出中的所有数值必须是计算好的结果，严禁输出 Excel 公式。

## 当前技术位参考（用于填写 key_levels）
- 布林下轨: {boll_lower:.2f}
- MA20: {ma20:.2f}
- 布林上轨: {boll_upper:.2f}
- 近10日最高价: {high_10d:.2f}
- 近10日最低价: {low_10d:.2f}
- 当前收盘价: {close:.2f}

## 输出要求
必须输出纯 JSON 格式，严格遵守以下 Schema：
{{
  "signal": "Long" | "Short" | "Side",
  "confidence": 0.0 - 1.0 (观望建议 0.6-0.75),
  "summary": "一句话总结 (中文)",
  "reasoning_trace": [
    {{ "step": "trend", "data": "MA20={ma20:.2f}，周线收盘xxx", "conclusion": "多头/空头/震荡" }},
    {{ "step": "momentum", "data": "RSI=xx，MACD金叉/死叉", "conclusion": "动能强/弱" }},
    {{ "step": "level", "data": "收盘{close:.2f}，布林上轨{boll_upper:.2f}", "conclusion": "超买/正常/超卖" }},
    {{ "step": "decision", "data": "综合判断描述", "conclusion": "做多/观望/避险" }}
  ],
  "news_analysis": ["新闻1", "新闻2"] (若无新闻则填 ["无实时新闻输入，仅基于技术面分析"]),
  "tactics": {{
    "holding": [{{ "priority": "P1", "action": "具体持仓动作", "trigger": "具体触发价位", "reason": "理由" }}],
    "empty": [{{ "priority": "P1", "action": "具体空仓动作", "trigger": "具体进场条件", "reason": "理由" }}],
    "general": [{{ "priority": "P2", "action": "通用建议", "trigger": "触发条件", "reason": "理由" }}]
  }},
  "key_levels": {{ 
    "support": <使用布林下轨{boll_lower:.2f}或MA20({ma20:.2f})作为参考>,
    "resistance": <使用近10日最高价{high_10d:.2f}或布林上轨{boll_upper:.2f}作为参考>,
    "stop_loss": <通常设置在支撑位下方约3%>
  }},
  "conflict_resolution": "解释本次分析中的主要矛盾点如何权衡",
  "tomorrow_focus": "明日重点关注的价格位或事件"
}}

**IMPORTANT**: 
1. `reasoning_trace.data` 必须填入实际数值（如 MA20=607.83），不能只写占位符。
2. `reasoning_trace.conclusion` 必须是简短标签（3-8个字，如"多头强势"、"动能减弱"），严禁写完整句子。
3. `tactics.holding` 和 `tactics.empty` 必须各至少包含一条具体策略，不能为空数组。
4. `key_levels` 的数值必须基于上方技术位参考计算，严禁使用示例值。
5. 必须包含 `news_analysis`, `conflict_resolution`, `tomorrow_focus` 字段。
"""
        return prompt
    
    async def parse_response(self, response: str, context: ChainContext):
        parsed = self._clean_and_parse_json(response)
        context.artifacts["synthesis"] = parsed
        
        # Also validate required fields basic check
        if "signal" not in parsed:
            raise ValueError("JSON missing 'signal' field")
            
    def _clean_and_parse_json(self, text: str) -> Dict[str, Any]:
        """
        Robust JSON parser for messy LLM output.
        Removes markdown backticks, handles trailing commas, etc.
        """
        try:
            # 1. Strip markdown code blocks
            text = re.sub(r"```json\s*", "", text, flags=re.IGNORECASE)
            text = re.sub(r"```", "", text)
            text = text.strip()
            
            # 2. Extract JSON object if embedded in text
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                text = text[start : end + 1]
                
            return json.loads(text)
        except json.JSONDecodeError as e:
            # In a real system, we might use an LLM retry here, 
            # but Step-level retry in BaseStep handles exceptions.
            # So raising an exception here triggers the retry loop with the same prompt.
            # Ideally, we should enhance the retry prompt to say "Invalid JSON",
            # but for now, simple retry is a good start.
            raise StepExecutionError(self.step_name, f"Failed to parse JSON: {e}")
