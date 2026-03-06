from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Sequence

from backend.logger import logger
from backend.trading_calendar import get_market_from_symbol

STRATEGY_CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "strategy_config")
SETUP_STATES = {"NoSetup", "Watch", "TriggeredLong", "RiskOff"}
DEFAULT_STRATEGY_VERSION = "tradeability_v2"
STRATEGY_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "tradeability_v1": {
        "params_file": os.path.join(STRATEGY_CONFIG_DIR, "tradeability_params_v1.json"),
        "params": {
            "vcp_ratio": 0.9,
            "breakout_volume_mult": 1.1,
            "strong_close_threshold": 0.65,
            "momentum_change_threshold": 4.0,
            "risk_off_ma": 10.0,
        },
    },
    "tradeability_v2": {
        "params_file": os.path.join(STRATEGY_CONFIG_DIR, "tradeability_params_v2.json"),
        "params": {
            "vcp_ratio": 0.95,
            "breakout_volume_mult": 1.0,
            "strong_close_threshold": 0.60,
            "momentum_change_threshold": 2.8,
            "risk_off_ma": 10.0,
        },
    },
}
PARAMS_FILE_DEFAULT = STRATEGY_DEFAULTS[DEFAULT_STRATEGY_VERSION]["params_file"]
COMMON_PARAM_KEYS = ("vcp_ratio", "breakout_volume_mult", "strong_close_threshold", "momentum_change_threshold", "risk_off_ma")


@dataclass
class Layer1Snapshot:
    setup_state: str
    opportunity_score: float
    trigger_rule_hit: int
    risk_off_hit: int
    strategy_version: str
    payload: Dict[str, Any]


def _safe_float(v: Any) -> float:
    try:
        if v is None:
            return 0.0
        return float(v)
    except Exception:
        return 0.0


def _mean(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / float(len(values))


def _calc_amp(bar: Dict[str, Any]) -> float:
    close = _safe_float(bar.get("close"))
    high = _safe_float(bar.get("high"))
    low = _safe_float(bar.get("low"))
    if close <= 0:
        return 0.0
    return (high - low) / close


def list_supported_strategy_versions() -> Sequence[str]:
    return tuple(STRATEGY_DEFAULTS.keys())


def resolve_params_file(strategy_version: str = DEFAULT_STRATEGY_VERSION, params_file: str | None = None) -> str:
    if params_file:
        return params_file
    return str((STRATEGY_DEFAULTS.get(strategy_version) or STRATEGY_DEFAULTS[DEFAULT_STRATEGY_VERSION])["params_file"])


def _default_params_for(strategy_version: str) -> Dict[str, float]:
    return dict((STRATEGY_DEFAULTS.get(strategy_version) or STRATEGY_DEFAULTS[DEFAULT_STRATEGY_VERSION])["params"])


def _normalize_params(raw_params: Dict[str, Any], strategy_version: str = DEFAULT_STRATEGY_VERSION) -> Dict[str, float]:
    out = _default_params_for(strategy_version)
    for key in COMMON_PARAM_KEYS:
        if key in raw_params:
            out[key] = _safe_float(raw_params[key])
    out["risk_off_ma"] = float(int(out["risk_off_ma"]))
    if int(out["risk_off_ma"]) not in {5, 10, 20}:
        out["risk_off_ma"] = 10.0
    return out


def load_market_params(
    market: str,
    params_file: str | None = None,
    strategy_version: str = DEFAULT_STRATEGY_VERSION,
) -> tuple[str, Dict[str, float]]:
    resolved_version = strategy_version if strategy_version in STRATEGY_DEFAULTS else DEFAULT_STRATEGY_VERSION
    resolved_file = resolve_params_file(strategy_version=resolved_version, params_file=params_file)
    params = _default_params_for(resolved_version)
    try:
        with open(resolved_file, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        resolved_version = str(cfg.get("strategy_version") or resolved_version)
        params = _normalize_params(((cfg.get("markets") or {}).get(market) or {}), strategy_version=resolved_version)
    except Exception as e:
        logger.warning(f"Layer1 params load failed, fallback defaults. market={market}, error={e}")
    return resolved_version, params


def _base_fields(bar: Dict[str, Any], prev: Dict[str, Any], params: Dict[str, float]) -> Dict[str, Any]:
    close = _safe_float(bar.get("close"))
    high = _safe_float(bar.get("high"))
    low = _safe_float(bar.get("low"))
    volume = _safe_float(bar.get("volume"))
    ma5 = _safe_float(bar.get("ma5"))
    ma10 = _safe_float(bar.get("ma10"))
    ma20 = _safe_float(bar.get("ma20"))
    macd_hist = _safe_float(bar.get("macd_hist"))
    prev_macd_hist = _safe_float(prev.get("macd_hist"))
    change_percent = _safe_float(bar.get("change_percent"))
    risk_off_ma = int(_safe_float(params.get("risk_off_ma")))

    ma_line = ma10
    if risk_off_ma == 5:
        ma_line = ma5
    elif risk_off_ma == 20:
        ma_line = ma20

    return {
        "close": close,
        "high": high,
        "low": low,
        "volume": volume,
        "ma5": ma5,
        "ma10": ma10,
        "ma20": ma20,
        "macd_hist": macd_hist,
        "prev_macd_hist": prev_macd_hist,
        "change_percent": change_percent,
        "risk_off_ma": risk_off_ma,
        "ma_line": ma_line,
    }


def _evaluate_v1(
    bar: Dict[str, Any],
    prev: Dict[str, Any],
    amp5: float,
    amp20: float,
    prev_vol5: float,
    params: Dict[str, float],
) -> Dict[str, Any]:
    fields = _base_fields(bar, prev, params)
    vcp_ratio = _safe_float(params.get("vcp_ratio"))
    breakout_volume_mult = _safe_float(params.get("breakout_volume_mult"))
    strong_close_threshold = _safe_float(params.get("strong_close_threshold"))
    momentum_change_threshold = _safe_float(params.get("momentum_change_threshold"))

    cond_vcp_like = amp20 > 0 and amp5 < amp20 * vcp_ratio
    cond_breakout = (
        prev_vol5 > 0
        and fields["volume"] > breakout_volume_mult * prev_vol5
        and fields["close"] > fields["ma10"]
        and fields["close"] > fields["ma20"]
    )
    denom = fields["high"] - fields["low"]
    cond_strong_close = denom > 0 and ((fields["close"] - fields["low"]) / denom) >= strong_close_threshold
    cond_momentum = (
        fields["change_percent"] > momentum_change_threshold
        or fields["macd_hist"] > fields["prev_macd_hist"]
    )
    watch = cond_vcp_like and cond_breakout
    trigger = watch and cond_strong_close and cond_momentum
    risk_off = fields["close"] > 0 and fields["ma_line"] > 0 and fields["close"] < fields["ma_line"]

    score = 0.0
    if cond_vcp_like:
        score += 20.0
    if cond_breakout:
        score += 30.0
    if cond_strong_close:
        score += 20.0
    if cond_momentum:
        score += 15.0
    if fields["close"] > fields["ma20"] and fields["ma20"] > 0:
        score += 10.0
    if fields["close"] > fields["ma10"] and fields["ma10"] > 0:
        score += 5.0

    return {
        **fields,
        "cond_vcp_like": cond_vcp_like,
        "cond_breakout": cond_breakout,
        "cond_strong_close": cond_strong_close,
        "cond_momentum": cond_momentum,
        "watch": watch,
        "trigger": trigger,
        "risk_off": risk_off,
        "score": score,
        "params": {
            "vcp_ratio": vcp_ratio,
            "breakout_volume_mult": breakout_volume_mult,
            "strong_close_threshold": strong_close_threshold,
            "momentum_change_threshold": momentum_change_threshold,
            "risk_off_ma": fields["risk_off_ma"],
        },
        "version_logic": "strict_breakout_confirmation",
    }


def _evaluate_v2(
    bar: Dict[str, Any],
    prev: Dict[str, Any],
    amp5: float,
    amp20: float,
    prev_vol5: float,
    params: Dict[str, float],
) -> Dict[str, Any]:
    fields = _base_fields(bar, prev, params)
    vcp_ratio = _safe_float(params.get("vcp_ratio"))
    breakout_volume_mult = _safe_float(params.get("breakout_volume_mult"))
    strong_close_threshold = _safe_float(params.get("strong_close_threshold"))
    momentum_change_threshold = _safe_float(params.get("momentum_change_threshold"))

    cond_vcp_like = amp20 > 0 and amp5 < amp20 * vcp_ratio
    cond_base_trend = fields["close"] > fields["ma10"] and fields["close"] > fields["ma20"]
    cond_breakout = prev_vol5 > 0 and fields["volume"] >= breakout_volume_mult * prev_vol5 and cond_base_trend
    cond_breakout_soft = (
        prev_vol5 > 0
        and fields["volume"] >= max(1.0, breakout_volume_mult - 0.1) * prev_vol5
        and fields["close"] > fields["ma10"]
    )
    denom = fields["high"] - fields["low"]
    cond_strong_close = denom > 0 and ((fields["close"] - fields["low"]) / denom) >= strong_close_threshold
    cond_momentum = (
        fields["change_percent"] >= momentum_change_threshold
        or fields["macd_hist"] >= fields["prev_macd_hist"]
    )
    cond_momentum_recovery = (
        fields["change_percent"] >= max(0.5, momentum_change_threshold - 0.8)
        or fields["macd_hist"] > 0
    )
    watch = cond_vcp_like and cond_base_trend and (cond_breakout_soft or cond_momentum_recovery)
    trigger = watch and cond_strong_close and (cond_breakout or cond_momentum)
    risk_off = fields["close"] > 0 and fields["ma_line"] > 0 and fields["close"] < fields["ma_line"]

    score = 0.0
    if cond_vcp_like:
        score += 18.0
    if cond_base_trend:
        score += 20.0
    if cond_breakout:
        score += 22.0
    if cond_breakout_soft:
        score += 8.0
    if cond_strong_close:
        score += 14.0
    if cond_momentum:
        score += 12.0
    if cond_momentum_recovery:
        score += 6.0

    return {
        **fields,
        "cond_vcp_like": cond_vcp_like,
        "cond_base_trend": cond_base_trend,
        "cond_breakout": cond_breakout,
        "cond_breakout_soft": cond_breakout_soft,
        "cond_strong_close": cond_strong_close,
        "cond_momentum": cond_momentum,
        "cond_momentum_recovery": cond_momentum_recovery,
        "watch": watch,
        "trigger": trigger,
        "risk_off": risk_off,
        "score": score,
        "params": {
            "vcp_ratio": vcp_ratio,
            "breakout_volume_mult": breakout_volume_mult,
            "strong_close_threshold": strong_close_threshold,
            "momentum_change_threshold": momentum_change_threshold,
            "risk_off_ma": fields["risk_off_ma"],
        },
        "version_logic": "coverage_expansion_with_same_states",
    }


def evaluate_layer1_state(
    daily_history: Sequence[Dict[str, Any]],
    params: Dict[str, float],
    strategy_version: str,
) -> Layer1Snapshot:
    if len(daily_history) < 21:
        return Layer1Snapshot(
            setup_state="NoSetup",
            opportunity_score=0.0,
            trigger_rule_hit=0,
            risk_off_hit=0,
            strategy_version=strategy_version,
            payload={"reason": "insufficient_history", "history_len": len(daily_history)},
        )

    history = list(daily_history)
    i = len(history) - 1
    bar = history[i]
    prev = history[i - 1]

    amp5 = _mean([_calc_amp(x) for x in history[i - 4 : i + 1]])
    amp20 = _mean([_calc_amp(x) for x in history[i - 19 : i + 1]])
    prev_vol5 = _mean([_safe_float(x.get("volume")) for x in history[i - 5 : i]])
    normalized_params = _normalize_params(params, strategy_version=strategy_version)

    evaluator = _evaluate_v2 if strategy_version == "tradeability_v2" else _evaluate_v1
    metrics = evaluator(bar=bar, prev=prev, amp5=amp5, amp20=amp20, prev_vol5=prev_vol5, params=normalized_params)

    if metrics["trigger"]:
        setup_state = "TriggeredLong"
    elif metrics["watch"]:
        setup_state = "Watch"
    elif metrics["risk_off"]:
        setup_state = "RiskOff"
    else:
        setup_state = "NoSetup"

    payload = {
        "latest_date": bar.get("date"),
        "amp5": round(amp5, 6),
        "amp20": round(amp20, 6),
        "prev_vol5": round(prev_vol5, 2),
        **metrics,
    }
    return Layer1Snapshot(
        setup_state=setup_state,
        opportunity_score=round(max(0.0, min(100.0, _safe_float(metrics["score"]))), 2),
        trigger_rule_hit=1 if metrics["trigger"] else 0,
        risk_off_hit=1 if metrics["risk_off"] else 0,
        strategy_version=strategy_version,
        payload=payload,
    )


def build_layer1_snapshot(
    symbol: str,
    daily_history: Sequence[Dict[str, Any]],
    params_file: str | None = None,
    strategy_version: str = DEFAULT_STRATEGY_VERSION,
) -> Layer1Snapshot:
    market = get_market_from_symbol(symbol)
    loaded_strategy_version, params = load_market_params(
        market=market,
        params_file=params_file,
        strategy_version=strategy_version,
    )
    return evaluate_layer1_state(daily_history=daily_history, params=params, strategy_version=loaded_strategy_version)


def map_layer1_to_legacy_signal(setup_state: str) -> str:
    if setup_state == "TriggeredLong":
        return "Long"
    if setup_state in {"NoSetup", "Watch", "RiskOff"}:
        return "Side"
    return "Side"
