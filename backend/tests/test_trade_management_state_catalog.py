import json
import os
import sys
import unittest
from pathlib import Path
from typing import get_args

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.management.domain.position_state import StateId
from backend.management.state.state_machine import STATE_DESCRIPTIONS


CATALOG_PATH = Path(REPO_ROOT) / "frontend" / "src" / "shared" / "trade-management-states.json"


class TestTradeManagementStateCatalog(unittest.TestCase):
    def test_catalog_ids_match_backend_state_ids(self):
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        catalog_ids = [str(row["id"]) for row in catalog]
        backend_ids = list(get_args(StateId))

        self.assertEqual(catalog_ids, backend_ids)

    def test_catalog_descriptions_match_runtime_descriptions(self):
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        catalog_descriptions = {
            str(row["id"]): str(row["description_zh"])
            for row in catalog
        }

        self.assertEqual(catalog_descriptions, dict(STATE_DESCRIPTIONS))


if __name__ == "__main__":
    unittest.main()
