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
try:
    from backend.engine.brief_prompts import BRIEF_ASSISTANT_SYSTEM_PROMPT, BRIEF_COLUMNIST_SYSTEM_PROMPT
except ImportError:
    from engine.brief_prompts import BRIEF_ASSISTANT_SYSTEM_PROMPT, BRIEF_COLUMNIST_SYSTEM_PROMPT

# --- Tier to Provider Mapping ---
TIER_PROVIDER_MAP = {
    "free": os.getenv("BRIEF_PROVIDER_FREE", "hunyuan"),
    "pro": os.getenv("BRIEF_PROVIDER_PRO", "gemini_local")
}
SUPPORTED_TIERS = list(TIER_PROVIDER_MAP.keys())

# System Prompts now imported from brief_prompts.py

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
            return BRIEF_COLUMNIST_SYSTEM_PROMPT
        return BRIEF_ASSISTANT_SYSTEM_PROMPT

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
