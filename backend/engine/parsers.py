import json
import re
from typing import List, Dict, Any, Optional, Union
from enum import Enum
from pydantic import BaseModel, Field, confloat, validator, ValidationError

class SignalEnum(str, Enum):
    LONG = "Long"
    SHORT = "Short"
    SIDE = "Side"

    @classmethod
    def _missing_(cls, value):
        """Case-insensitive fallback"""
        if isinstance(value, str):
            for member in cls:
                if member.value.lower() == value.lower():
                    return member
        return cls.SIDE # Default safe fallback

class KeyLevels(BaseModel):
    support: Optional[float] = 0.0
    resistance: Optional[float] = 0.0
    stop_loss: Optional[float] = 0.0

class ReasoningStep(BaseModel):
    step: str
    data: str
    conclusion: str

class TacticItem(BaseModel):
    priority: str = "P1"
    action: str
    trigger: str
    reason: str

class Tactics(BaseModel):
    holding: List[TacticItem] = Field(default_factory=list)
    empty: List[TacticItem] = Field(default_factory=list)
    general: List[TacticItem] = Field(default_factory=list)

class StockAnalysisResult(BaseModel):
    signal: SignalEnum
    confidence: float = Field(..., ge=0.0, le=1.0)
    summary: str
    reasoning_trace: List[ReasoningStep] = Field(default_factory=list)
    news_analysis: List[str] = Field(default_factory=list)
    tactics: Tactics = Field(default_factory=Tactics)
    key_levels: KeyLevels = Field(default_factory=KeyLevels)
    conflict_resolution: Optional[str] = ""
    tomorrow_focus: Optional[str] = ""
    
    # Allow extra fields for forward compatibility
    class Config:
        extra = "ignore"

    @validator('confidence', pre=True)
    def parse_confidence(cls, v):
        """Handle 85% -> 0.85"""
        if isinstance(v, str) and v.endswith('%'):
            try:
                return float(v.strip('%')) / 100.0
            except:
                pass
        return v

def _extract_json_block(text: str) -> str:
    """
    Robustly extract the first valid JSON object from text.
    Handles Markdown code blocks and raw JSON.
    """
    if not text: return ""
    
    # 1. Try to find markdown block
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if match:
        return match.group(1)

    # 2. Try to find outermost {}
    # Simple stack-based finder for nested braces could be better, 
    # but regex is often "good enough" for LLM output which usually puts JSON at the end or alone.
    
    # Greedy match from first { to last }
    start = text.find('{')
    end = text.rfind('}')
    
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
        
    return text

def _fix_common_json_errors(text: str) -> str:
    """
    Attempt to fix common LLM JSON syntax errors.
    """
    # Fix trailing commas: , } -> } and , ] -> ]
    text = re.sub(r',\s*}', '}', text)
    text = re.sub(r',\s*\]', ']', text)
    # Fix unquoted keys (simple alphanumeric keys)
    # This is risky, only apply if absolutely necessary or use a proper loose parser library.
    # For now, let's stick to simple trailing comma fixes.
    return text

def parse_ai_response(text: str) -> StockAnalysisResult:
    """
    Parse (and clean) LLM output text into a structured StockAnalysisResult object.
    Raises ValidationError if parsing fails completely.
    """
    # 1. Extract
    json_str = _extract_json_block(text)
    if not json_str:
        raise ValueError("No JSON object found in text")

    # 2. Parse JSON
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError:
        # Retry with fix
        json_str_fixed = _fix_common_json_errors(json_str)
        try:
            data = json.loads(json_str_fixed)
        except json.JSONDecodeError as e:
            # Last ditch: try `eval` safe subset? No, too dangerous.
            # Maybe use a utility like `demjson` if available, but let's stick to stdlib.
            raise ValueError(f"Invalid JSON syntax: {e}")

    # 3. Validate with Pydantic
    try:
        return StockAnalysisResult(**data)
    except ValidationError as e:
        # Try to recover partial data or re-raise
        # For strict engineering, we raise. The caller decides whether to retry or partial fallback.
        raise e
