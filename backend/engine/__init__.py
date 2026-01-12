from .models.base import BasePredictionModel
from .models.factory import ModelFactory

# Lazy imports inside register function to prevent side-effects
def register_all_models():
    """
    Explicitly register all prediction models.
    This should only be called when running full analysis, NOT for lightweight tasks like Briefs.
    """
    from .models.openai import OpenAIAdapter
    from .models.rule_based import RuleAdapter
    from .models.gemini_local import GeminiLocalAdapter
    from .models.hunyuan_chain import HunyuanChainModel
    # from .models.mock import MockAdapter 

    ModelFactory.register("adapter-openai", OpenAIAdapter)
    ModelFactory.register("adapter-gemini-local", GeminiLocalAdapter)
    ModelFactory.register("rule-engine", RuleAdapter)
    ModelFactory.register("hunyuan", HunyuanChainModel)
    # ModelFactory.register("mock", MockAdapter)

__all__ = ["ModelFactory", "BasePredictionModel", "register_all_models"]
