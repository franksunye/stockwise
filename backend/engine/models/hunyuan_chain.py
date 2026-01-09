from typing import Dict, Any, Optional
from loguru import logger

from .base import BasePredictionModel
from ..chain.runner import ChainRunner
from ..chain.step_factory import StepFactory
from ...config import CHAIN_STRATEGIES
from ..llm_client import LLMClient

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
                
            # Normalize result keys to match BasePredictionModel expectations
            # Chain synthesis output matches the schema: signal, confidence, reasoning_trace...
            # But the DB expects 'ai_reasoning' as a string, not a JSON object?
            # Let's check BasePredictionModel or runner usage. 
            # Actually, standard output usually has 'reasoning'. 
            # But our new schema has 'reasoning_trace'.
            # We should probably flatten it or serialize it for the 'ai_reasoning' column.
            
            # For backward compatibility with 'ai_reasoning' text column:
            if "reasoning_trace" in result:
                # Convert structured trace to readable text
                trace_text = "\n".join([
                    f"[{step['step']}] {step['conclusion']} ({step['data']})"
                    for step in result.get("reasoning_trace", [])
                ])
                result["reasoning"] = trace_text
            
            return result
            
        except Exception as e:
            logger.error(f"Chain Prediction failed for {symbol}: {e}")
            # Identify if we should propagate or return fallback?
            # Design doc said "No Graceful Degradation", so we let it fail.
            raise e
