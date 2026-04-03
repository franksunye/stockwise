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
        locale = context.locale or "cn"

        profile = d.get('profile', {})
        if locale == "en":
            return self._build_prompt_en(d, context, profile)
        return self._build_prompt_cn(d, context, profile)

    def _format_volume(self, vol: float, locale: str) -> str:
        if locale == "en":
            if vol > 100_000_000:
                return f"{vol / 100_000_000:.1f}B"
            if vol > 10_000:
                return f"{vol / 10_000:.1f}M"
            return str(vol)
        if vol > 100000000:
            return f"{vol/100000000:.1f}亿"
        elif vol > 10000:
            return f"{vol/10000:.1f}万"
        return str(vol)

    def _build_prompt_cn(self, d: dict, context: ChainContext, profile: dict) -> str:
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
        prices = d.get('daily_prices', [])
        recent_prices = prices[-10:] if prices else []

        for p in recent_prices:
            date_str = p.get('date', '')
            close = f"{p.get('close', 0):.2f}"
            pct = p.get('change_percent', 0)
            pct_str = f"{pct:+.2f}%"
            vol = self._format_volume(p.get('volume', 0), "cn")

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

    def _build_prompt_en(self, d: dict, context: ChainContext, profile: dict) -> str:
        prompt = f"""### Step 1: Data anchoring
Record the following baseline data and the last ~10 daily bars accurately.

## 1. Profile
- **{d.get('name', 'Unknown')}** ({context.symbol})
- **As-of date**: {context.date}
- **Industry**: {profile.get('industry', 'N/A')}
- **Main business**: {profile.get('main_business', 'N/A')}
- **Company description** (truncated): {profile.get('description', 'N/A')[:200]}...

## 2. Price action (last 10 daily bars)
| Date | Close | Chg % | Volume | Note |
|---|---|---|---|---|
"""
        prices = d.get('daily_prices', [])
        recent_prices = prices[-10:] if prices else []

        for p in recent_prices:
            date_str = p.get('date', '')
            close = f"{p.get('close', 0):.2f}"
            pct = p.get('change_percent', 0)
            pct_str = f"{pct:+.2f}%"
            vol = self._format_volume(p.get('volume', 0), "en")

            if pct > 3 and p.get('volume', 0) > 0:
                status = "Strong up + volume"
            elif pct < -3:
                status = "Large down day"
            else:
                status = "Chop / balance"

            prompt += f"| {date_str} | {close} | {pct_str} | {vol} | {status} |\n"

        latest_date = recent_prices[-1].get('date', 'Unknown') if recent_prices else 'Unknown'

        prompt += f"""
## Tasks
1. **Snapshot**: Confirm the **latest session ({latest_date})** close and daily change.
2. **Extremes**: Any day with a move beyond **±9%**? (Answer yes/no; if yes, list dates.)
3. **Conclusion**: If the feed looks complete, reply with: `[Data Anchored] Complete — ready for technical analysis`.
"""
        return prompt

    async def parse_response(self, response: str, context: ChainContext):
        # Store full response as artifact
        context.artifacts["anchor"] = response

        # Extract a short summary for context compression
        # We try to grab the first few lines or the conclusion
        summary = response[:300] + "..." if len(response) > 300 else response
        context.structured_memory["anchor_summary"] = summary
