import requests
import json
import os
import time
from typing import Dict, Any
from .base import BasePredictionModel
from backend.logger import logger

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
        
    async def predict(self, symbol: str, date: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_key:
            logger.warning(f"Skipping {self.model_id}: Missing API Key ({self.api_key_env})")
            return None

        # Use existing prompt logic from backend/engine/prompts.py
        # We need to import it inside method or top level. 
        # Note: relative import might differ depending on where this file is.
        # It's in backend/engine/models/openai.py, prompts is backend/engine/prompts.py
        # So 'from ..prompts import prepare_stock_analysis_prompt'
        
        try:
             from ..prompts import prepare_stock_analysis_prompt
             system_prompt, user_prompt = prepare_stock_analysis_prompt(symbol, date)
             
             if not user_prompt:
                 return {
                    "signal": "Side",
                    "confidence": 0.0, 
                    "reasoning": "Failed to generate prompt (No data)", 
                    "validation_status": "Error"
                 }
        except ImportError:
             # Fallback if import fails (shouldn't happen if structure is correct)
             logger.error("Failed to import simple prompts")
             return {"signal":"Side", "confidence":0.0, "reasoning":"Import error"}

        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": self.max_tokens,
            "temperature": self.temperature
            # Note: response_format removed as local proxies may not support it
        }

        start_time = time.time()
        try:
            # Note: This is synchronous requests in async method. 
            # For low volume, this is acceptable.
            response = requests.post(f"{self.base_url}/chat/completions", headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            usage = result.get('usage', {})
            content = result['choices'][0]['message']['content']
            logger.info(f"📥 LLM Response: {len(content)} chars, starts with: {repr(content[:50])}")
            # Inline robust JSON parsing (from llm_client._parse_json_response)
            import re
            parsed = None
            # 1. Standard parse
            try:
                parsed = json.loads(content)
            except:
                pass
            # 2. Remove markdown fences
            if not parsed:
                content_clean = re.sub(r'^```json\s*', '', content, flags=re.MULTILINE)
                content_clean = re.sub(r'^```\s*', '', content_clean, flags=re.MULTILINE)
                content_clean = re.sub(r'```$', '', content_clean, flags=re.MULTILINE)
                try:
                    parsed = json.loads(content_clean)
                except:
                    pass
            # 3. Extract first {...} block using stack balance
            if not parsed:
                try:
                    balance = 0
                    start = content.find('{')
                    if start != -1:
                        for i in range(start, len(content)):
                            if content[i] == '{':
                                balance += 1
                            elif content[i] == '}':
                                balance -= 1
                                if balance == 0:
                                    json_str = content[start:i+1]
                                    parsed = json.loads(json_str)
                                    logger.info(f"Parsed JSON via stack balance: {len(json_str)} chars")
                                    break
                except Exception as e:
                    logger.warning(f"Stack balance parse failed: {e}")
            
            if not parsed:
                logger.error(f"Failed to parse JSON response. Full content:\n{content}")
                return None
            
            end_time = time.time()
            execution_time = int((end_time - start_time) * 1000)
            
            # Extract reasoning, prioritizing 'summary' or 'analysis' fields
            reasoning_text = parsed.get("summary") or parsed.get("analysis") or json.dumps(parsed.get("reasoning_trace", "No reasoning"))
            
            # Map tactics/trigger to Support/Pressure if possible, or just keep None
            # The prompt output has 'key_levels': {'support': ..., 'resistance': ...}
            key_levels = parsed.get("key_levels", {})
            
            # Store the clean parsed JSON as reasoning (without markdown blocks)
            # This ensures frontend can parse it consistently
            clean_reasoning = json.dumps(parsed, ensure_ascii=False)
            
            return {
                "signal": parsed.get("signal", "Side"),
                "confidence": float(parsed.get("confidence", 0.5)),
                "reasoning": clean_reasoning,
                "support_price": key_levels.get("support"),
                "pressure_price": key_levels.get("resistance"),
                "token_usage_input": usage.get('prompt_tokens', 0),
                "token_usage_output": usage.get('completion_tokens', 0),
                "execution_time_ms": execution_time
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API Request Failed: {e}")
            return {
                "signal": "Side",
                "confidence": 0.0,
                "reasoning": f"API Error: {str(e)}",
                "validation_status": "Error"
            }
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON response: {content}")
            return {
                "signal": "Side",
                "confidence": 0.0,
                "reasoning": "Failed to parse AI response",
                "validation_status": "Error"
            }

