from backend.engine.layer1_state import (
    evaluate_layer1_state,
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

    strategy_version, params = load_market_params("CN", strategy_version="tradeability_v2")
    assert strategy_version == "tradeability_v2"
    assert params["momentum_change_threshold"] == 2.8
