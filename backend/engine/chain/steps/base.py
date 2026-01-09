from abc import ABC, abstractmethod
from typing import Dict, Any, List
import asyncio
from ..context import ChainContext
from ...llm_client import LLMClient
from loguru import logger

class StepExecutionError(Exception):
    def __init__(self, step_name: str, message: str):
        self.step_name = step_name
        self.message = message
        super().__init__(f"[{step_name}] {message}")

class BaseStep(ABC):
    def __init__(self, step_name: str, config: Dict = None):
        self.step_name = step_name
        self.config = config or {}
    
    @abstractmethod
    async def build_prompt(self, context: ChainContext) -> str:
        """Construct the core prompt for this step."""
        pass
    
    @abstractmethod
    async def parse_response(self, response: str, context: ChainContext):
        """Parse response and update context.structured_memory + artifacts."""
        pass
    
    async def execute(self, context: ChainContext, client: LLMClient, max_retries: int = 2):
        """
        Execute the step with retries and Cot enforcement.
        """
        for attempt in range(max_retries + 1):
            try:
                # 1. Build Base Prompt
                core_prompt = await self.build_prompt(context)
                
                # 2. Inject Structured CoT / Rule Reinforcement (Optimization for Weak Models)
                # We append this to ensure it's the last thing the model sees (Recency Bias)
                final_prompt = self._enforce_rules(core_prompt)
                
                # 3. Construct Message Chain (Context Compression)
                messages = context.get_optimized_history(self.step_name)
                messages.append({"role": "user", "content": final_prompt})
                
                # 4. Call LLM
                params = {"temperature": self.config.get("temperature", 0.5)}
                response, meta = await client.chat_async(messages, **params)
                
                if response is None:
                    error_msg = meta.get("error", "Unknown LLM Error (No Content)")
                    raise Exception(f"LLM Error: {error_msg}")

                # 5. Update Metrics
                context.total_tokens += meta.get("total_tokens", 0)
                context.add_message("user", final_prompt) # Log full prompt
                context.add_message("assistant", response)
                
                # 6. Parse
                await self.parse_response(response, context)
                logger.info(f"✅ Step '{self.step_name}' completed. Tokens: {meta.get('total_tokens', 0)}")
                return
            
            except Exception as e:
                logger.warning(f"⚠️ Step '{self.step_name}' failed (Attempt {attempt+1}/{max_retries+1}): {e}")
                if attempt == max_retries:
                    raise StepExecutionError(self.step_name, str(e))
                await asyncio.sleep(2 ** attempt)

    def _enforce_rules(self, prompt: str) -> str:
        """
        Appends reinforcement rules to combat 'catastrophic forgetting' in weak models.
        """
        reinforcement = "\n\nDesigned Constraints:\n"
        reinforcement += "1. Think logically and step-by-step.\n"
        reinforcement += "2. Be conservative. If unsure, lean towards risk aversion.\n"
        reinforcement += "3. Do NOT make up data. Use only provided context.\n"
        
        return prompt + reinforcement
