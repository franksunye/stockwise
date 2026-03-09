import argparse
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.analysis.mode_pipeline import run_mode_pipeline
from backend.job_guard import JobGuard


def main():
    parser = argparse.ArgumentParser(description="Run investment mode backend pipeline")
    parser.add_argument("--date", type=str, help="As-of date in YYYY-MM-DD")
    parser.add_argument("--mode-id", type=str, help="Optional single mode_id")
    parser.add_argument("--rule-version", type=str, default="mode_sim_v1", help="Rule version tag")
    parser.add_argument("--triggered-by", type=str, default="manual", help="Triggered by label")
    parser.add_argument("--params-file", type=str, default="", help="Optional local Layer-1 params file override")
    args = parser.parse_args()

    job = JobGuard("Investment Mode Pipeline", task_type="maintenance", triggered_by=args.triggered_by)
    if args.date:
        job.date_str = args.date
    with job:
        if args.date:
            job.set_dimensions(as_of_date=args.date)
        if args.mode_id:
            job.set_dimensions(mode_id=args.mode_id)
        stats = run_mode_pipeline(
            as_of_date=args.date,
            mode_id=args.mode_id,
            rule_version=args.rule_version,
            triggered_by=args.triggered_by,
            job_id=job.get_pipeline_run_id(),
            params_file=args.params_file or None,
        )
        job.set_stats(success=True, **stats)
        print(stats)


if __name__ == "__main__":
    main()
