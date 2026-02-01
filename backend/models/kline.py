from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date as date_type

class KLineBar(BaseModel):
    """
    StockWise 核心行情数据模型。
    用于标准化不同数据源（AkShare, EODHD 等）返回的行情数据。
    """
    symbol: str
    date: str  # YYYY-MM-DD
    open: float
    high: float
    low: float
    close: float
    volume: int
    change_percent: float = Field(..., alias="change_pct")
    
    # 技术指标 (Optional, calculated later)
    ma5: Optional[float] = None
    ma10: Optional[float] = None
    ma20: Optional[float] = None
    ma60: Optional[float] = None
    
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    
    boll_upper: Optional[float] = None
    boll_mid: Optional[float] = None
    boll_lower: Optional[float] = None
    
    rsi: Optional[float] = None
    kdj_k: Optional[float] = None
    kdj_d: Optional[float] = None
    kdj_j: Optional[float] = None
    
    ai_summary: Optional[str] = None

    class Config:
        populate_by_name = True

    @field_validator("date")
    @classmethod
    def validate_date_format(cls, v):
        # 简单的格式校验
        if len(v) != 10 or "-" not in v:
            raise ValueError("Date must be in YYYY-MM-DD format")
        return v
