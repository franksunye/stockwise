import json
import re
import unicodedata
from typing import List, Dict, Any, Optional, Union, Tuple
from enum import Enum
from dataclasses import dataclass
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from backend.engine.signal_semantics import normalize_signal_value

try:
    import dirtyjson as _dirtyjson
except Exception:
    _dirtyjson = None

class SignalEnum(str, Enum):
    TRIGGERED_LONG = "TriggeredLong"
    WATCH = "Watch"
    NO_SETUP = "NoSetup"
    RISK_OFF = "RiskOff"
    LONG = "Long"
    SHORT = "Short"
    SIDE = "Side"

    @classmethod
    def _missing_(cls, value):
        """Case-insensitive fallback"""
        normalized = normalize_signal_value(value, "Side")
        for member in cls:
            if member.value == normalized:
                return member
        return cls.SIDE # Default safe fallback

class KeyLevels(BaseModel):
    immediate_support: List[float] = Field(default_factory=list)
    immediate_resistance: List[float] = Field(default_factory=list)
    strong_support: Optional[Union[float, str, List[Union[float, str]]]] = 0.0
    strong_resistance: Optional[Union[float, str, List[Union[float, str]]]] = 0.0
    breakout_confirmation_level: Optional[Union[float, str, List[Union[float, str]]]] = 0.0
    stop_loss_reference: Optional[Union[float, str, List[Union[float, str]]]] = 0.0

    # Backward compatibility
    support: Optional[float] = 0.0
    resistance: Optional[float] = 0.0
    stop_loss: Optional[float] = 0.0

class ReasoningStep(BaseModel):
    step: str = ""
    data: str = ""
    # Some providers omit `conclusion`; tolerate and normalize later.
    conclusion: str = ""

class TacticItem(BaseModel):
    priority: str = "P1"
    action: str
    trigger: str
    target_price: Optional[Union[float, str, List[Union[float, str]]]] = None
    stop_advance_price: Optional[Union[float, str, List[Union[float, str]]]] = None
    stop_loss_price: Optional[Union[float, str, List[Union[float, str]]]] = None
    buy_zone_price: Optional[Union[float, str, List[Union[float, str]]]] = None
    # Some providers occasionally omit `reason`; keep parser tolerant
    # and let schema_normalizer backfill canonical copy later.
    reason: str = ""

class Tactics(BaseModel):
    holding_profit: List[TacticItem] = Field(default_factory=list)
    holding_loss: List[TacticItem] = Field(default_factory=list)
    empty: List[TacticItem] = Field(default_factory=list)

    # Backward compatibility
    holding: List[TacticItem] = Field(default_factory=list)
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
    counter_argument: Optional[str] = Field(default="", description="思辨复盘：反向逻辑或潜在风险点")
    
    model_config = ConfigDict(extra="ignore")

    @field_validator("confidence", mode="before")
    @classmethod
    def parse_confidence(cls, v):
        """Handle 85% -> 0.85"""
        if isinstance(v, str) and v.endswith('%'):
            try:
                return float(v.strip('%')) / 100.0
            except Exception:
                pass
        return v

class ParseErrorCode(str, Enum):
    NO_JSON_BLOCK = "NO_JSON_BLOCK"
    INVALID_JSON = "INVALID_JSON"
    TRUNCATED = "TRUNCATED"
    SCHEMA_VALIDATION = "SCHEMA_VALIDATION"


class ParseError(ValueError):
    def __init__(self, code: ParseErrorCode, message: str, stage: str = "", details: str = ""):
        super().__init__(message)
        self.code = code
        self.stage = stage
        self.details = details


@dataclass
class ParseDiagnostics:
    stage: str
    used_dirtyjson: bool
    normalized: bool
    truncated_hint: bool


def _extract_json_block(text: str) -> str:
    """
    Robustly extract the first valid JSON object from text.
    Handles Markdown code blocks and raw JSON.
    """
    if not text:
        return ""
    
    # 1) Try fenced JSON first
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1)

    # 2) Stack-based extraction from the first "{", aware of quotes and escapes.
    start = text.find('{')
    if start == -1:
        return ""

    depth = 0
    in_string = False
    escaped = False

    for idx in range(start, len(text)):
        ch = text[idx]

        if in_string:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start:idx + 1]

    # Unbalanced JSON (likely truncated): return from first "{" to end for downstream detection.
    return text[start:]


def _normalize_json_text(text: str) -> str:
    # Curly quotes are not guaranteed to be normalized by NFKC; map them explicitly first.
    text = text.replace("\u201c", '"').replace("\u201d", '"').replace("\u201f", '"').replace("\uff02", '"')
    text = unicodedata.normalize("NFKC", text)
    # Remove trailing commas before object/array close.
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return text


def _is_probably_truncated(text: str) -> bool:
    if not text:
        return False
    if text.count("{") > text.count("}"):
        return True
    if text.count("[") > text.count("]"):
        return True
    # Common partial endings in truncated JSON payloads
    stripped = text.rstrip()
    if stripped.endswith(":") or stripped.endswith(',"') or stripped.endswith(',"action"'):
        return True
    return False


def _parse_dict_funnel(json_str: str) -> Tuple[Dict[str, Any], ParseDiagnostics]:
    # L1: strict parser on raw extracted block.
    try:
        return json.loads(json_str), ParseDiagnostics(
            stage="strict", used_dirtyjson=False, normalized=False, truncated_hint=False
        )
    except json.JSONDecodeError as strict_err:
        normalized = _normalize_json_text(json_str)
        truncated_hint = _is_probably_truncated(normalized)

        # L2: strict parser after generic normalization.
        try:
            return json.loads(normalized), ParseDiagnostics(
                stage="normalized_strict",
                used_dirtyjson=False,
                normalized=True,
                truncated_hint=truncated_hint,
            )
        except json.JSONDecodeError as norm_err:
            # L3: dirtyjson fallback (if available) for JS-like loose objects.
            if _dirtyjson is not None:
                try:
                    return _dirtyjson.loads(normalized), ParseDiagnostics(
                        stage="dirtyjson",
                        used_dirtyjson=True,
                        normalized=True,
                        truncated_hint=truncated_hint,
                    )
                except Exception as dirty_err:
                    code = ParseErrorCode.TRUNCATED if truncated_hint else ParseErrorCode.INVALID_JSON
                    raise ParseError(
                        code=code,
                        stage="dirtyjson",
                        message=f"Invalid JSON syntax: {dirty_err}",
                        details=f"strict={strict_err}; normalized={norm_err}",
                    )

            code = ParseErrorCode.TRUNCATED if truncated_hint else ParseErrorCode.INVALID_JSON
            raise ParseError(
                code=code,
                stage="normalized_strict",
                message=f"Invalid JSON syntax: {norm_err}",
                details=f"strict={strict_err}; dirtyjson=unavailable",
            )


def parse_ai_response_with_diagnostics(text: str) -> Tuple[StockAnalysisResult, ParseDiagnostics]:
    json_str = _extract_json_block(text)
    if not json_str:
        raise ParseError(ParseErrorCode.NO_JSON_BLOCK, "No JSON object found in text", stage="extract")

    data, diag = _parse_dict_funnel(json_str)
    try:
        return StockAnalysisResult(**data), diag
    except ValidationError as e:
        # Keep ValidationError behavior for existing callers.
        raise e

def parse_ai_response(text: str) -> StockAnalysisResult:
    """
    Parse (and clean) LLM output text into a structured StockAnalysisResult object.
    Raises ValidationError if parsing fails completely.
    """
    result, _diag = parse_ai_response_with_diagnostics(text)
    return result
