from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BasePredictionModel(ABC):
    def __init__(self, model_id: str, config: Dict[str, Any]):
        self.model_id = model_id
        self.config = config
        self.display_name = config.get("display_name", model_id)
        
    @abstractmethod
    async def predict(self, symbol: str, date: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute prediction logic.
        
        Args:
            symbol: Stock symbol (e.g., '00700')
            date: Analysis date (YYYY-MM-DD)
            data: Context data including prices, indicators, news, etc.
            
        Returns:
            Dict containing:
            - signal (str): 'Long', 'Side', 'Short'
            - confidence (float): 0.0 - 1.0
            - reasoning (str): Analysis text
            - support_price (float, optional)
            - pressure_price (float, optional)
            - token_usage_input (int, optional)
            - token_usage_output (int, optional)
        """
        pass
        
    def get_capabilities(self) -> Dict[str, Any]:
        return self.config.get("capabilities_json", {})
