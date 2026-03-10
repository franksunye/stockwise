import json
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_mode_params_release_flow():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        release_json = tmp / "mode_release.json"
        target_json = tmp / "mode_params_bundles_v1.json"

        release_json.write_text(
            json.dumps(
                {
                    "config_version": "mode_params_bundles_v1",
                    "strategy_version": "tradeability_v2",
                    "generated_at": "2026-03-10T00:00:00Z",
                    "source": {
                        "market": "CN",
                        "method": "local_backtest",
                        "artifact": "tmp/mode_backtest/best_release.json",
                    },
                    "window": {
                        "start_date": "2024-01-01",
                        "end_date": "2026-03-06",
                    },
                    "research_performance": {
                        "market": "CN",
                        "window": {"start_date": "2024-01-01", "end_date": "2026-03-06"},
                        "universe": {"symbol_count": 500, "manifest": "tmp/mode_backtest/candidate_manifest_cn.json"},
                        "modes": {
                            "steady_v1": {
                                "selected_candidate_name": "steady_best",
                                "metrics": {"sample_size": 80, "max_drawdown_pct": 12.3},
                            }
                        },
                    },
                    "bundles": {
                        "steady": {"default": {"breakout_volume_mult": 1.08, "risk_off_ma": 10}},
                        "balanced": {"default": {"momentum_change_threshold": 2.0}},
                        "aggressive": {"default": {"momentum_change_threshold": 1.0, "risk_off_ma": 5}},
                        "observe_only": {"default": {}},
                    },
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        target_json.write_text(
            json.dumps(
                {
                    "config_version": "mode_params_bundles_v1",
                    "strategy_version": "tradeability_v2",
                    "generated_at": "2026-03-09T00:00:00Z",
                    "source": {"market": "HK", "method": "local_backtest"},
                    "market_release_artifacts": {
                        "HK": {
                            "window": {"start_date": "2024-01-01", "end_date": "2026-03-06"},
                            "research_performance": {
                                "market": "HK",
                                "universe": {"symbol_count": 180},
                                "modes": {"steady_v1": {"selected_candidate_name": "steady_hk_base"}},
                            },
                        }
                    },
                    "bundles": {
                        "steady": {"default": {"risk_off_ma": 10}},
                        "balanced": {"default": {}},
                        "aggressive": {"default": {"risk_off_ma": 5}},
                        "observe_only": {"default": {}},
                    },
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
                str(ROOT / "backend/scripts/promote_mode_params_release.py"),
                "--release-json",
                str(release_json),
                "--target-file",
                str(target_json),
                "--execute",
                "--actor",
                "qa:local-test",
            ],
            cwd=ROOT,
            check=True,
        )

        payload = json.loads(target_json.read_text(encoding="utf-8"))
        assert payload["strategy_version"] == "tradeability_v2"
        assert payload["market_release_artifacts"]["HK"]["research_performance"]["universe"]["symbol_count"] == 180
        assert payload["market_release_artifacts"]["CN"]["window"]["end_date"] == "2026-03-06"
        assert payload["market_release_artifacts"]["CN"]["research_performance"]["universe"]["symbol_count"] == 500
        assert (
            payload["market_release_artifacts"]["CN"]["research_performance"]["modes"]["steady_v1"]["selected_candidate_name"]
            == "steady_best"
        )
        assert payload["bundles"]["steady"]["default"]["breakout_volume_mult"] == 1.08
        assert payload["bundles"]["balanced"]["default"]["momentum_change_threshold"] == 2.0
        assert payload["bundles"]["aggressive"]["default"]["risk_off_ma"] == 5.0
