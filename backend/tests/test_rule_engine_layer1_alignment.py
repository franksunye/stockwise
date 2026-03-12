import asyncio
import json

from backend.engine.models.rule_based import RuleAdapter


class _FakeSignal:
    def __init__(self, action: str):
        self.action = action
        self.confidence = 0.7
        self.reason = "规则引擎原始信号"
        self.factors = {"ma20": 100.0, "rsi": 45.0, "macd_hist": -0.2}


class _FakeRunResult:
    def __init__(self, action: str):
        self.signal = _FakeSignal(action)


class _FakeEngine:
    def __init__(self, action: str):
        self._action = action

    def run(self, symbol, context, mode):
        return _FakeRunResult(self._action)


class _FakeCursor:
    description = [("date",)]

    def execute(self, sql, args):
        return None

    def fetchone(self):
        return None


class _FakeConn:
    def cursor(self):
        return _FakeCursor()

    def close(self):
        return None


def _patch_engine(monkeypatch, action: str):
    monkeypatch.setattr("backend.quant.engine.QuantEngine", lambda: _FakeEngine(action))
    monkeypatch.setattr("backend.database.get_connection", lambda: _FakeConn())


def test_rule_engine_aligns_to_layer1_riskoff(monkeypatch):
    _patch_engine(monkeypatch, "Short")
    adapter = RuleAdapter(model_id="rule-engine", config={"display_name": "Rule Engine"})
    out = asyncio.run(
        adapter.predict(
            "600519",
            "2026-03-05",
            {
                "daily_prices": [{"close": 99.0, "boll_lower": 95.0}],
                "layer1": {"status": "RiskOff"},
            },
        )
    )

    assert out["signal"] == "RiskOff"
    reasoning = json.loads(out["reasoning"])
    assert reasoning["signal"] == "RiskOff"
    assert "风险收缩区" in reasoning["summary"]
    assert reasoning["tactics"]["empty"][0]["action"] == "暂停新增仓位"
    assert reasoning["tactics"]["holding_profit"][0]["action"] == "已有仓位应收缩"


def test_rule_engine_aligns_to_layer1_triggered_long(monkeypatch):
    _patch_engine(monkeypatch, "Short")
    adapter = RuleAdapter(model_id="rule-engine", config={"display_name": "Rule Engine"})
    out = asyncio.run(
        adapter.predict(
            "600519",
            "2026-03-05",
            {
                "daily_prices": [{"close": 101.0, "boll_lower": 96.0}],
                "layer1": {"status": "TriggeredLong"},
            },
        )
    )

    assert out["signal"] == "TriggeredLong"
    reasoning = json.loads(out["reasoning"])
    assert reasoning["signal"] == "TriggeredLong"
    assert "可尝试建仓区间" in reasoning["summary"]
    assert reasoning["tactics"]["empty"][0]["action"] == "可尝试建仓"
