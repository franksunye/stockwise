import json
import os
import tempfile

from backend.engine.layer1_state import (
    _load_bundle_config_cached,
    evaluate_layer1_state,
    list_supported_params_bundles,
    list_supported_strategy_versions,
    load_market_params,
    map_layer1_to_legacy_signal,
)


def _bar(
    date: str,
    high: float,
    low: float,
    close: float,
    volume: float,
    ma5: float,
    ma10: float,
    ma20: float,
    macd_hist: float,
    change_percent: float,
):
    return {
        "date": date,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
        "ma5": ma5,
        "ma10": ma10,
        "ma20": ma20,
        "macd_hist": macd_hist,
        "change_percent": change_percent,
    }


def test_layer1_triggered_long():
    history = []
    # First 16 bars: wider amplitude
    for i in range(16):
        history.append(_bar(f"2026-02-{i+1:02d}", 12.0, 8.0, 10.0, 100.0, 9.8, 9.7, 9.6, 0.1, 0.5))
    # Last 4 bars before latest: tighter amplitude, lower volume
    for i in range(4):
        history.append(_bar(f"2026-02-{17+i:02d}", 10.2, 9.8, 10.0, 100.0, 9.9, 9.8, 9.7, 0.1, 0.8))
    # Latest bar: breakout + strong close + momentum
    history.append(_bar("2026-02-21", 11.0, 10.0, 10.9, 200.0, 10.1, 10.2, 10.1, 0.3, 4.5))

    params = {
        "vcp_ratio": 0.9,
        "breakout_volume_mult": 1.1,
        "strong_close_threshold": 0.65,
        "momentum_change_threshold": 4.0,
        "risk_off_ma": 10,
    }
    result = evaluate_layer1_state(history, params, "tradeability_v1")
    assert result.setup_state == "TriggeredLong"
    assert result.trigger_rule_hit == 1
    assert result.opportunity_score >= 60


def test_layer1_risk_off():
    history = []
    for i in range(20):
        history.append(_bar(f"2026-02-{i+1:02d}", 10.6, 9.4, 10.0, 100.0, 10.0, 10.0, 10.0, 0.1, 0.5))
    # Latest bar closes below MA10, while setup conditions remain false
    history.append(_bar("2026-02-21", 10.1, 9.6, 9.7, 95.0, 9.9, 10.1, 10.0, 0.05, -0.8))

    params = {
        "vcp_ratio": 0.9,
        "breakout_volume_mult": 1.1,
        "strong_close_threshold": 0.65,
        "momentum_change_threshold": 4.0,
        "risk_off_ma": 10,
    }
    result = evaluate_layer1_state(history, params, "tradeability_v1")
    assert result.setup_state == "RiskOff"
    assert result.risk_off_hit == 1


def test_layer1_legacy_mapping():
    assert map_layer1_to_legacy_signal("TriggeredLong") == "Long"
    assert map_layer1_to_legacy_signal("Watch") == "Side"
    assert map_layer1_to_legacy_signal("NoSetup") == "Side"
    assert map_layer1_to_legacy_signal("RiskOff") == "Side"


def test_layer1_v2_is_supported_and_relaxes_trigger_path():
    history = []
    for i in range(16):
        history.append(_bar(f"2026-02-{i+1:02d}", 12.0, 8.0, 10.0, 100.0, 9.8, 9.7, 9.6, 0.1, 0.5))
    for i in range(4):
        history.append(_bar(f"2026-02-{17+i:02d}", 10.2, 9.8, 10.0, 100.0, 9.9, 9.8, 9.7, 0.1, 0.8))
    history.append(_bar("2026-02-21", 10.9, 10.0, 10.7, 105.0, 10.1, 10.2, 10.1, 0.15, 3.0))

    v1_params = {
        "vcp_ratio": 0.9,
        "breakout_volume_mult": 1.1,
        "strong_close_threshold": 0.65,
        "momentum_change_threshold": 4.0,
        "risk_off_ma": 10,
    }
    v2_params = {
        "vcp_ratio": 0.95,
        "breakout_volume_mult": 1.0,
        "strong_close_threshold": 0.6,
        "momentum_change_threshold": 2.8,
        "risk_off_ma": 10,
    }

    v1 = evaluate_layer1_state(history, v1_params, "tradeability_v1")
    v2 = evaluate_layer1_state(history, v2_params, "tradeability_v2")

    assert v1.setup_state in {"NoSetup", "Watch"}
    assert v2.setup_state == "TriggeredLong"
    assert v2.payload["version_logic"] == "coverage_expansion_with_same_states"


def test_load_market_params_and_version_registry():
    assert "tradeability_v1" in list_supported_strategy_versions()
    assert "tradeability_v2" in list_supported_strategy_versions()
    assert "steady" in list_supported_params_bundles()
    assert "balanced" in list_supported_params_bundles()
    assert "aggressive" in list_supported_params_bundles()

    strategy_version, params = load_market_params("CN", strategy_version="tradeability_v2")
    assert strategy_version == "tradeability_v2"
    assert params["momentum_change_threshold"] == 1.7

    _, steady_params = load_market_params("CN", strategy_version="tradeability_v2", params_bundle="steady")
    _, aggressive_params = load_market_params("CN", strategy_version="tradeability_v2", params_bundle="aggressive")
    assert steady_params["breakout_volume_mult"] > params["breakout_volume_mult"]
    assert aggressive_params["momentum_change_threshold"] < params["momentum_change_threshold"]


def test_load_market_params_prefers_bundle_release_file():
    release = {
        "config_version": "mode_params_bundles_v1",
        "strategy_version": "tradeability_v2",
        "bundles": {
            "balanced": {"default": {}},
            "steady": {"default": {"breakout_volume_mult": 1.08}},
            "aggressive": {"default": {"momentum_change_threshold": 1.1}},
            "observe_only": {"default": {}},
        },
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tmp:
        json.dump(release, tmp, ensure_ascii=False)
        tmp.write("\n")
        tmp_path = tmp.name

    original = os.environ.get("MODE_PARAMS_BUNDLES_FILE")
    os.environ["MODE_PARAMS_BUNDLES_FILE"] = tmp_path
    _load_bundle_config_cached.cache_clear()
    try:
        _, steady_params = load_market_params("CN", strategy_version="tradeability_v2", params_bundle="steady")
        _, aggressive_params = load_market_params("CN", strategy_version="tradeability_v2", params_bundle="aggressive")
        assert steady_params["breakout_volume_mult"] == 1.08
        assert aggressive_params["momentum_change_threshold"] == 1.1
    finally:
        if original is None:
            os.environ.pop("MODE_PARAMS_BUNDLES_FILE", None)
        else:
            os.environ["MODE_PARAMS_BUNDLES_FILE"] = original
        _load_bundle_config_cached.cache_clear()
        os.remove(tmp_path)


def test_layer1_fallback_indicator_engine_when_ma_missing():
    history = []
    for i in range(21):
        history.append({
            "date": f"2026-03-{i+1:02d}",
            "high": 10.5,
            "low": 9.5,
            "close": 10.0 + i * 0.01,
            "volume": 100 + i,
            "macd_hist": 0.1,
            "change_percent": 0.6,
        })

    params = {
        "vcp_ratio": 0.95,
        "breakout_volume_mult": 1.0,
        "strong_close_threshold": 0.60,
        "momentum_change_threshold": 2.8,
        "risk_off_ma": 10,
    }
    result = evaluate_layer1_state(history, params, "tradeability_v2")
    assert result.payload.get("indicator_engine") in {"pandas_ta", "native_rolling"}
    assert result.payload.get("ma10", 0) > 0
    assert result.payload.get("ma20", 0) > 0


def test_layer1_uses_precomputed_indicators_when_present():
    history = []
    for i in range(21):
        history.append(_bar(
            f"2026-04-{i+1:02d}",
            10.5,
            9.5,
            10.0,
            120.0,
            9.8,
            9.9,
            10.0,
            0.1,
            0.5,
        ))

    params = {
        "vcp_ratio": 0.95,
        "breakout_volume_mult": 1.0,
        "strong_close_threshold": 0.60,
        "momentum_change_threshold": 2.8,
        "risk_off_ma": 10,
    }
    result = evaluate_layer1_state(history, params, "tradeability_v2")
    assert result.payload.get("indicator_engine") == "precomputed"
