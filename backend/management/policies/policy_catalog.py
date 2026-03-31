from __future__ import annotations

import json
from pathlib import Path


_POLICY_CATALOG_PATH = (
    Path(__file__).resolve().parents[3] / "frontend" / "src" / "shared" / "trade-management-policies.json"
)


def _load_policy_catalog() -> list[dict[str, str | int]]:
    return json.loads(_POLICY_CATALOG_PATH.read_text(encoding="utf-8"))


POLICY_CATALOG = _load_policy_catalog()
POLICY_LABELS = {str(row["id"]): str(row["label_zh"]) for row in POLICY_CATALOG}
POLICY_DESCRIPTIONS = {str(row["id"]): str(row["description_zh"]) for row in POLICY_CATALOG}


def get_policy_label(policy_id: str | None) -> str | None:
    if not policy_id:
        return None
    return POLICY_LABELS.get(str(policy_id))


def get_policy_description(policy_id: str | None) -> str | None:
    if not policy_id:
        return None
    return POLICY_DESCRIPTIONS.get(str(policy_id))
