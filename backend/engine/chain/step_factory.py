from typing import Dict, Any, List
from .steps.base import BaseStep
from .steps.anchor import DataAnchorStep
from .steps.analysis import IndicatorStep, MultiPeriodStep
from .steps.synthesis import SynthesisStep

class StepFactory:
    """
    Registry of available chain steps.
    Supports dynamic instantiation via config.
    """
    _REGISTRY = {
        "anchor": DataAnchorStep,
        "indicator": IndicatorStep,
        "multi_period": MultiPeriodStep,
        "synthesis": SynthesisStep
    }

    @classmethod
    def create_steps(cls, step_configs: List[Dict[str, Any]]) -> List[BaseStep]:
        steps = []
        for item in step_configs:
            step_type = item.get("type")
            config = item.get("config", {})
            
            step_cls = cls._REGISTRY.get(step_type)
            if not step_cls:
                raise ValueError(f"Unknown step type: {step_type}")
            
            # Pass step_name as step_type by default
            steps.append(step_cls(step_name=step_type, config=config))
            
        return steps
