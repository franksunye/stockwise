"""
GeminiLocalAdapter - 通过 Gemini 协议连接本地代理的预测模型适配器
使用 google-generativeai SDK，api_endpoint 指向本地代理服务
性能优于 OpenAI 协议
"""
import json
import os
import time
import asyncio
from typing import Dict, Any, Tuple
from .base import BasePredictionModel
from backend.logger import logger
from backend.engine.schema_normalizer import normalize_ai_response
from backend.engine.llm_tracker import get_tracker, estimate_tokens


class GeminiLocalAdapter(BasePredictionModel):
    def __init__(self, model_id: str, config: Dict[str, Any]):
        super().__init__(model_id, config)
        
        # 配置项
        self.api_key_env = config.get("api_key_env", "LLM_API_KEY")
        self.api_key = os.getenv(self.api_key_env)
        
        # 本地代理地址 (不带 /v1)
        base_url_env = config.get("base_url_env")
        if base_url_env:
            self.base_url = os.getenv(base_url_env, "http://127.0.0.1:8045")
        else:
            self.base_url = config.get("base_url", "http://127.0.0.1:8045")
        
        self.model_name = config.get("model") or config.get("model_name", "gemini-3-flash")
        self.max_tokens = config.get("max_tokens", 4096)
        self.temperature = config.get("temperature", 0.7)
        
        # 初始化 Gemini SDK (指向本地代理)
        self._client = None
        if self.api_key:
            try:
                from google import genai
                # V2 SDK support custom endpoint via http_options
                self._client = genai.Client(
                    api_key=self.api_key,
                    http_options={'base_url': self.base_url}
                )
                logger.info(f"✅ GeminiLocalAdapter V2 初始化成功 -> {self.base_url}")
            except Exception as e:
                logger.warning(f"⚠️ GeminiLocalAdapter V2 初始化失败: {e}")
        
    async def predict(self, symbol: str, date: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_key or not self._client:
            logger.warning(f"Skipping {self.model_id}: Missing API Key ({self.api_key_env})")
            return None

        # Prepare prompts
        try:
            from backend.engine.prompts import prepare_stock_analysis_prompt
            system_prompt, user_prompt = prepare_stock_analysis_prompt(symbol, date, ctx=data)
            
            if not user_prompt:
                return self._error_result("Failed to generate prompt (No data)")
        except ImportError:
            logger.error("Failed to import prompts")
            return self._error_result("Import error")

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
            # Start a FRESH trace for each attempt
            tracker.start_trace(symbol=symbol, model=self.model_id)
            tracker.set_prompts(system_prompt, user_prompt)
            if attempt > 0:
                tracker._current_trace.retry_count = attempt

            try:
                # Call Gemini via SDK
                content, meta = await self._chat_gemini_local(system_prompt, user_prompt)
            except Exception as e:
                last_error = f"Client Error: {str(e)}"
                logger.error(f"Gemini Local execution failed (attempt {attempt + 1}/{max_retries + 1}): {e}")
                
                tracker.set_status("error", last_error)
                tracker.end_trace()
                
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                continue

            # Record Token Usage
            tracker.set_tokens(
                input_tokens=meta.get("input_tokens", 0),
                output_tokens=meta.get("output_tokens", 0),
                total_tokens=meta.get("total_tokens", 0)
            )

            if not content:
                last_error = meta.get("error", "Empty response from LLM")
                logger.error(f"Gemini Local request failed (attempt {attempt + 1}/{max_retries + 1}): {last_error}")
                
                tracker.set_status("error", last_error)
                tracker.end_trace()
                
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                continue

            logger.info(f"📥 {self.model_id} Response: {len(content)} chars")
            final_content = content

            # Parse JSON response
            parsed = self._parse_json_response(content)
            tracker.set_response(final_content, parsed)
            
            if not parsed:
                last_error = "Failed to parse AI response"
                logger.warning(f"Failed to parse JSON response for {self.model_id} (attempt {attempt + 1}/{max_retries + 1})")
                
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
    
    async def _chat_gemini_local(self, system_prompt: str, user_prompt: str) -> Tuple[str, Dict[str, Any]]:
        """
        通过 Gemini V2 SDK 调用本地代理
        """
        meta = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "latency_ms": 0, "error": None}
        
        # 合并 system 和 user prompt (本地代理不支持 system_instruction)
        # combined_prompt = f"[系统指令] {system_prompt}\n\n[用户消息] {user_prompt}"
        # V2 SDK generic call usually takes 'contents'
        
        # We manually construct contents list
        contents = [
            {"role": "user", "parts": [{"text": f"[系统指令] {system_prompt}\n\n[用户消息] {user_prompt}"}]}
        ]
        
        start_time = time.time()
        
        try:
            from google import genai
            from google.genai import types
            
            config = types.GenerateContentConfig(
                temperature=self.temperature,
                max_output_tokens=self.max_tokens
            )
            
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            
            def _call():
                return self._client.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=config
                )

            response = await loop.run_in_executor(None, _call)
            
            elapsed = time.time() - start_time
            meta["latency_ms"] = int(elapsed * 1000)
            
            content = response.text
             
            # Token Usage
            if response.usage_metadata:
                meta["input_tokens"] = response.usage_metadata.prompt_token_count
                meta["output_tokens"] = response.usage_metadata.candidates_token_count
                meta["total_tokens"] = response.usage_metadata.total_token_count
            else:
                 # Local proxy fallback
                meta["input_tokens"] = estimate_tokens(str(contents))
                meta["output_tokens"] = estimate_tokens(content)
                meta["total_tokens"] = meta["input_tokens"] + meta["output_tokens"]
            
            logger.info(f"   🤖 GEMINI_LOCAL 响应成功 ({elapsed:.1f}s, {meta['total_tokens']} tokens)")
            return content, meta
            
        except Exception as e:
            logger.error(f"Gemini Local Call Error: {e}")
            raise e
        
    def _error_result(self, reason: str) -> Dict[str, Any]:
        return {
            "signal": "Side",
            "confidence": 0.0, 
            "reasoning": reason, 
            "validation_status": "Error"
        }
    
    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """解析 LLM 返回的 JSON"""
        if not content:
            return None
        
        import re
        
        # 1. 直接解析
        try:
            return json.loads(content)
        except:
            pass
        
        # 2. 移除 Markdown 标记
        content_clean = re.sub(r'^```json\s*', '', content, flags=re.MULTILINE)
        content_clean = re.sub(r'^```\s*', '', content_clean, flags=re.MULTILINE)
        content_clean = re.sub(r'```$', '', content_clean, flags=re.MULTILINE)
        try:
            return json.loads(content_clean)
        except:
            pass
        
        # 3. 提取 {}
        try:
            start_idx = content.find('{')
            end_idx = content.rfind('}')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                possible_json = content[start_idx : end_idx + 1]
                possible_json = re.sub(r',\s*}', '}', possible_json)
                return json.loads(possible_json)
        except:
            pass
        
        return None
