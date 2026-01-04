from .models.base import BasePredictionModel
from .models.factory import ModelFactory
from .models.openai import OpenAIAdapter
from .models.rule_based import RuleAdapter

# Register Models
ModelFactory.register("adapter-openai", OpenAIAdapter)
ModelFactory.register("rule-engine", RuleAdapter)
# ModelFactory.register("mock", MockAdapter) # TODO: Implement Mock

__all__ = ["ModelFactory", "BasePredictionModel"]
