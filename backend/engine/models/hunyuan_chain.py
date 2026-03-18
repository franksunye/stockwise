from typing import Dict, Any, Optional
import json
import os
from loguru import logger

from .base import BasePredictionModel
try:
    from backend.engine.chain.runner import ChainRunner
    from backend.engine.chain.step_factory import StepFactory
    from backend.config import CHAIN_STRATEGIES
    from backend.engine.llm_client import LLMClient
except ImportError:
    from engine.chain.runner import ChainRunner
    from engine.chain.step_factory import StepFactory
    from config import CHAIN_STRATEGIES
    from engine.llm_client import LLMClient

class HunyuanChainModel(BasePredictionModel):
    """
    Adapter bridging the new ChainEngine with the legacy BasePredictionModel interface.
    Allows 'hunyuan-lite' to be used interchangeably with 'gemini-3-flash'.
    """
    def __init__(self, model_id: str, config: Dict[str, Any]):
        super().__init__(model_id, config)
        
        # 1. Load Strategy Config
        self.strategy_config = CHAIN_STRATEGIES.get(model_id)
        if not self.strategy_config:
            raise ValueError(f"No chain strategy defined for {model_id} in config.py")
        
        # 2. Instantiate Steps
        self.steps = StepFactory.create_steps(self.strategy_config["steps"])
        
        # 3. Setup Client (using database config)
        def _norm_provider_id(pid: str) -> str:
            pid = (pid or "").strip()
            pid = pid.replace("-", "_").replace(".", "_")
            return pid.upper()

        def _env_provider_key(pid: str, field: str) -> str:
            return f"LLM_PROVIDER__{_norm_provider_id(pid)}__{field}"

        provider_id = self.config.get("provider_id") or self.config.get("provider")

        api_key_env = self.config.get("api_key_env") or (
            _env_provider_key(provider_id, "API_KEY") if provider_id else None
        )
        api_key = os.getenv(api_key_env, "") if api_key_env else ""
        if not api_key:
            # Migration-safe fallback: allow legacy key name
            api_key = os.getenv("HUNYUAN_API_KEY", "")

        base_url_env = self.config.get("base_url_env") or (
            _env_provider_key(provider_id, "BASE_URL") if provider_id else None
        )
        base_url = os.getenv(base_url_env, "") if base_url_env else ""
        if not base_url:
            base_url = self.config.get("base_url") or "https://api.hunyuan.cloud.tencent.com/v1"

        model_name = self.config.get("model", "hunyuan-lite")
        
        self.client = LLMClient(
            provider="hunyuan",
            base_url=base_url,
            api_key=api_key,
            model=model_name
        )
        
        # 4. Instantiate Runner
        self.runner = ChainRunner(
            model_id=model_id,
            strategy_name=model_id, # Can be v2 later
            steps=self.steps,
            llm_client=self.client
        )

    async def predict(self, symbol: str, date: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        The entry point called by AnalysisRunner.
        Delegates completely to ChainRunner.
        """
        try:
            # Inject model_name into data for downstream steps to use
            data["model_name"] = self.model_id
            
            result = await self.runner.run(symbol, date, data)
            
            if not result:
                raise ValueError("Chain finished but returned no result (Synthesis step failed?)")
                
            # Format for database and frontend compatibility
            # 1. Map top-level prices for PredictionRunner
            key_levels = result.get("key_levels", {})
            # Hunyuan chain returns tiered arrays (immediate_support/resistance).
            # We map them into the single-value columns used by ai_predictions_v2.
            support = key_levels.get("support")
            resistance = key_levels.get("resistance")
            if support is None:
                imm = key_levels.get("immediate_support")
                if isinstance(imm, list) and imm:
                    support = imm[0]
            if resistance is None:
                imm = key_levels.get("immediate_resistance")
                if isinstance(imm, list) and imm:
                    resistance = imm[0]

            result["support_price"] = support
            result["pressure_price"] = resistance

            # 1.1 Normalize key_levels to match deepseek/gemini schema
            # (keep original immediate_* arrays for richer UI, but add support/resistance/stop_loss)
            if isinstance(key_levels, dict):
                if key_levels.get("support") is None and support is not None:
                    key_levels["support"] = support
                if key_levels.get("resistance") is None and resistance is not None:
                    key_levels["resistance"] = resistance
                # unify stop_loss naming
                if key_levels.get("stop_loss") is None and key_levels.get("stop_loss_reference") is not None:
                    key_levels["stop_loss"] = key_levels.get("stop_loss_reference")
                result["key_levels"] = key_levels

            # 2. Ensure common top-level fields exist (schema parity)
            result.setdefault("signal", "Side")
            try:
                result["confidence"] = float(result.get("confidence", 0.5))
            except Exception:
                result["confidence"] = 0.5

            # 3. Inject runtime meta for DB columns (token/latency)
            meta = result.get("_meta") if isinstance(result, dict) else None
            if isinstance(meta, dict):
                result["execution_time_ms"] = int(meta.get("duration_ms", 0) or 0)
                result["token_usage_input"] = int(meta.get("input_tokens", 0) or 0)
                result["token_usage_output"] = int(meta.get("output_tokens", 0) or 0)

            # 4. Prompt version marker for chain models (distinct from b2 templates)
            result.setdefault("prompt_version", "chain.hunyuan-lite.v1")
            
            # 2. Add 'reasoning' for PredictionRunner (mapped to ai_reasoning column)
            # We store the FULL structured result as JSON string, 
            # so the frontend can parse 'summary' and 'reasoning_trace'.
            result["reasoning"] = json.dumps(result, ensure_ascii=False)
            
            return result
            
        except Exception as e:
            logger.error(f"Chain Prediction failed for {symbol}: {e}")
            # Identify if we should propagate or return fallback?
            # Design doc said "No Graceful Degradation", so we let it fail.
            raise e
