from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import pandas as pd
from ..types import QuantSignal

class BaseStrategy(ABC):
    @abstractmethod
    def analyze(self, symbol: str, data_context: Dict[str, Any]) -> QuantSignal:
        """
        Analyze the given data context and return a standardized signal.
        
        Args:
            symbol: Stock symbol
            data_context: Dictionary containing:
                - 'daily_row': pd.Series (Latest daily data with indicators)
                - 'weekly_row': Optional[pd.Series] (Latest weekly data)
                - 'monthly_row': Optional[pd.Series] (Latest monthly data)
        """
        pass
