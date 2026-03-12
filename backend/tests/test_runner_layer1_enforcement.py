import json
import logging

from backend.engine.runner import _enforce_layer1_direction


def test_enforce_layer1_triggeredlong_to_triggeredlong(monkeypatch):
    monkeypatch.setenv("LAYER1_SIGNAL_ENFORCE", "1")
    result = {"signal": "Side", "confidence": 0.7}
    out = _enforce_layer1_direction(result, {"status": "TriggeredLong"})
    assert out["signal"] == "TriggeredLong"


def test_enforce_layer1_riskoff_to_riskoff(monkeypatch):
    monkeypatch.setenv("LAYER1_SIGNAL_ENFORCE", "1")
    result = {"signal": "Short", "confidence": 0.8}
    out = _enforce_layer1_direction(result, {"status": "RiskOff"})
    assert out["signal"] == "RiskOff"


def test_disable_enforcement_keeps_model_signal(monkeypatch):
    monkeypatch.setenv("LAYER1_SIGNAL_ENFORCE", "0")
    result = {"signal": "Short", "confidence": 0.8}
    out = _enforce_layer1_direction(result, {"status": "RiskOff"})
    assert out["signal"] == "Short"


def test_enforcement_syncs_reasoning_json_signal(monkeypatch):
    monkeypatch.setenv("LAYER1_SIGNAL_ENFORCE", "1")
    result = {
        "signal": "Side",
        "confidence": 0.8,
        "reasoning": json.dumps({"signal": "Side", "summary": "观望"}),
    }
    out = _enforce_layer1_direction(result, {"status": "RiskOff"})
    assert out["signal"] == "RiskOff"
    assert json.loads(out["reasoning"])["signal"] == "RiskOff"


def test_enforcement_logs_legacy_enum_inertia(monkeypatch, caplog):
    monkeypatch.setenv("LAYER1_SIGNAL_ENFORCE", "1")
    caplog.set_level(logging.WARNING)
    result = {"signal": "Side", "confidence": 0.7}
    out = _enforce_layer1_direction(result, {"status": "NoSetup"})
    assert out["signal"] == "NoSetup"
    assert "legacy enum inertia" in caplog.text
