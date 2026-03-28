import sqlite3
import unittest
from unittest.mock import patch

from backend.management.domain.position_state import PositionState
from backend.management.policies.policy_registry import build_default_policies
from backend.management.research.lanes import get_lane, route_case_lanes, should_activate_lane
from backend.management.research.path_classifier import (
    build_early_path_features,
    classify_early_path_risk,
    score_early_path_risk,
)
from backend.management.simulation.engine import simulate_policy
from backend.management.state.snapshot_builder import build_position_snapshots


def _row(symbol, date, high, low, close, volume, support, pressure, layer1="TriggeredLong", confidence=0.8):
    return (symbol, date, 0.0, high, low, close, volume, layer1, layer1, confidence, support, pressure)


class TestManagementResearch(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        cur = self.conn.cursor()
        cur.execute(
            """
            CREATE TABLE daily_prices (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                open REAL, high REAL, low REAL, close REAL, volume REAL,
                PRIMARY KEY(symbol, date)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE ai_predictions_v2 (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                model_id TEXT NOT NULL DEFAULT 'rule-engine',
                target_date TEXT NOT NULL DEFAULT '2026-03-28',
                signal TEXT,
                confidence REAL,
                support_price REAL,
                pressure_price REAL,
                layer1_status TEXT,
                is_primary INTEGER DEFAULT 1,
                PRIMARY KEY(symbol, date, model_id)
            )
            """
        )
        cur.executemany(
            "INSERT INTO daily_prices(symbol, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                ("T1", "2026-03-24", 0.0, 15.4, 14.8, 15.0, 100.0),
                ("T1", "2026-03-25", 0.0, 16.0, 15.2, 15.8, 110.0),
                ("T1", "2026-03-26", 0.0, 17.2, 15.7, 16.9, 150.0),
                ("T1", "2026-03-27", 0.0, 17.4, 15.9, 16.1, 120.0),
            ],
        )
        cur.executemany(
            """
            INSERT INTO ai_predictions_v2(symbol, date, model_id, target_date, signal, confidence, support_price, pressure_price, layer1_status, is_primary)
            VALUES (?, ?, 'rule-engine', '2026-03-28', ?, ?, ?, ?, ?, 1)
            """,
            [
                ("T1", "2026-03-24", "TriggeredLong", 0.8, 14.8, 15.4, "TriggeredLong"),
                ("T1", "2026-03-25", "TriggeredLong", 0.8, 15.0, 15.9, "TriggeredLong"),
                ("T1", "2026-03-26", "TriggeredLong", 0.8, 15.3, 16.8, "TriggeredLong"),
                ("T1", "2026-03-27", "TriggeredLong", 0.8, 16.2, 17.3, "TriggeredLong"),
            ],
        )
        self.conn.commit()

    def tearDown(self):
        self.conn.close()

    def test_build_snapshots_and_simulate(self):
        with patch("backend.management.state.snapshot_builder.get_connection", side_effect=lambda: self.conn):
            snapshots = build_position_snapshots("T1", "2026-03-24", 15.0, 3000)
        self.assertEqual(len(snapshots), 4)
        self.assertEqual(snapshots[-1].state_id, "FailureRisk")

        policies = build_default_policies()
        results = {p.policy_id: simulate_policy(p, [s for s in snapshots]) for p in policies}
        self.assertIn("partial_take_profit_33", results)
        self.assertIn("failure_risk_reduce_50", results)
        self.assertIn("failure_risk_exit_all", results)
        self.assertIsNotNone(results["buy_and_hold_baseline"].realized_pnl_pct)
        self.assertGreaterEqual(results["partial_take_profit_33"].action_count, 1)
        self.assertEqual(results["failure_risk_exit_all"].action_log[0]["action"], "EXIT_ALL")
        self.assertEqual(results["failure_risk_reduce_50"].action_log[0]["action"], "SELL_PART")
        self.assertNotEqual(
            results["failure_risk_reduce_50"].action_log[0]["action"],
            results["failure_risk_exit_all"].action_log[0]["action"],
        )

    def test_early_path_features_capture_risk_rebound_recovery(self):
        snapshots = [
            PositionState(
                symbol="R1",
                trade_date="2026-03-20",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=0,
                close=10.0,
                high=10.2,
                low=9.8,
                volume=100.0,
                unrealized_pnl_pct=0.0,
                mfe_pct=0.0,
                mae_pct=0.0,
                signal_state="RiskOff",
                confidence=0.68,
                support_price=9.7,
                resistance_price=10.3,
                discipline_price=9.7,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
            PositionState(
                symbol="R1",
                trade_date="2026-03-21",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=1,
                close=9.9,
                high=10.0,
                low=9.7,
                volume=110.0,
                unrealized_pnl_pct=-0.01,
                mfe_pct=0.0,
                mae_pct=-0.01,
                signal_state="RiskOff",
                confidence=0.68,
                support_price=9.6,
                resistance_price=10.1,
                discipline_price=9.6,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
            PositionState(
                symbol="R1",
                trade_date="2026-03-22",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=2,
                close=10.35,
                high=10.4,
                low=9.95,
                volume=120.0,
                unrealized_pnl_pct=0.035,
                mfe_pct=0.035,
                mae_pct=-0.01,
                signal_state="RiskOff",
                confidence=0.68,
                support_price=9.8,
                resistance_price=10.5,
                discipline_price=9.8,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
        ]

        features = build_early_path_features(snapshots, lookahead_days=3)
        self.assertEqual(features["risk_rebound_recovery"], 1)
        self.assertEqual(classify_early_path_risk(features), "early_mixed")
        self.assertLess(score_early_path_risk(features), 10)

    def test_late_rebuild_seed_candidate_steps_down_from_score_high(self):
        snapshots = [
            PositionState(
                symbol="R2",
                trade_date="2026-03-20",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=0,
                close=10.0,
                high=10.1,
                low=9.95,
                volume=100.0,
                unrealized_pnl_pct=0.0,
                mfe_pct=0.0,
                mae_pct=0.0,
                signal_state="NoSetup",
                confidence=0.70,
                support_price=9.7,
                resistance_price=10.3,
                discipline_price=9.7,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="EntryTriggered",
            ),
            PositionState(
                symbol="R2",
                trade_date="2026-03-21",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=1,
                close=9.51,
                high=9.75,
                low=9.45,
                volume=110.0,
                unrealized_pnl_pct=-0.049,
                mfe_pct=0.0,
                mae_pct=-0.049,
                signal_state="RiskOff",
                confidence=0.70,
                support_price=9.4,
                resistance_price=9.9,
                discipline_price=9.4,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
            PositionState(
                symbol="R2",
                trade_date="2026-03-22",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=2,
                close=9.62,
                high=9.7,
                low=9.5,
                volume=105.0,
                unrealized_pnl_pct=-0.038,
                mfe_pct=0.0,
                mae_pct=-0.049,
                signal_state="RiskOff",
                confidence=0.70,
                support_price=9.45,
                resistance_price=9.95,
                discipline_price=9.45,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
        ]

        features = build_early_path_features(snapshots, lookahead_days=3)
        self.assertEqual(features["late_rebuild_seed_candidate"], 1)
        self.assertEqual(classify_early_path_risk(features), "early_mixed")
        self.assertLess(score_early_path_risk(features), 10)

    def test_secondary_failure_research_candidates_are_exposed(self):
        snapshots = [
            PositionState(
                symbol="R4",
                trade_date="2026-03-20",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=0,
                close=10.0,
                high=10.0,
                low=9.9,
                volume=100.0,
                unrealized_pnl_pct=0.0,
                mfe_pct=0.0,
                mae_pct=0.0,
                signal_state="RiskOff",
                confidence=0.65,
                support_price=9.7,
                resistance_price=10.1,
                discipline_price=9.7,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
            PositionState(
                symbol="R4",
                trade_date="2026-03-21",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=1,
                close=10.16,
                high=10.18,
                low=9.95,
                volume=105.0,
                unrealized_pnl_pct=0.016,
                mfe_pct=0.016,
                mae_pct=0.0,
                signal_state="NoSetup",
                confidence=0.65,
                support_price=9.8,
                resistance_price=10.2,
                discipline_price=9.8,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="EntryTriggered",
            ),
            PositionState(
                symbol="R4",
                trade_date="2026-03-22",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=2,
                close=10.02,
                high=10.08,
                low=9.96,
                volume=102.0,
                unrealized_pnl_pct=0.002,
                mfe_pct=0.016,
                mae_pct=0.0,
                signal_state="NoSetup",
                confidence=0.65,
                support_price=9.82,
                resistance_price=10.18,
                discipline_price=9.82,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="EntryTriggered",
            ),
        ]

        features = build_early_path_features(snapshots, lookahead_days=3)
        self.assertEqual(features["secondary_failure_loop_candidate"], 1)

        entry_drift = [
            PositionState(
                symbol="R5",
                trade_date="2026-03-20",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=0,
                close=10.0,
                high=10.0,
                low=9.95,
                volume=100.0,
                unrealized_pnl_pct=0.0,
                mfe_pct=0.0,
                mae_pct=0.0,
                signal_state="NoSetup",
                confidence=0.62,
                support_price=9.8,
                resistance_price=10.1,
                discipline_price=9.8,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="EntryTriggered",
            ),
            PositionState(
                symbol="R5",
                trade_date="2026-03-21",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=1,
                close=9.86,
                high=9.97,
                low=9.84,
                volume=98.0,
                unrealized_pnl_pct=-0.014,
                mfe_pct=0.0,
                mae_pct=-0.014,
                signal_state="NoSetup",
                confidence=0.62,
                support_price=9.75,
                resistance_price=10.0,
                discipline_price=9.75,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="EntryTriggered",
            ),
            PositionState(
                symbol="R5",
                trade_date="2026-03-22",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=2,
                close=9.88,
                high=9.94,
                low=9.83,
                volume=95.0,
                unrealized_pnl_pct=-0.012,
                mfe_pct=0.0,
                mae_pct=-0.017,
                signal_state="NoSetup",
                confidence=0.62,
                support_price=9.74,
                resistance_price=9.98,
                discipline_price=9.74,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="EntryTriggered",
            ),
        ]

        drift_features = build_early_path_features(entry_drift, lookahead_days=3)
        self.assertEqual(drift_features["no_confirmation_entry_drift_candidate"], 1)

    def test_longer_lookahead_exposes_re_failure_after_recovery(self):
        snapshots = [
            PositionState(
                symbol="R6",
                trade_date="2026-03-20",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=0,
                close=10.0,
                high=10.0,
                low=9.9,
                volume=100.0,
                unrealized_pnl_pct=0.0,
                mfe_pct=0.0,
                mae_pct=0.0,
                signal_state="RiskOff",
                confidence=0.66,
                support_price=9.8,
                resistance_price=10.1,
                discipline_price=9.8,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
            PositionState(
                symbol="R6",
                trade_date="2026-03-21",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=1,
                close=10.12,
                high=10.16,
                low=9.95,
                volume=100.0,
                unrealized_pnl_pct=0.012,
                mfe_pct=0.012,
                mae_pct=0.0,
                signal_state="NoSetup",
                confidence=0.66,
                support_price=9.85,
                resistance_price=10.2,
                discipline_price=9.85,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="EntryTriggered",
            ),
            PositionState(
                symbol="R6",
                trade_date="2026-03-22",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=2,
                close=10.08,
                high=10.12,
                low=9.98,
                volume=99.0,
                unrealized_pnl_pct=0.008,
                mfe_pct=0.012,
                mae_pct=0.0,
                signal_state="NoSetup",
                confidence=0.66,
                support_price=9.84,
                resistance_price=10.18,
                discipline_price=9.84,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="EntryTriggered",
            ),
            PositionState(
                symbol="R6",
                trade_date="2026-03-23",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=3,
                close=9.82,
                high=10.0,
                low=9.8,
                volume=103.0,
                unrealized_pnl_pct=-0.018,
                mfe_pct=0.012,
                mae_pct=-0.018,
                signal_state="RiskOff",
                confidence=0.66,
                support_price=9.72,
                resistance_price=10.02,
                discipline_price=9.72,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
            PositionState(
                symbol="R6",
                trade_date="2026-03-24",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=4,
                close=9.78,
                high=9.88,
                low=9.74,
                volume=105.0,
                unrealized_pnl_pct=-0.022,
                mfe_pct=0.012,
                mae_pct=-0.022,
                signal_state="RiskOff",
                confidence=0.66,
                support_price=9.68,
                resistance_price=9.95,
                discipline_price=9.68,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
        ]

        short_features = build_early_path_features(snapshots, lookahead_days=3)
        long_features = build_early_path_features(snapshots, lookahead_days=5)
        self.assertEqual(short_features["re_failure_after_recovery"], 0)
        self.assertEqual(long_features["re_failure_after_recovery"], 2)

    def test_lane_registry_and_activation_boundary(self):
        baseline_lane = get_lane("baseline_3d")
        low_risk_lane = get_lane("low_risk_5d")
        self.assertEqual(baseline_lane.lookahead_days, 3)
        self.assertEqual(low_risk_lane.lookahead_days, 5)
        self.assertTrue(should_activate_lane("baseline_3d", baseline_bucket="score_high"))
        self.assertTrue(should_activate_lane("low_risk_5d", baseline_bucket="score_low"))
        self.assertFalse(should_activate_lane("low_risk_5d", baseline_bucket="score_high"))

    def test_lane_router_activates_second_pass_for_score_low(self):
        snapshots = [
            PositionState(
                symbol="R7",
                trade_date="2026-03-20",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=0,
                close=10.0,
                high=10.0,
                low=9.9,
                volume=100.0,
                unrealized_pnl_pct=0.0,
                mfe_pct=0.0,
                mae_pct=0.0,
                signal_state="RiskOff",
                confidence=0.66,
                support_price=9.8,
                resistance_price=10.1,
                discipline_price=9.8,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
            PositionState(
                symbol="R7",
                trade_date="2026-03-21",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=1,
                close=10.12,
                high=10.16,
                low=9.95,
                volume=100.0,
                unrealized_pnl_pct=0.012,
                mfe_pct=0.012,
                mae_pct=0.0,
                signal_state="NoSetup",
                confidence=0.66,
                support_price=9.85,
                resistance_price=10.2,
                discipline_price=9.85,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="EntryTriggered",
            ),
            PositionState(
                symbol="R7",
                trade_date="2026-03-22",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=2,
                close=10.08,
                high=10.12,
                low=9.98,
                volume=99.0,
                unrealized_pnl_pct=0.008,
                mfe_pct=0.012,
                mae_pct=0.0,
                signal_state="NoSetup",
                confidence=0.66,
                support_price=9.84,
                resistance_price=10.18,
                discipline_price=9.84,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="EntryTriggered",
            ),
            PositionState(
                symbol="R7",
                trade_date="2026-03-23",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=3,
                close=9.82,
                high=10.0,
                low=9.8,
                volume=103.0,
                unrealized_pnl_pct=-0.018,
                mfe_pct=0.012,
                mae_pct=-0.018,
                signal_state="RiskOff",
                confidence=0.66,
                support_price=9.72,
                resistance_price=10.02,
                discipline_price=9.72,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
            PositionState(
                symbol="R7",
                trade_date="2026-03-24",
                entry_date="2026-03-20",
                entry_price=10.0,
                position_size=3000.0,
                holding_days=4,
                close=9.78,
                high=9.88,
                low=9.74,
                volume=105.0,
                unrealized_pnl_pct=-0.022,
                mfe_pct=0.012,
                mae_pct=-0.022,
                signal_state="RiskOff",
                confidence=0.66,
                support_price=9.68,
                resistance_price=9.95,
                discipline_price=9.68,
                breakout_confirmed=False,
                near_resistance=False,
                failed_breakout_risk=False,
                volume_followthrough=False,
                state_id="FailureRisk",
            ),
        ]

        route = route_case_lanes(snapshots)
        self.assertEqual(route["baseline"]["early_risk_bucket"], "score_low")
        self.assertEqual(route["baseline"]["lane_id"], "baseline_3d")
        self.assertEqual(route["second_pass"]["lane_id"], "low_risk_5d")
        self.assertGreaterEqual(route["second_pass"]["early_risk_score"], 8)
        self.assertTrue(route["takeover_applied"])
        self.assertEqual(route["final"]["lane_id"], "low_risk_5d")
