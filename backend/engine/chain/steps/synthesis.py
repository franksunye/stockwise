import json
import re
from typing import Dict, Any
from .base import BaseStep, StepExecutionError
from ..context import ChainContext

class SynthesisStep(BaseStep):
    """
    Step 4: Synthesis & JSON Generation.
    The final arbiter that produces the structured signal.
    """
    async def build_prompt(self, context: ChainContext) -> str:
        # Context is already injected via context.get_compressed_history() in BaseStep
        # So here we just focus on the task.
        
        prompt = """### 步骤4：最终结论推导 (Synthesis)
整合以上所有信息（基础数据 + 日线指标 + 周月线趋势），生成最终操作建议 JSON。

## 核心逻辑 (Conservative Trader)
1. **风险厌恶**：你是一个极其保守的资深交易员。只要有"背离"或"多周期冲突"，就默认"Side"（观望）。
2. **宁缺毋滥**：如果没有80%的把握（即日线+周线共振，且量能配合），不要给"Long"。
3. **拒绝公式**：输出中的所有数值必须是计算好的结果，严禁输出 Excel 公式。

## 输出要求
必须输出纯 JSON 格式，严格遵守以下 Schema：
{
  "signal": "Long" | "Short" | "Side",
  "confidence": 0.0 - 1.0 (观望建议 0.6-0.75),
  "summary": "一句话总结 (中文)",
  "reasoning_trace": [
    { "step": "trend", "data": "MA20/周线状态", "conclusion": "趋势结论" },
    { "step": "momentum", "data": "MACD/RSI状态", "conclusion": "动能结论" },
    { "step": "risk", "data": "背离/压力位", "conclusion": "风险结论" },
    { "step": "decision", "data": "综合判断", "conclusion": "最终结论" }
  ],
  "tactics": {
    "holding": { "action": "持仓策略", "trigger": "止盈/止损位", "reason": "理由" },
    "empty": { "action": "空仓策略", "trigger": "进场位或继续观望", "reason": "理由" }
  },
  "key_levels": {
    "support": 123.45,
    "resistance": 456.78
  }
}
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
