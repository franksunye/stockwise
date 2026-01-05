import json
import os
import time
import asyncio
from typing import Dict, Any, Tuple
from .base import BasePredictionModel
from backend.logger import logger
from ..schema_normalizer import normalize_ai_response
from ..llm_client import LLMClient
from ..llm_tracker import get_tracker

class OpenAIAdapter(BasePredictionModel):
    def __init__(self, model_id: str, config: Dict[str, Any]):
        super().__init__(model_id, config)
        self.api_key_env = config.get("api_key_env", "DEEPSEEK_API_KEY")
        self.api_key = os.getenv(self.api_key_env)
        
        # Support base_url from env variable or direct config
        base_url_env = config.get("base_url_env")
        if base_url_env:
            self.base_url = os.getenv(base_url_env, "https://api.deepseek.com/v1")
        else:
            self.base_url = config.get("base_url", "https://api.deepseek.com/v1")
            
        self.model_name = config.get("model") or config.get("model_name", "deepseek-chat")
        self.max_tokens = config.get("max_tokens", 4096)
        self.temperature = config.get("temperature", 0.7)
        
        # Initialize internal LLMClient
        # This reuses the robust networking, parsing, and tracking logic of the main client.
        self.client = LLMClient(
            provider="custom", # treated as custom/openai-compatible
            base_url=self.base_url,
            api_key=self.api_key,
            model=self.model_name,
            timeout=60
        )
        
    async def predict(self, symbol: str, date: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_key:
            logger.warning(f"Skipping {self.model_id}: Missing API Key ({self.api_key_env})")
            return None

        # Prepare prompts
        try:
             from ..prompts import prepare_stock_analysis_prompt
             system_prompt, user_prompt = prepare_stock_analysis_prompt(symbol, date)
             
             if not user_prompt:
                 return self._error_result("Failed to generate prompt (No data)")
        except ImportError:
             logger.error("Failed to import simple prompts")
             return self._error_result("Import error")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # Initialize LLM Tracker
        tracker = get_tracker()
        tracker.start_trace(symbol=symbol, model=self.model_id)
        tracker.set_prompts(system_prompt, user_prompt)

        start_time = time.time()
        
        # Retry configuration
        max_retries = 3
        retry_delay = 2  # Initial delay in seconds (exponential backoff: 2, 4, 8)
        
        last_error = None
        parsed = None
        meta = {}
        final_content = None
        retry_count = 0
        
        for attempt in range(max_retries + 1):
            # Execute Chat via LLMClient
            # Since LLMClient is synchronous, we run it in a thread to avoid blocking the async loop
            # This restores true parallelism for the Runner.
            try:
                loop = asyncio.get_event_loop()
                content, meta = await loop.run_in_executor(
                    None, 
                    lambda: self.client.chat(
                        messages, 
                        model=self.model_name, 
                        temperature=self.temperature, 
                        max_tokens=self.max_tokens
                    )
                )
            except Exception as e:
                last_error = f"Client Error: {str(e)}"
                logger.error(f"LLM Client execution failed (attempt {attempt + 1}/{max_retries + 1}): {e}")
                if attempt < max_retries:
                    retry_count += 1
                    tracker.increment_retry()
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                continue

            if not content:
                last_error = meta.get("error", "Empty response from LLM")
                logger.error(f"LLM request failed (attempt {attempt + 1}/{max_retries + 1}): {last_error}")
                if attempt < max_retries:
                    retry_count += 1
                    tracker.increment_retry()
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                continue

            logger.info(f"📥 {self.model_id} Response: {len(content)} chars")
            final_content = content

            # Reuse robust parsing logic from LLMClient
            parsed = self.client._parse_json_response(content)
            
            if not parsed:
                last_error = "Failed to parse AI response"
                logger.warning(f"Failed to parse JSON response for {self.model_id} (attempt {attempt + 1}/{max_retries + 1})")
                if attempt < max_retries:
                    logger.info(f"🔄 Retrying in {retry_delay * (2 ** attempt)}s...")
                    retry_count += 1
                    tracker.increment_retry()
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                continue
            
            # Success - break out of retry loop
            break
        
        end_time = time.time()
        execution_time = int((end_time - start_time) * 1000)
        
        # Record tracking data
        tracker.set_tokens(
            input_tokens=meta.get("input_tokens", 0),
            output_tokens=meta.get("output_tokens", 0),
            total_tokens=meta.get("total_tokens", 0)
        )
        tracker.set_response(final_content, parsed)
        
        if not parsed:
            logger.error(f"Failed to parse JSON response for {self.model_id} after {max_retries + 1} attempts")
            if final_content:
                tracker.set_status("parse_failed", "JSON 解析失败")
            else:
                tracker.set_status("error", last_error or "未知错误")
            tracker.end_trace()
            return self._error_result(f"Parse Failed: {last_error}")
        
        # Mark success and save trace
        tracker.set_status("success")
        trace = tracker.end_trace()
        if trace:
            logger.info(f"📊 Trace: ✅ {trace.latency_ms}ms | {trace.total_tokens} tokens | retries: {trace.retry_count}")
        
        # Normalize schema (Anti-Corruption Layer)
        parsed = normalize_ai_response(parsed)
        
        # Construct result compatible with Runner
        key_levels = parsed.get("key_levels", {})
        clean_reasoning = json.dumps(parsed, ensure_ascii=False)
        
        return {
            "signal": parsed.get("signal", "Side"),
            "confidence": float(parsed.get("confidence", 0.5)),
            "reasoning": clean_reasoning,
            "support_price": key_levels.get("support"),
            "pressure_price": key_levels.get("resistance"),
            "token_usage_input": meta.get("input_tokens", 0),
            "token_usage_output": meta.get("output_tokens", 0),
            "execution_time_ms": execution_time
        }
        
    def _error_result(self, reason: str) -> Dict[str, Any]:
        return {
            "signal": "Side",
            "confidence": 0.0, 
            "reasoning": reason, 
            "validation_status": "Error"
        }

