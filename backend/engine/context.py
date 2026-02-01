"""
Engine Session Context Module.
Provides in-memory caching for a single stock analysis session to avoid redundant DB queries.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from backend.models.kline import KLineBar
from backend.logger import logger

class SessionContext:
    """
    Holds all relevant data for a specific stock analysis task.
    Lifespan: Single stock prediction run (across multiple models).
    """
    
    def __init__(self, symbol: str, date: str):
        self.symbol = symbol
        self.date = date
        self.metadata: Dict[str, Any] = {}
        self.price_data: Dict[str, List[Dict]] = {
            "daily": [],
            "weekly": [],
            "monthly": []
        }
        self.model_history_cache: Dict[str, Dict[str, Any]] = {}
        self.market_mood: Optional[str] = None
        self.altitude: Dict[str, Any] = {}
        self.volume_status: Optional[str] = None
        
        # Diagnostics
        self.hits = 0
        self.misses = 0

    def get_price_history(self, period: str = "daily") -> List[Dict]:
        """Get cached price history for a period."""
        data = self.price_data.get(period, [])
        if data:
            self.hits += 1
            return data
        self.misses += 1
        return []

    def set_price_history(self, period: str, data: List[Dict]):
        """Cache price history."""
        self.price_data[period] = data

    def get_model_history(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get cached AI history for a specific model."""
        if model_id in self.model_history_cache:
            self.hits += 1
            return self.model_history_cache[model_id]
        self.misses += 1
        return None

    def set_model_history(self, model_id: str, data: Dict[str, Any]):
        """Cache model-specific AI history."""
        self.model_history_cache[model_id] = data

    def stats(self):
        """Return cache performance stats."""
        total = self.hits + self.misses
        rate = (self.hits / total * 100) if total > 0 else 0
        return f"Cache Stats: {self.hits} hits, {self.misses} misses ({rate:.1f}%)"
