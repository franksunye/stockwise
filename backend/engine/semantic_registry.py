from __future__ import annotations

from typing import Optional

# Producer/Layer-1 signal semantics
CANONICAL_SIGNAL_STATES = ("TriggeredLong", "Watch", "NoSetup", "RiskOff")
LEGACY_SIGNAL_STATES = ("Long", "Short", "Side")
ALL_SIGNAL_STATES = CANONICAL_SIGNAL_STATES + LEGACY_SIGNAL_STATES

# Decision/action semantics (Chinese user-facing contract)
DECISION_SEMANTIC_LONG = "建议看多"
DECISION_SEMANTIC_WATCH = "建议观察"
DECISION_SEMANTIC_DEFENSE = "建议防守"
DECISION_SEMANTIC_NO_SIGNAL = "暂无信号"

CANONICAL_DECISION_SEMANTICS = (
    DECISION_SEMANTIC_LONG,
    DECISION_SEMANTIC_WATCH,
    DECISION_SEMANTIC_DEFENSE,
    DECISION_SEMANTIC_NO_SIGNAL,
)

# Keep action-layer semantics explicit even when they currently share labels.
ACTION_DECISION_IDS = ("ENTER_LONG", "WATCH", "DEFEND", "NO_SIGNAL")
ACTION_SEMANTICS = CANONICAL_DECISION_SEMANTICS

DECISION_SEMANTIC_ALIASES = {
    "建议进场": DECISION_SEMANTIC_LONG,
    "进场": DECISION_SEMANTIC_LONG,
    "空仓": DECISION_SEMANTIC_NO_SIGNAL,
    "建议空仓": DECISION_SEMANTIC_NO_SIGNAL,
    "防守": DECISION_SEMANTIC_DEFENSE,
    "观察": DECISION_SEMANTIC_WATCH,
}

DECISION_ALIAS_LONG = (DECISION_SEMANTIC_LONG, "建议进场", "进场")
DECISION_ALIAS_WATCH = (DECISION_SEMANTIC_WATCH, "观察")
DECISION_ALIAS_DEFENSE = (DECISION_SEMANTIC_DEFENSE, "防守")
DECISION_ALIAS_NO_SIGNAL = (DECISION_SEMANTIC_NO_SIGNAL, "建议空仓", "空仓")


def normalize_decision_semantic(
    value: object,
    default: str = DECISION_SEMANTIC_NO_SIGNAL,
) -> str:
    raw = str(value or "").strip()
    if not raw:
        return default
    if raw in CANONICAL_DECISION_SEMANTICS:
        return raw
    return DECISION_SEMANTIC_ALIASES.get(raw, raw)


def is_canonical_decision_semantic(value: object) -> bool:
    return normalize_decision_semantic(value, "") in CANONICAL_DECISION_SEMANTICS


def semantic_from_layer1(
    layer1_status: Optional[str],
    signal: Optional[str],
) -> str:
    if layer1_status == "TriggeredLong":
        return DECISION_SEMANTIC_LONG
    if layer1_status == "Watch":
        return DECISION_SEMANTIC_WATCH
    if layer1_status == "RiskOff":
        return DECISION_SEMANTIC_DEFENSE
    if layer1_status == "NoSetup":
        return DECISION_SEMANTIC_NO_SIGNAL
    if signal == "Long":
        return DECISION_SEMANTIC_LONG
    return DECISION_SEMANTIC_WATCH
