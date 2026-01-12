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

class BriefGenerationStrategy(abc.ABC):
    """Abstract base class for brief generation strategies."""
    
    @abc.abstractmethod
    async def generate_brief(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> Dict[str, Any]:
        """
        Generates a brief.
        Returns a dict containing:
        - content: The generated text
        - usage: Token usage dict
        - model: The model name used
        """
        pass

class StandardLLMStrategy(BriefGenerationStrategy):
    """
    Standard Strategy using LLMClient (OpenAI Compatible + Adapters).
    Works for Gemini Local, Hunyuan (via HTTP), DeepSeek, etc.
    """
    def __init__(self, provider: str):
        self.provider = provider
        # Initialize LLMClient for this specific provider
        self.client = LLMClient(provider=provider)
        self.model = self.client.model

    async def generate_brief(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> Dict[str, Any]:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # Use LLMClient's unified chat_async
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
            "model": self.model
        }

class StrategyFactory:
    @staticmethod
    def get_strategy(provider: str = None) -> BriefGenerationStrategy:
        if not provider:
            provider = os.getenv("BRIEF_MODEL_PROVIDER", "hunyuan").lower()
            
        logger.info(f"🏭 StrategyFactory: Creating strategy for provider '{provider}'")
        return StandardLLMStrategy(provider=provider)
