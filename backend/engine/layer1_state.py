from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Sequence

from backend.logger import logger
from backend.trading_calendar import get_market_from_symbol

PARAMS_FILE_DEFAULT = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "strategy_config",
    "tradeability_params_v1.json",
)

SETUP_STATES = {"NoSetup", "Watch", "TriggeredLong", "RiskOff"}
DEFAULT_PARAMS: Dict[str, float] = {
    "vcp_ratio": 0.9,
    "breakout_volume_mult": 1.1,
    "strong_close_threshold": 0.65,
    "momentum_change_threshold": 4.0,
    "risk_off_ma": 10.0,
}
DEFAULT_STRATEGY_VERSION = "tradeability_v1"


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


def _normalize_params(raw_params: Dict[str, Any]) -> Dict[str, float]:
    out = dict(DEFAULT_PARAMS)
    for k in DEFAULT_PARAMS:
        if k in raw_params:
            out[k] = _safe_float(raw_params[k])
    out["risk_off_ma"] = float(int(out["risk_off_ma"]))
    if int(out["risk_off_ma"]) not in {5, 10, 20}:
        out["risk_off_ma"] = 10.0
    return out


def load_market_params(market: str, params_file: str = PARAMS_FILE_DEFAULT) -> tuple[str, Dict[str, float]]:
    strategy_version = DEFAULT_STRATEGY_VERSION
    params = dict(DEFAULT_PARAMS)
    try:
        with open(params_file, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        strategy_version = str(cfg.get("strategy_version") or DEFAULT_STRATEGY_VERSION)
        market_cfg = ((cfg.get("markets") or {}).get(market) or {})
        params = _normalize_params(market_cfg)
    except Exception as e:
        logger.warning(f"⚠️ Layer1 params load failed, fallback defaults. market={market}, error={e}")
    return strategy_version, params


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

    vcp_ratio = _safe_float(params.get("vcp_ratio"))
    breakout_volume_mult = _safe_float(params.get("breakout_volume_mult"))
    strong_close_threshold = _safe_float(params.get("strong_close_threshold"))
    momentum_change_threshold = _safe_float(params.get("momentum_change_threshold"))
    risk_off_ma = int(_safe_float(params.get("risk_off_ma")))

    cond_vcp_like = amp20 > 0 and amp5 < amp20 * vcp_ratio
    cond_breakout = prev_vol5 > 0 and volume > breakout_volume_mult * prev_vol5 and close > ma10 and close > ma20
    denom = high - low
    cond_strong_close = denom > 0 and ((close - low) / denom) >= strong_close_threshold
    cond_momentum = change_percent > momentum_change_threshold or macd_hist > prev_macd_hist

    watch = cond_vcp_like and cond_breakout
    trigger = watch and cond_strong_close and cond_momentum

    ma_line = ma10
    if risk_off_ma == 5:
        ma_line = ma5
    elif risk_off_ma == 20:
        ma_line = ma20
    risk_off = close > 0 and ma_line > 0 and close < ma_line

    if trigger:
        setup_state = "TriggeredLong"
    elif watch:
        setup_state = "Watch"
    elif risk_off:
        setup_state = "RiskOff"
    else:
        setup_state = "NoSetup"

    score = 0.0
    if cond_vcp_like:
        score += 20.0
    if cond_breakout:
        score += 30.0
    if cond_strong_close:
        score += 20.0
    if cond_momentum:
        score += 15.0
    if close > ma20 and ma20 > 0:
        score += 10.0
    if close > ma10 and ma10 > 0:
        score += 5.0
    score = max(0.0, min(100.0, score))

    payload = {
        "latest_date": bar.get("date"),
        "cond_vcp_like": cond_vcp_like,
        "cond_breakout": cond_breakout,
        "cond_strong_close": cond_strong_close,
        "cond_momentum": cond_momentum,
        "watch": watch,
        "trigger": trigger,
        "risk_off": risk_off,
        "amp5": round(amp5, 6),
        "amp20": round(amp20, 6),
        "prev_vol5": round(prev_vol5, 2),
        "close": close,
        "ma5": ma5,
        "ma10": ma10,
        "ma20": ma20,
        "params": {
            "vcp_ratio": vcp_ratio,
            "breakout_volume_mult": breakout_volume_mult,
            "strong_close_threshold": strong_close_threshold,
            "momentum_change_threshold": momentum_change_threshold,
            "risk_off_ma": risk_off_ma,
        },
    }
    return Layer1Snapshot(
        setup_state=setup_state,
        opportunity_score=round(score, 2),
        trigger_rule_hit=1 if trigger else 0,
        risk_off_hit=1 if risk_off else 0,
        strategy_version=strategy_version,
        payload=payload,
    )


def build_layer1_snapshot(
    symbol: str,
    daily_history: Sequence[Dict[str, Any]],
    params_file: str = PARAMS_FILE_DEFAULT,
) -> Layer1Snapshot:
    market = get_market_from_symbol(symbol)
    strategy_version, params = load_market_params(market=market, params_file=params_file)
    return evaluate_layer1_state(daily_history=daily_history, params=params, strategy_version=strategy_version)


def map_layer1_to_legacy_signal(setup_state: str) -> str:
    if setup_state == "TriggeredLong":
        return "Long"
    if setup_state in {"NoSetup", "Watch", "RiskOff"}:
        return "Side"
    return "Side"
