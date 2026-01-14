from typing import List, Dict, Any
from .base import BaseStep
from engine.chain.context import ChainContext

class DataAnchorStep(BaseStep):
    """
    Step 1: Anchor the data.
    Feeds raw market data (daily prices, profile) to the LLM.
    Goal: Force the model to "read" and acknowledge the key numbers before analyzing.
    """
    async def build_prompt(self, context: ChainContext) -> str:
        d = context.input_data
        
        profile = d.get('profile', {})
        prompt = f"""### 步骤1：基础锚定数据投喂
请精准记录以下股票基础数据及近10日行情：

## 1. 基础信息
- **{d.get('name', 'Unknown')}** ({context.symbol})
- **日期**: {context.date}
- **行业**: {profile.get('industry', '暂无')}
- **主营业务**: {profile.get('main_business', '暂无')}
- **公司简介**: {profile.get('description', '暂无')[:200]}...

## 2. 价格行为 (近10日日线)
| 日期 | 收盘 | 涨跌幅 | 成交量 | 状态 |
|---|---|---|---|---|
"""
        # Append formatted price table
        prices = d.get('daily_prices', [])
        # Sort by date asc (oldest first) so context flows naturally? 
        # Actually usually recent is most important. Let's show chronological.
        # Check input data format. Assuming list of dicts or tuples.
        # Implementation assumes input_data['daily_prices'] is a list of dicts.
        
        # Take last 10 days
        recent_prices = prices[-10:] if prices else []
        
        for p in recent_prices:
            date_str = p.get('date', '')
            close = f"{p.get('close', 0):.2f}"
            pct = p.get('change_percent', 0)
            pct_str = f"{pct:+.2f}%"
            vol = self._format_volume(p.get('volume', 0))
            
            # Simple heuristic for 'Status' column to help weak models
            status = "放量大涨" if pct > 3 and p.get('volume', 0) > 0 else \
                     "大跌" if pct < -3 else "震荡"
            
            prompt += f"| {date_str} | {close} | {pct_str} | {vol} | {status} |\n"

        latest_date = recent_prices[-1].get('date', 'Unknown') if recent_prices else 'Unknown'

        prompt += f"""
## 任务指令
1. **行情快照**：确认 **最新日期 ({latest_date})** 的收盘价和涨跌幅。
2. **波动检查**：列表中是否有单日涨跌幅超过 **±9%** 的极端行情？（回答：是/否，若有请列出日期）
3. **输出结论**：如果数据看起来完整，输出「[Data Anchored] 数据完整，准备进入技术分析」。
"""
        return prompt

    async def parse_response(self, response: str, context: ChainContext):
        # Store full response as artifact
        context.artifacts["anchor"] = response
        
        # Extract a short summary for context compression
        # We try to grab the first few lines or the conclusion
        summary = response[:300] + "..." if len(response) > 300 else response
        context.structured_memory["anchor_summary"] = summary

    def _format_volume(self, vol: float) -> str:
        if vol > 100000000:
            return f"{vol/100000000:.1f}亿"
        elif vol > 10000:
            return f"{vol/10000:.1f}万"
        return str(vol)
