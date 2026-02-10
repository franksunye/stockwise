"""
Brief Generation Strategies
Uses LLMRegistry for unified model routing. No more scattered env-var configs.
"""
import abc
import os
from typing import Dict, Any
import json

from logger import logger


# --- Tier Constants (kept for backward compatibility) ---
SUPPORTED_TIERS = ["free", "pro"]


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
    Strategy that routes to the correct LLM based on user tier,
    using the unified LLMRegistry for model selection.
    """
    def __init__(self, tier: str):
        self.tier = tier
        role = f"brief_{tier}"

        try:
            from backend.engine.llm_registry import LLMRegistry
            self.client = LLMRegistry.get_client(role)
            info = LLMRegistry.get_model_info(role)
            self.model = info.get('model', '')
            self.provider_display = info.get('display_name', '')
            logger.info(f"🏭 BriefStrategy: tier='{tier}' → {self.provider_display} ({self.model})")
        except (ValueError, Exception) as e:
            # Fallback: if registry has no model for this role, use legacy env config
            logger.warning(f"⚠️ LLMRegistry fallback for role '{role}': {e}")
            from engine.llm_client import LLMClient
            fallback_providers = {"free": "hunyuan", "pro": "qwen"}
            fallback = os.getenv(f"BRIEF_PROVIDER_{tier.upper()}", fallback_providers.get(tier, "hunyuan"))
            self.client = LLMClient(provider=fallback)
            self.model = self.client.model
            self.provider_display = fallback

    def get_system_prompt(self, tier: str = None) -> str:
        active_tier = tier or self.tier
        from backend.templating import render_template
        if active_tier == "pro":
            return render_template('prompts/briefs/system_pro.j2')
        return render_template('prompts/briefs/system_free.j2')

    async def generate_brief(self, user_prompt: str, temperature: float = 0.3) -> Dict[str, Any]:
        system_prompt = self.get_system_prompt()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        logger.info(f"🧠 Generating {self.tier.upper()} brief via {self.provider_display} ({self.model})...")

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
        return TieredLLMStrategy(tier=tier)

    @staticmethod
    def get_provider_for_tier(tier: str) -> str:
        """根据 tier 获取 provider 显示名称 (used for logging only)"""
        try:
            from backend.engine.llm_registry import LLMRegistry
            info = LLMRegistry.get_model_info(f"brief_{tier}")
            if info:
                return info.get('display_name', info.get('model_id', 'unknown'))
        except Exception:
            pass
        # Legacy fallback
        return os.getenv(f"BRIEF_PROVIDER_{tier.upper()}", "hunyuan")


# Backward-compatible export (used in brief_generator.py for logging)
TIER_PROVIDER_MAP = {
    "free": StrategyFactory.get_provider_for_tier("free"),
    "pro": StrategyFactory.get_provider_for_tier("pro"),
}
