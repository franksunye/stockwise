from __future__ import annotations

from typing import Optional

from backend.engine.semantic_registry import (
    ALL_SIGNAL_STATES,
    CANONICAL_SIGNAL_STATES,
    LEGACY_SIGNAL_STATES,
)

_SIGNAL_CN_LABELS = {
    "TriggeredLong": "建议看多",
    "Watch": "建议观察",
    "NoSetup": "暂无信号",
    "RiskOff": "建议防守",
    "Long": "做多",
    "Short": "避险",
    "Side": "观望",
}

_SIGNAL_WEIGHTS = {
    "TriggeredLong": 1,
    "Watch": 0,
    "NoSetup": 0,
    "RiskOff": -1,
    "Long": 1,
    "Strong Long": 2,
    "Short": -1,
    "Strong Short": -2,
    "Side": 0,
    "Hold": 0,
    "Buy": 1,
    "Sell": -1,
}


def normalize_signal_value(value: object, default: str = "Side") -> str:
    raw = str(value or "").strip()
    if not raw:
        return default

    if "." in raw:
        raw = raw.split(".")[-1]

    lowered = raw.lower()
    for candidate in ALL_SIGNAL_STATES:
        if lowered == candidate.lower():
            return candidate

    if "triggeredlong" in lowered:
        return "TriggeredLong"
    if "riskoff" in lowered:
        return "RiskOff"
    if "nosetup" in lowered:
        return "NoSetup"
    if "watch" in lowered:
        return "Watch"
    if "long" in lowered:
        return "Long"
    if "short" in lowered:
        return "Short"
    if "side" in lowered:
        return "Side"

    return default


def is_canonical_signal(value: object) -> bool:
    return normalize_signal_value(value, "") in CANONICAL_SIGNAL_STATES


def to_legacy_signal(value: object, default: str = "Side") -> str:
    normalized = normalize_signal_value(value, default)
    if normalized == "TriggeredLong":
        return "Long"
    if normalized in {"Watch", "NoSetup", "RiskOff"}:
        return "Side"
    if normalized in LEGACY_SIGNAL_STATES:
        return normalized
    return default


def canonical_signal_from_layer1(status: Optional[str], default: str = "NoSetup") -> str:
    normalized = normalize_signal_value(status, default)
    return normalized if normalized in CANONICAL_SIGNAL_STATES else default


def is_legacy_signal_inertia(raw_signal: object, expected_canonical_signal: object) -> bool:
    raw = normalize_signal_value(raw_signal, "")
    expected = normalize_signal_value(expected_canonical_signal, "")
    if not raw or not expected:
        return False

    return (
        (raw == "Side" and expected in {"Watch", "NoSetup", "RiskOff"})
        or (raw == "Long" and expected == "TriggeredLong")
    )


def signal_to_cn_label(value: object) -> str:
    normalized = normalize_signal_value(value, str(value or ""))
    return _SIGNAL_CN_LABELS.get(normalized, str(value or ""))


def signal_weight(value: object) -> int:
    normalized = normalize_signal_value(value, str(value or ""))
    return _SIGNAL_WEIGHTS.get(normalized, 0)
