import os
import sys
import unittest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quant.sample_sync_utils import (
    board_quota,
    resolve_sync_start_date,
    select_cn_candidates,
)

class TestTradeabilitySampleSync(unittest.TestCase):
    def test_resolve_sync_start_date_for_new_symbol(self):
        self.assertEqual(resolve_sync_start_date("2024-01-01", None, 14), "2024-01-01")

    def test_resolve_sync_start_date_for_incremental_symbol(self):
        self.assertEqual(resolve_sync_start_date("2024-01-01", "2024-03-20", 14), "2024-03-06")

    def test_resolve_sync_start_date_not_earlier_than_history_floor(self):
        self.assertEqual(resolve_sync_start_date("2024-03-15", "2024-03-20", 14), "2024-03-15")

    def test_board_quota_respects_total_limit(self):
        quotas = board_quota({"6": 50, "0": 30, "3": 20}, 12)
        self.assertEqual(sum(quotas.values()), 12)
        self.assertTrue(all(value >= 0 for value in quotas.values()))

    def test_select_cn_candidates_keeps_board_diversity_when_available(self):
        candidates = [
            ("600001", "A", 0, None, 0),
            ("600002", "B", 5, "2026-03-07", 1),
            ("000001", "C", 0, None, 0),
            ("000002", "D", 10, "2026-03-07", 1),
            ("300001", "E", 0, None, 0),
            ("300002", "F", 8, "2026-03-07", 1),
        ]
        selected = select_cn_candidates(candidates, 6)
        prefixes = {row[0][0] for row in selected}
        self.assertEqual(len(selected), 6)
        self.assertEqual(prefixes, {"6", "0", "3"})


if __name__ == "__main__":
    unittest.main()
