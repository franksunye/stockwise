import json
import os
import sys
import unittest
from pathlib import Path

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.management.policies.policy_catalog import POLICY_DESCRIPTIONS
from backend.management.policies.policy_registry import build_default_policies


CATALOG_PATH = Path(REPO_ROOT) / "frontend" / "src" / "shared" / "trade-management-policies.json"


class TestTradeManagementPolicyCatalog(unittest.TestCase):
    def test_catalog_ids_match_default_policy_registry(self):
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        catalog_ids = [str(row["id"]) for row in catalog]
        backend_ids = [str(policy.policy_id) for policy in build_default_policies()]

        self.assertEqual(catalog_ids, backend_ids)

    def test_catalog_descriptions_match_runtime_descriptions(self):
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        catalog_descriptions = {
            str(row["id"]): str(row["description_zh"])
            for row in catalog
        }

        self.assertEqual(catalog_descriptions, dict(POLICY_DESCRIPTIONS))


if __name__ == "__main__":
    unittest.main()
