from backend.engine.chain.steps.synthesis import SynthesisStep


def test_synthesis_applies_riskoff_action_language():
    step = SynthesisStep(step_name="synthesis", config={})
    parsed = {
        "summary": "技术面转弱",
        "tactics": {
            "holding_profit": [{"action": "持仓观察", "trigger": "原始", "reason": "原始"}],
            "holding_loss": [{"action": "严格止损", "trigger": "原始", "reason": "原始"}],
            "empty": [{"action": "观望为主", "trigger": "原始", "reason": "原始"}],
        },
    }

    out = step._apply_layer1_action_language(parsed, "RiskOff")

    assert "风险收缩区" in out["summary"]
    assert out["tactics"]["holding_profit"][0]["action"] == "已有仓位应收缩"
    assert out["tactics"]["holding_loss"][0]["action"] == "跌破纪律位应退出"
    assert out["tactics"]["empty"][0]["action"] == "暂停新增仓位"


def test_synthesis_applies_triggeredlong_action_language():
    step = SynthesisStep(step_name="synthesis", config={})
    parsed = {
        "summary": "量价共振改善",
        "tactics": {
            "holding_profit": [{}],
            "holding_loss": [{}],
            "empty": [{}],
        },
    }

    out = step._apply_layer1_action_language(parsed, "TriggeredLong")

    assert "可尝试建仓区间" in out["summary"]
    assert out["tactics"]["empty"][0]["action"] == "可尝试建仓"
    assert out["tactics"]["holding_profit"][0]["action"] == "持仓观察"
