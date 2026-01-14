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
             system_prompt, user_prompt = prepare_stock_analysis_prompt(symbol, date, ctx=data)
             
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
        # Initialize LLM Tracker
        tracker = get_tracker()
        
        start_time = time.time()
        
        # Retry configuration
        max_retries = 3
        retry_delay = 2
        
        last_error = None
        parsed = None
        final_content = None
        
        for attempt in range(max_retries + 1):
            # Start a FRESH trace for each attempt (Full Fidelity Logging)
            tracker.start_trace(symbol=symbol, model=self.model_id)
            tracker.set_prompts(system_prompt, user_prompt)
            if attempt > 0:
                tracker._current_trace.retry_count = attempt

            # Execute Chat via LLMClient in thread
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
                error_str = str(e)
                last_error = f"Client Error: {error_str}"
                logger.error(f"LLM Client execution failed (attempt {attempt + 1}/{max_retries + 1}): {e}")
                
                # Check retry policy
                if not self._should_retry(error_str):
                     logger.error(f"🛑 Fatal error detected. Aborting retries. ({error_str[:100]}...)")
                     return self._error_result(f"Fatal Error: {error_str}")

                # Record Failure Trace IMMEDIATELY
                tracker.set_status("error", last_error)
                tracker.end_trace()
                
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                continue

            # Record Token Usage for this attempt
            tracker.set_tokens(
                input_tokens=meta.get("input_tokens", 0),
                output_tokens=meta.get("output_tokens", 0),
                total_tokens=meta.get("total_tokens", 0)
            )

            if not content:
                last_error = meta.get("error", "Empty response from LLM")
                logger.error(f"LLM request failed (attempt {attempt + 1}/{max_retries + 1}): {last_error}")
                
                # Check retry policy for non-exception errors
                if not self._should_retry(str(last_error)):
                    logger.error(f"🛑 Fatal error detected. Aborting retries.")
                    return self._error_result(f"Fatal Error: {last_error}")

                # Record Failure Trace
                tracker.set_status("error", last_error)
                tracker.end_trace()
                
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                continue

            logger.info(f"📥 {self.model_id} Response: {len(content)} chars")
            final_content = content

            # Reuse robust parsing logic from LLMClient
            parsed = self.client._parse_json_response(content)
            tracker.set_response(final_content, parsed)
            
            if not parsed:
                last_error = "Failed to parse AI response"
                logger.warning(f"Failed to parse JSON response for {self.model_id} (attempt {attempt + 1}/{max_retries + 1})")
                
                # Record Parse Failure Trace
                tracker.set_status("parse_failed", "JSON 解析失败")
                tracker.end_trace()
                
                if attempt < max_retries:
                    logger.info(f"🔄 Retrying in {retry_delay * (2 ** attempt)}s...")
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                continue
            
            # Success!
            tracker.set_status("success")
            trace = tracker.end_trace()
            if trace:
                logger.info(f"📊 Trace: ✅ {trace.latency_ms}ms | {trace.total_tokens} tokens | attempt: {attempt + 1}")
            
            # Normalize and Return
            end_time = time.time()
            execution_time = int((end_time - start_time) * 1000)
            parsed = normalize_ai_response(parsed)
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
        
        # If loop finishes without success
        return self._error_result(f"Failed after {max_retries + 1} attempts. Last Error: {last_error}")
        
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

    def _should_retry(self, error_msg: str) -> bool:
        """
        Determine if the error is transient and worth retrying.
        Industry Standard Policies:
        - Retry: 429 (Rate Limit), 5xx (Server/Gateway), Connection Errors, Timeouts
        - Abort: 401 (Auth), 403 (Permission), 400 (Bad Request), 404 (Not Found), 422 (Validation)
        """
        error_msg = str(error_msg).lower()
        
        # 1. Non-Retryable / Fatal Errors
        fatal_indicators = [
            "401", "authentication", "unauthorized", # Auth Error
            "403", "forbidden",                      # Permission Error
            "404", "not found",                      # Model/Path Error
            "400", "bad request",                    # Application Error (e.g. context too long)
            "422", "unprocessable",                  # Validation Error
            "context_length_exceeded"                # Token Limit Exceeded
        ]
        
        for fatal in fatal_indicators:
            if fatal in error_msg:
                return False
                
        # 2. Retryable Errors (Implicitly anything else, but essentially:)
        # - 429 (Too Many Requests)
        # - 500, 502, 503, 504 (Server Errors)
        # - ConnectionError, Timeout
        return True

