"""
One-time migration:
Seed prediction_models.config_json with SSOT access/cost policy fields.
"""
import json
import os
import sys

repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, repo_root)

from backend.database import get_connection


POLICY_BY_MODEL_PREFIX = [
    ("hunyuan-lite", {"prediction_tiers": ["free"], "cost": {"tier": "low", "requires_paid": False}}),
    ("deepseek-", {"prediction_tiers": ["go", "plus", "pro"], "cost": {"tier": "high", "requires_paid": True}}),
]

# Optional fallback for active prediction models not in explicit mapping.
DEFAULT_ACTIVE_POLICY = {
    "prediction_tiers": ["go", "plus", "pro"],
    "cost": {"tier": "medium", "requires_paid": True},
}


def _policy_for_model(model_id: str, is_active: int, roles_raw: str | None) -> dict | None:
    roles = []
    try:
        roles = json.loads(roles_raw or "[]")
    except Exception:
        roles = []
    if "prediction" not in roles:
        return None

    for prefix, policy in POLICY_BY_MODEL_PREFIX:
        if model_id == prefix or model_id.startswith(prefix):
            return policy
    if int(is_active or 0) == 1:
        return DEFAULT_ACTIVE_POLICY
    return None


def migrate() -> None:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT model_id, is_active, roles, config_json
        FROM prediction_models
        ORDER BY priority DESC
        """
    )
    rows = cursor.fetchall()

    updates = 0
    for row in rows:
        model_id, is_active, roles_raw, config_raw = row
        policy = _policy_for_model(str(model_id), int(is_active or 0), roles_raw)
        if not policy:
            continue

        try:
            cfg = json.loads(config_raw or "{}")
        except Exception:
            cfg = {}

        cfg["access"] = {
            "prediction_tiers": policy["prediction_tiers"],
            "visibility_tiers": policy["prediction_tiers"],
        }
        cfg["cost"] = policy["cost"]

        cursor.execute(
            "UPDATE prediction_models SET config_json = ? WHERE model_id = ?",
            (json.dumps(cfg, ensure_ascii=False), model_id),
        )
        updates += 1
        print(f"✅ policy seeded: {model_id} -> {policy['prediction_tiers']}")

    conn.commit()
    conn.close()
    print(f"\n🎉 migration complete, updated {updates} models")


if __name__ == "__main__":
    migrate()
