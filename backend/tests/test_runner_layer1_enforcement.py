from backend.engine.runner import _enforce_layer1_direction


def test_enforce_layer1_triggeredlong_to_long(monkeypatch):
    monkeypatch.setenv("LAYER1_SIGNAL_ENFORCE", "1")
    result = {"signal": "Side", "confidence": 0.7}
    out = _enforce_layer1_direction(result, {"status": "TriggeredLong"})
    assert out["signal"] == "Long"


def test_enforce_layer1_riskoff_to_side(monkeypatch):
    monkeypatch.setenv("LAYER1_SIGNAL_ENFORCE", "1")
    result = {"signal": "Short", "confidence": 0.8}
    out = _enforce_layer1_direction(result, {"status": "RiskOff"})
    assert out["signal"] == "Side"


def test_disable_enforcement_keeps_model_signal(monkeypatch):
    monkeypatch.setenv("LAYER1_SIGNAL_ENFORCE", "0")
    result = {"signal": "Short", "confidence": 0.8}
    out = _enforce_layer1_direction(result, {"status": "RiskOff"})
    assert out["signal"] == "Short"
