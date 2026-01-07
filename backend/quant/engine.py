from typing import Dict, Any, Optional
from .strategies.trend import TrendStrategy
from .types import QuantSignal, AnalysisResult

class QuantEngine:
    """
    The main entry point for Quantitative Analysis.
    Currently isolates the 'Rule-Based' logic.
    """
    
    def __init__(self):
        self.strategies = {
            "trend": TrendStrategy()
        }
    
    def run(self, symbol: str, data_context: Dict[str, Any], strategy_name: str = "trend") -> AnalysisResult:
        """
        Execute a quant strategy.
        
        Args:
            symbol: Stock symbol
            data_context: Data required by the strategy
            strategy_name: Name of the strategy to run (default: "trend")
        """
        strategy = self.strategies.get(strategy_name)
        if not strategy:
            raise ValueError(f"Strategy '{strategy_name}' not found.")
            
        signal = strategy.analyze(symbol, data_context)
        
        # Snapshot key indicators for record keeping
        # Extract from daily row if available
        indicators = {}
        daily = data_context.get('daily_row')
        if daily is not None:
             for col in ['ma20', 'rsi', 'macd_hist']:
                 indicators[col] = daily.get(col, 0)
        
        return AnalysisResult(
            signal=signal,
            indicators_snapshot=indicators,
            strategy_name=strategy_name
        )
