from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from typing import Literal

@dataclass
class QuantSignal:
    """标准化的量化信号对象"""
    symbol: str
    action: Literal["Long", "Short", "Side"]
    confidence: float
    factors: Dict[str, Any] = field(default_factory=dict) # Key metrics triggering the signal (e.g. {"ma20_breakout": True})
    reason: str = ""
    risk_level: str = "Medium"
    
    # Optional metadata
    source_model: str = "QuantEngine"
    timestamp: Optional[str] = None

@dataclass
class AnalysisResult:
    """完整的分析结果，包含信号和原始数据"""
    signal: QuantSignal
    indicators_snapshot: Dict[str, float]
    strategy_name: str
