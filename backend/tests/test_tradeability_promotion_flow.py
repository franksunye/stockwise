import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class TradeabilityPromotionFlowTest(unittest.TestCase):
    def test_full_flow_approve_promote_rollback_on_temp_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            backend_target = tmp / "investment_mode.py"
            frontend_target = tmp / "investment-mode.ts"
            verdict_json = tmp / "verdict.json"
            approval_json = tmp / "approval.json"

            backend_target.write_text(
                'MODE = {"strategy_version": "tradeability_v1"}\n',
                encoding="utf-8",
            )
            frontend_target.write_text(
                "export const config = { strategy_mapping: { strategy_version: 'tradeability_v1' } };\n",
                encoding="utf-8",
            )
            verdict_json.write_text(
                json.dumps(
                    {
                        "market": "CN",
                        "candidate_version": "tradeability_v2",
                        "baseline_version": "tradeability_v1",
                        "promotion_gate_pass": True,
                        "recommended_action": "promote_candidate",
                    },
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )

            subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "backend/scripts/approve_tradeability_promotion.py"),
                    "--verdict-json",
                    str(verdict_json),
                    "--approver",
                    "qa:local-test",
                    "--reason",
                    "local e2e validation",
                    "--approval-json",
                    str(approval_json),
                ],
                cwd=ROOT,
                check=True,
            )
            approval = json.loads(approval_json.read_text(encoding="utf-8"))
            self.assertTrue(approval["approved"])
            self.assertEqual(approval["candidate_version"], "tradeability_v2")

            subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "backend/scripts/promote_tradeability_bundle.py"),
                    "--verdict-json",
                    str(verdict_json),
                    "--approval-json",
                    str(approval_json),
                    "--execute",
                    "--target-file",
                    str(backend_target),
                    "--target-file",
                    str(frontend_target),
                    "--actor",
                    "qa:local-test",
                ],
                cwd=ROOT,
                check=True,
            )
            self.assertIn("tradeability_v2", backend_target.read_text(encoding="utf-8"))
            self.assertIn("tradeability_v2", frontend_target.read_text(encoding="utf-8"))

            subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "backend/scripts/rollback_tradeability_bundle.py"),
                    "--rollback-to-version",
                    "tradeability_v1",
                    "--execute",
                    "--target-file",
                    str(backend_target),
                    "--target-file",
                    str(frontend_target),
                    "--actor",
                    "qa:local-test",
                ],
                cwd=ROOT,
                check=True,
            )
            self.assertIn("tradeability_v1", backend_target.read_text(encoding="utf-8"))
            self.assertIn("tradeability_v1", frontend_target.read_text(encoding="utf-8"))

    def test_execute_requires_approval_when_not_forced(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            backend_target = tmp / "investment_mode.py"
            verdict_json = tmp / "verdict.json"

            backend_target.write_text(
                'MODE = {"strategy_version": "tradeability_v1"}\n',
                encoding="utf-8",
            )
            verdict_json.write_text(
                json.dumps(
                    {
                        "market": "CN",
                        "candidate_version": "tradeability_v2",
                        "baseline_version": "tradeability_v1",
                        "promotion_gate_pass": True,
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            proc = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "backend/scripts/promote_tradeability_bundle.py"),
                    "--verdict-json",
                    str(verdict_json),
                    "--execute",
                    "--target-file",
                    str(backend_target),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("--approval-json", proc.stderr)


if __name__ == "__main__":
    unittest.main()
