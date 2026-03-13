import os
import sys


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(ROOT_DIR)
sys.path.append(os.path.join(ROOT_DIR, "backend"))

from backend.engine.prompts import (
    _should_inject_layer1_prompt_context,
    _resolve_stock_analysis_prompt_variant,
    _resolve_stock_analysis_template_names,
)


def test_prompt_variant_defaults_to_b2(monkeypatch):
    monkeypatch.delenv("STOCK_ANALYSIS_PROMPT_VARIANT", raising=False)
    assert _resolve_stock_analysis_prompt_variant() == "b2"
    assert _resolve_stock_analysis_template_names() == (
        "prompts/stock_analysis_system_b2.j2",
        "prompts/stock_analysis_user_b2.j2",
    )


def test_prompt_variant_switches_to_b2(monkeypatch):
    monkeypatch.setenv("STOCK_ANALYSIS_PROMPT_VARIANT", "b2")
    assert _resolve_stock_analysis_prompt_variant() == "b2"
    assert _resolve_stock_analysis_template_names() == (
        "prompts/stock_analysis_system_b2.j2",
        "prompts/stock_analysis_user_b2.j2",
    )


def test_prompt_variant_invalid_value_falls_back_to_b2(monkeypatch):
    monkeypatch.setenv("STOCK_ANALYSIS_PROMPT_VARIANT", "unknown")
    assert _resolve_stock_analysis_prompt_variant() == "b2"


def test_layer1_prompt_injection_defaults_disabled(monkeypatch):
    monkeypatch.delenv("LAYER1_PROMPT_INJECTION", raising=False)
    assert _should_inject_layer1_prompt_context() is False


def test_layer1_prompt_injection_can_be_disabled(monkeypatch):
    monkeypatch.setenv("LAYER1_PROMPT_INJECTION", "0")
    assert _should_inject_layer1_prompt_context() is False
