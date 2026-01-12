from typing import Dict, Any, Optional
import json
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
        
        # 3. Setup Client (using existing backend 'hunyuan' config)
        self.client = LLMClient(provider="hunyuan")
        
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
            result = await self.runner.run(symbol, date, data)
            
            if not result:
                raise ValueError("Chain finished but returned no result (Synthesis step failed?)")
                
            # Format for database and frontend compatibility
            # 1. Map top-level prices for PredictionRunner
            key_levels = result.get("key_levels", {})
            result["support_price"] = key_levels.get("support")
            result["pressure_price"] = key_levels.get("resistance")
            
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
