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
        self.base_url = config.get("base_url", "https://api.deepseek.com/v1")
        self.model_name = config.get("model_name", "deepseek-chat")
        self.max_tokens = config.get("max_tokens", 4096)
        self.temperature = config.get("temperature", 0.7)
        
    async def predict(self, symbol: str, date: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "signal": "Side",
                "confidence": 0.0,
                "reasoning": f"Missing API Key for {self.model_id} ({self.api_key_env})",
                "validation_status": "Invalid"
            }

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
            "temperature": self.temperature,
            "response_format": {"type": "json_object"}
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
            
            parsed = json.loads(content)
            
            end_time = time.time()
            execution_time = int((end_time - start_time) * 1000)
            
            # Extract reasoning, prioritizing 'summary' or 'analysis' fields
            reasoning_text = parsed.get("summary") or parsed.get("analysis") or json.dumps(parsed.get("reasoning_trace", "No reasoning"))
            
            # Map tactics/trigger to Support/Pressure if possible, or just keep None
            # The prompt output has 'key_levels': {'support': ..., 'resistance': ...}
            key_levels = parsed.get("key_levels", {})
            
            return {
                "signal": parsed.get("signal", "Side"),
                "confidence": float(parsed.get("confidence", 0.5)),
                "reasoning": content, # Store full JSON string as reasoning for detailed display
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

