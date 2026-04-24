import json
import os
import sys
from pathlib import Path

# Ensure backend modules are importable when running from repo root.
ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT))
sys.path.append(str(ROOT / "backend"))

from backend.database import get_connection  # noqa: E402


def upsert_nvidia_model() -> None:
    # Explicit DB source for safety in write operations.
    os.environ["DB_SOURCE"] = os.getenv("DB_SOURCE", "cloud")

    model_id = "deepseek-nvidia"
    roles = ["prediction"]
    config = {
        "provider_id": "nvidia",
        "model": "deepseek-ai/deepseek-v3.2",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "access": {
            "prediction_tiers": ["go", "plus", "pro"],
            "visibility_tiers": ["go", "plus", "pro"],
        },
        "cost": {"tier": "high", "requires_paid": True},
    }
    capabilities = {"cost": "high", "speed": "medium", "provider": "nvidia"}

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT OR REPLACE INTO prediction_models
            (model_id, display_name, provider, is_active, priority, roles, config_json, capabilities_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                model_id,
                "DeepSeek V3.2 (NVIDIA)",
                "adapter-openai",
                1,
                92,
                json.dumps(roles),
                json.dumps(config),
                json.dumps(capabilities),
            ),
        )
        conn.commit()

        cursor.execute(
            "SELECT model_id, provider, is_active, priority, roles, config_json FROM prediction_models WHERE model_id = ?",
            (model_id,),
        )
        row = cursor.fetchone()
        print("✅ NVIDIA provider registered:")
        print(row)
    finally:
        conn.close()


if __name__ == "__main__":
    upsert_nvidia_model()
