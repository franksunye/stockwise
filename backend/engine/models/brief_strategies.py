"""
Brief Generation Strategies
Implements a Strategy Pattern for generating stock briefs using different LLM providers via LLMClient.
"""
import abc
import os
from typing import Dict, Any, Optional
import json

from logger import logger
from engine.llm_client import LLMClient
from config import DEFAULTS

# --- Tier to Provider Mapping ---
TIER_PROVIDER_MAP = {
    "free": os.getenv("BRIEF_PROVIDER_FREE", "hunyuan"),
    "pro": os.getenv("BRIEF_PROVIDER_PRO", "gemini_local")
}
SUPPORTED_TIERS = list(TIER_PROVIDER_MAP.keys())

# --- Prompt Templates (提示词模板库) ---

# [FREE Tier] Assistant Mode - Focus on facts, smart brevity (Axios style)
ASSISTANT_SYSTEM_PROMPT = """你是一位 StockWise 的财经简报助手。你的目标是编写一份简洁、准确、事实驱动的个股日报。

核心原则：
1. 简洁直白：采用 "Smart Brevity" 风格，让用户在 30 秒内读完。
2. 事实优先：准确呈现今日股价变动和核心新闻。
3. 结论明确：基于数据给出明确的 AI 倾向。
4. 格式规范：严格遵守输出结构要求。
"""

# [PRO Tier] Financial Columnist Mode - Focus on narrative and depth (Matt Levine style)
COLUMNIST_SYSTEM_PROMPT = """你是一位 StockWise 的首席财经主笔 (Chief Financial Columnist)。
你的目标是编写一份**世界级、叙事驱动、具有深刻洞察力**的个股日报。你的写作风格应当对标 Bloomberg 的 Matt Levine。

核心写作哲学（世界级标准）：
1. **叙事驱动 (Narrative-Driven)**：将复杂的金融事件转变为引人入胜的故事。不要只是罗列数据，要告诉用户背后的“为什么” (The Why) 和“那又怎样” (So What)。
2. **数据隐形化 (Invisible Data)**：禁止直接罗列 RSI、MACD、MA5 等具体技术指标数值。你应当将这些数据转化为定性的描述（如：“多空力量正在激烈博弈，目前抛压略占上风” 而非 “RSI=52”）。
3. **时空深度 (Contextual Depth)**：善用输入的 [第三事实]（大盘背景与多周期海拔）。绝不要孤立看个股。如果大盘暴跌而个股抗跌，请指出这种“相对强度”；如果个股处于月线战略底部，请在描述趋势时注入这种长期的“安全垫”感。
4. **自我反思与连贯性 (Self-Reflection)**：关注输入的 [第四事实]（昨日预测复盘）。这是你建立信任的核心。承认错误是专业能力的最高体现。如果昨日预测信号与今日实际走势相反，请在开篇第一句坦诚指出，并简要反思原因（是突发新闻干扰还是技术面假突破？）。
5. **新闻严谨性 (News Rigor)**：对新闻时效性有极端要求。如果你发现新闻列表中包含陈旧信息或与今日日期不符，请果断忽略，并在简报中告知用户“今日消息面无重大异动”，转而深化对技术面形态或行业趋势的解读。绝不允许为了凑字数而引用过时新闻。
6. **专业深度**：结合行业板块背景、宏观环境和个股异动，捕捉市场情绪的微妙变化。
7. **简洁而深刻**：每一句话都要有信息增量，拒绝废话，但保持有温度、充满智慧的专业语感。
8. **核心信条**：你的信誉建立在**预测准确性**之上。你不是只会报喜不报忧的营销号。当你的预测被市场打脸时，这是你展示专业深度的最佳时刻。
"""

class BriefGenerationStrategy(abc.ABC):
    """Abstract base class for brief generation strategies."""
    
    @abc.abstractmethod
    def get_system_prompt(self, tier: str) -> str:
        pass

    @abc.abstractmethod
    async def generate_brief(self, user_prompt: str, temperature: float = 0.3) -> Dict[str, Any]:
        """Generates a brief."""
        pass

class TieredLLMStrategy(BriefGenerationStrategy):
    """
    Strategy that selects System Prompt based on user tier.
    """
    def __init__(self, tier: str):
        self.tier = tier
        self.provider = TIER_PROVIDER_MAP.get(tier, "hunyuan")
        self.client = LLMClient(provider=self.provider)
        self.model = self.client.model
        
    def get_system_prompt(self, tier: str = None) -> str:
        active_tier = tier or self.tier
        if active_tier == "pro":
            return COLUMNIST_SYSTEM_PROMPT
        return ASSISTANT_SYSTEM_PROMPT

    async def generate_brief(self, user_prompt: str, temperature: float = 0.3) -> Dict[str, Any]:
        system_prompt = self.get_system_prompt()
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        logger.info(f"🧠 Generating {self.tier.upper()} brief via {self.provider} ({self.model})...")
        
        content, meta = await self.client.chat_async(
            messages=messages,
            temperature=temperature
        )
        
        if not content:
            raise RuntimeError(f"LLM generation failed: {meta.get('error')}")

        return {
            "content": content,
            "usage": {
                "input_tokens": meta.get("input_tokens", 0),
                "output_tokens": meta.get("output_tokens", 0),
                "total_tokens": meta.get("total_tokens", 0)
            },
            "model": self.model,
            "tier": self.tier
        }

class StrategyFactory:
    @staticmethod
    def get_strategy(provider: str = None) -> BriefGenerationStrategy:
        # Default fallback to 'free' tier logic if only provider is given
        return TieredLLMStrategy(tier="free")
    
    @staticmethod
    def get_strategy_for_tier(tier: str) -> BriefGenerationStrategy:
        """根据用户等级获取对应的策略"""
        logger.info(f"🏭 StrategyFactory: Creating strategy for tier '{tier}'")
        return TieredLLMStrategy(tier=tier)
    
    @staticmethod
    def get_provider_for_tier(tier: str) -> str:
        """根据 tier 获取 provider 名称"""
        return TIER_PROVIDER_MAP.get(tier, "hunyuan")
