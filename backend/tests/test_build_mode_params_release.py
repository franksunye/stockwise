from unittest.mock import patch

from backend.scripts.build_mode_params_release import build_release_payload


def test_build_release_payload_selects_best_and_merges_market_override():
    manifest = {
        "strategy_version": "tradeability_v2",
        "market": "CN",
        "window": {"start_date": "2025-01-01", "end_date": "2025-03-31"},
        "common": {"max_hold_days": 10, "stop_loss_pct": 0.06},
        "modes": [
            {
                "mode_id": "steady_v1",
                "bundle_name": "steady",
                "objective": "steady",
                "candidates": [
                    {
                        "name": "steady_base",
                        "params": {
                            "vcp_ratio": 0.92,
                            "breakout_volume_mult": 1.05,
                            "strong_close_threshold": 0.65,
                            "momentum_change_threshold": 3.0,
                            "risk_off_ma": 10,
                        },
                    },
                    {
                        "name": "steady_best",
                        "params": {
                            "vcp_ratio": 0.93,
                            "breakout_volume_mult": 1.08,
                            "strong_close_threshold": 0.66,
                            "momentum_change_threshold": 3.2,
                            "risk_off_ma": 10,
                        },
                    },
                ],
            },
            {
                "mode_id": "balanced_v1",
                "bundle_name": "balanced",
                "objective": "balanced",
                "candidates": [
                    {
                        "name": "balanced_base",
                        "params": {
                            "vcp_ratio": 0.95,
                            "breakout_volume_mult": 1.0,
                            "strong_close_threshold": 0.60,
                            "momentum_change_threshold": 2.3,
                            "risk_off_ma": 5,
                        },
                    },
                    {
                        "name": "balanced_best",
                        "params": {
                            "vcp_ratio": 0.97,
                            "breakout_volume_mult": 0.96,
                            "strong_close_threshold": 0.58,
                            "momentum_change_threshold": 2.0,
                            "risk_off_ma": 5,
                        },
                    },
                ],
            },
            {
                "mode_id": "aggressive_v1",
                "bundle_name": "aggressive",
                "objective": "aggressive",
                "candidates": [
                    {
                        "name": "aggressive_base",
                        "params": {
                            "vcp_ratio": 1.05,
                            "breakout_volume_mult": 0.8,
                            "strong_close_threshold": 0.5,
                            "momentum_change_threshold": 1.4,
                            "risk_off_ma": 5,
                        },
                    },
                    {
                        "name": "aggressive_best",
                        "params": {
                            "vcp_ratio": 1.06,
                            "breakout_volume_mult": 0.75,
                            "strong_close_threshold": 0.48,
                            "momentum_change_threshold": 1.2,
                            "risk_off_ma": 5,
                        },
                    },
                ],
            },
        ],
    }
    current_config = {
        "config_version": "mode_params_bundles_v1",
        "strategy_version": "tradeability_v2",
        "bundles": {
            "steady": {"default": {"risk_off_ma": 10}, "markets": {"HK": {"risk_off_ma": 10}}},
            "balanced": {"default": {}, "markets": {"HK": {"risk_off_ma": 10}}},
            "aggressive": {"default": {}, "markets": {"HK": {"risk_off_ma": 5}}},
            "observe_only": {"default": {}, "markets": {"HK": {}}},
        },
    }

    fake_results = {
        "steady_base": {
            "trade_metrics": {"trade_count": 10, "expectancy": 0.01, "payoff": 1.1, "win_rate": 0.52},
            "state_metrics": {
                "trigger_coverage": 0.03,
                "watch_coverage": 0.12,
                "risk_off_coverage": 0.05,
                "watch_to_trigger_ratio": 0.24,
                "watch_days": 20,
                "triggered_days": 8,
                "risk_off_days": 5,
            },
            "forward_metrics": {"t3_win_rate": 0.51},
            "capital_metrics": {"max_drawdown": 0.10},
        },
        "steady_best": {
            "trade_metrics": {"trade_count": 12, "expectancy": 0.013, "payoff": 1.3, "win_rate": 0.55},
            "state_metrics": {
                "trigger_coverage": 0.035,
                "watch_coverage": 0.13,
                "risk_off_coverage": 0.04,
                "watch_to_trigger_ratio": 0.27,
                "watch_days": 22,
                "triggered_days": 9,
                "risk_off_days": 4,
            },
            "forward_metrics": {"t3_win_rate": 0.56},
            "capital_metrics": {"max_drawdown": 0.08},
        },
        "balanced_base": {
            "trade_metrics": {"trade_count": 15, "expectancy": 0.011, "payoff": 1.15, "win_rate": 0.53},
            "state_metrics": {
                "trigger_coverage": 0.045,
                "watch_coverage": 0.14,
                "risk_off_coverage": 0.06,
                "watch_to_trigger_ratio": 0.28,
                "watch_days": 25,
                "triggered_days": 10,
                "risk_off_days": 6,
            },
            "forward_metrics": {"t3_win_rate": 0.54},
            "capital_metrics": {"max_drawdown": 0.11},
        },
        "balanced_best": {
            "trade_metrics": {"trade_count": 18, "expectancy": 0.016, "payoff": 1.25, "win_rate": 0.56},
            "state_metrics": {
                "trigger_coverage": 0.052,
                "watch_coverage": 0.15,
                "risk_off_coverage": 0.05,
                "watch_to_trigger_ratio": 0.31,
                "watch_days": 28,
                "triggered_days": 12,
                "risk_off_days": 5,
            },
            "forward_metrics": {"t3_win_rate": 0.58},
            "capital_metrics": {"max_drawdown": 0.09},
        },
        "aggressive_base": {
            "trade_metrics": {"trade_count": 22, "expectancy": 0.014, "payoff": 1.1, "win_rate": 0.51},
            "state_metrics": {
                "trigger_coverage": 0.061,
                "watch_coverage": 0.18,
                "risk_off_coverage": 0.08,
                "watch_to_trigger_ratio": 0.33,
                "watch_days": 30,
                "triggered_days": 16,
                "risk_off_days": 8,
            },
            "forward_metrics": {"t3_win_rate": 0.57},
            "capital_metrics": {"max_drawdown": 0.12},
        },
        "aggressive_best": {
            "trade_metrics": {"trade_count": 25, "expectancy": 0.017, "payoff": 1.16, "win_rate": 0.53},
            "state_metrics": {
                "trigger_coverage": 0.072,
                "watch_coverage": 0.19,
                "risk_off_coverage": 0.09,
                "watch_to_trigger_ratio": 0.35,
                "watch_days": 32,
                "triggered_days": 18,
                "risk_off_days": 9,
            },
            "forward_metrics": {"t3_win_rate": 0.60},
            "capital_metrics": {"max_drawdown": 0.13},
        },
    }

    def fake_run_loop(*, bars_by_symbol, max_hold_days, stop_loss_pct, vcp_ratio, risk_off_ma, breakout_volume_mult, strong_close_threshold, momentum_change_threshold, initial_capital, max_positions, fee_bps_each_side, spread_bps, slippage_bps):
        for mode in manifest["modes"]:
            for candidate in mode["candidates"]:
                params = candidate["params"]
                if (
                    params["vcp_ratio"] == vcp_ratio
                    and params["risk_off_ma"] == risk_off_ma
                    and params["breakout_volume_mult"] == breakout_volume_mult
                    and params["strong_close_threshold"] == strong_close_threshold
                    and params["momentum_change_threshold"] == momentum_change_threshold
                ):
                    assert spread_bps == 0.0
                    assert slippage_bps == 0.0
                    return fake_results[candidate["name"]]
        raise AssertionError("Unexpected candidate params")

    with patch("backend.scripts.build_mode_params_release.load_bars_by_market", return_value={"000001": [object()]}), patch(
        "backend.scripts.build_mode_params_release.run_loop",
        side_effect=fake_run_loop,
    ), patch(
        "backend.scripts.build_mode_params_release._get_latest_mode_effect",
        return_value={"mode_id": "balanced_v1", "hit_rate": 0.55, "max_drawdown": -0.09, "sample_size": 40, "payoff_ratio": 1.1, "stability_score": 0.4, "horizon": "30d", "as_of_date": "2025-03-31"},
    ):
        payload = build_release_payload(
            manifest,
            current_config=current_config,
            manifest_path="/tmp/mode_manifest.json",
            output_json_path="/tmp/best_release.json",
        )

    assert payload["selection_summary"]["steady_v1"]["selected_candidate"]["name"] == "steady_best"
    assert payload["selection_summary"]["balanced_v1"]["selected_candidate"]["name"] == "balanced_best"
    assert payload["selection_summary"]["aggressive_v1"]["selected_candidate"]["name"] == "aggressive_best"
    assert payload["bundles"]["steady"]["markets"]["CN"]["breakout_volume_mult"] == 1.08
    assert payload["bundles"]["steady"]["markets"]["HK"]["risk_off_ma"] == 10
    assert payload["bundles"]["observe_only"]["markets"]["HK"] == {}
