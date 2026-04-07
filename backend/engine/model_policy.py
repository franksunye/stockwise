import json
from typing import Any, Dict, Iterable, List, Set

from backend.logger import logger

VALID_TIERS: Set[str] = {"free", "go", "plus", "pro", "alpha"}


def normalize_tier(value: Any) -> str:
    tier = str(value or "free").strip().lower()
    if tier in VALID_TIERS:
        return tier
    return "free"


def normalize_tiers(values: Iterable[Any] | None) -> List[str]:
    if not values:
        return ["free"]
    result: List[str] = []
    for value in values:
        tier = normalize_tier(value)
        if tier not in result:
            result.append(tier)
    return result or ["free"]


def parse_model_policy(model_id: str, config_json_raw: str | None) -> Dict[str, Any]:
    """
    Parse and validate policy fields from prediction_models.config_json.
    Contract:
      - access.prediction_tiers: string[]
      - access.visibility_tiers: string[] (optional)
      - access.min_tier: string (optional)
      - cost.tier: low|medium|high (optional)
      - cost.requires_paid: bool (optional)
    """
    parsed: Dict[str, Any] = {}
    try:
        parsed = json.loads(config_json_raw or "{}")
    except Exception:
        logger.warning(f"⚠️ Invalid config_json for model={model_id}; policy defaults to deny.")
        parsed = {}

    access = parsed.get("access") if isinstance(parsed.get("access"), dict) else {}
    prediction_tiers = access.get("prediction_tiers")
    if not isinstance(prediction_tiers, list):
        prediction_tiers = []
    normalized_prediction_tiers = [t for t in (normalize_tier(v) for v in prediction_tiers) if t in VALID_TIERS]
    normalized_prediction_tiers = list(dict.fromkeys(normalized_prediction_tiers))

    visibility_tiers = access.get("visibility_tiers")
    if not isinstance(visibility_tiers, list):
        visibility_tiers = normalized_prediction_tiers
    normalized_visibility_tiers = [t for t in (normalize_tier(v) for v in visibility_tiers) if t in VALID_TIERS]
    normalized_visibility_tiers = list(dict.fromkeys(normalized_visibility_tiers))

    min_tier = access.get("min_tier")
    min_tier_norm = normalize_tier(min_tier) if min_tier else None

    cost = parsed.get("cost") if isinstance(parsed.get("cost"), dict) else {}
    cost_tier = str(cost.get("tier") or "").strip().lower() or None
    if cost_tier not in {None, "low", "medium", "high"}:
        cost_tier = None
    requires_paid = bool(cost.get("requires_paid", False))

    return {
        "prediction_tiers": normalized_prediction_tiers,
        "visibility_tiers": normalized_visibility_tiers,
        "min_tier": min_tier_norm,
        "cost_tier": cost_tier,
        "requires_paid": requires_paid,
    }


def model_allows_tier(policy: Dict[str, Any], tiers: Iterable[str]) -> bool:
    allowed = set(policy.get("prediction_tiers") or [])
    if not allowed:
        return False
    requested = set(normalize_tiers(tiers))
    return len(allowed.intersection(requested)) > 0
