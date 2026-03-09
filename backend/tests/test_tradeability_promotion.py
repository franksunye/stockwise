import unittest

from backend.scripts.metrics_tradeability_promotion import (
    _comparative_gates,
    _weekly_pass,
    _build_blocking_reasons,
    _mode_effect_gates,
)


def _report(level1_pass=True, obs="ok", trig=8.0, risk=20.0, watch_to_trigger=25.0, consistency=100.0, drawdown=30.0):
    return {
        "level1_pass": level1_pass,
        "observability": {"overall_state": obs},
        "gates": {
            "consistency_gate": level1_pass,
            "triggered_coverage_gate": level1_pass,
            "watch_to_trigger_gate": level1_pass,
            "drawdown_control_gate": level1_pass,
            "observability_gate": obs == "ok",
        },
        "metrics": {
            "triggered_coverage_pct": trig,
            "riskoff_coverage_pct": risk,
            "watch_to_trigger_pct": watch_to_trigger,
            "consistency_rate_pct": consistency,
            "drawdown_control": {"max_drawdown_pct": drawdown, "drawdown_controlled": True},
        },
    }


class TradeabilityPromotionTest(unittest.TestCase):
    def test_comparative_gates_pass_for_better_candidate(self):
        candidate = _report(trig=9.0, risk=18.0, watch_to_trigger=24.0, consistency=100.0, drawdown=28.0)
        baseline = _report(trig=7.0, risk=20.0, watch_to_trigger=26.0, consistency=99.8, drawdown=31.0)
        gates = _comparative_gates(candidate, baseline)
        self.assertTrue(all(v for v in gates.values() if v is not None))

    def test_weekly_pass_fails_when_observability_warn(self):
        candidate = _report(obs="warn")
        comparative = {
            "coverage_not_worse": True,
            "riskoff_not_worse": True,
            "consistency_not_worse": True,
            "watch_to_trigger_not_looser": True,
            "drawdown_not_worse": True,
        }
        self.assertFalse(_weekly_pass(candidate, comparative))

    def test_blocking_reasons_include_streak_and_baseline_gap(self):
        candidate = _report(level1_pass=False, trig=3.0)
        baseline = _report(trig=7.0)
        weekly_reports = [
            {
                "candidate": candidate,
                "baseline": baseline,
                "comparative_gates": {
                    "coverage_not_worse": False,
                    "riskoff_not_worse": True,
                    "consistency_not_worse": True,
                    "watch_to_trigger_not_looser": True,
                    "drawdown_not_worse": True,
                },
                "weekly_pass": False,
            }
        ]
        reasons = _build_blocking_reasons(weekly_reports, min_pass_weeks=2)
        self.assertTrue(any("latest weekly acceptance failed" in x for x in reasons))
        self.assertTrue(any("candidate underperforms baseline" in x for x in reasons))
        self.assertTrue(any("pass streak" in x for x in reasons))

    def test_mode_effect_gates_fail_when_product_effect_is_weak(self):
        gates, reasons = _mode_effect_gates(
            {
                "mode_id": "balanced_v1",
                "horizon": "30d",
                "hit_rate": 0.48,
                "max_drawdown": -0.14,
                "sample_size": 12,
                "payoff_ratio": 0.82,
                "stability_score": 0.30,
                "as_of_date": "2026-03-01",
            },
            "2026-03-09",
        )
        self.assertFalse(gates["mode_sample_size_ok"])
        self.assertFalse(gates["mode_hit_rate_ok"])
        self.assertFalse(gates["mode_drawdown_ok"])
        self.assertFalse(gates["mode_payoff_ok"])
        self.assertFalse(gates["mode_stability_ok"])
        self.assertTrue(any("product effect sample_size" in x for x in reasons))

    def test_mode_effect_gates_pass_for_healthy_product_effect(self):
        gates, reasons = _mode_effect_gates(
            {
                "mode_id": "balanced_v1",
                "horizon": "30d",
                "hit_rate": 0.53,
                "max_drawdown": -0.09,
                "sample_size": 30,
                "payoff_ratio": 1.02,
                "stability_score": 0.40,
                "as_of_date": "2026-03-08",
            },
            "2026-03-09",
        )
        self.assertTrue(all(v is not False for v in gates.values()))
        self.assertEqual(reasons, [])


if __name__ == "__main__":
    unittest.main()
