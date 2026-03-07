import argparse

from backend.analysis.mode_pipeline import run_mode_pipeline


def main():
    parser = argparse.ArgumentParser(description="Run investment mode backend pipeline")
    parser.add_argument("--date", type=str, help="As-of date in YYYY-MM-DD")
    parser.add_argument("--mode-id", type=str, help="Optional single mode_id")
    parser.add_argument("--rule-version", type=str, default="mode_sim_v1", help="Rule version tag")
    parser.add_argument("--triggered-by", type=str, default="manual", help="Triggered by label")
    args = parser.parse_args()

    stats = run_mode_pipeline(
        as_of_date=args.date,
        mode_id=args.mode_id,
        rule_version=args.rule_version,
        triggered_by=args.triggered_by,
    )
    print(stats)


if __name__ == "__main__":
    main()
