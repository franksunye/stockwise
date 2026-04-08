import argparse
import os
import sys
from datetime import datetime

# Path bootstrap for direct script execution
CURRENT_FILE = os.path.abspath(__file__)
SCRIPTS_DIR = os.path.dirname(CURRENT_FILE)
BACKEND_DIR = os.path.dirname(SCRIPTS_DIR)
ROOT_DIR = os.path.dirname(BACKEND_DIR)
for d in (ROOT_DIR, BACKEND_DIR):
    if d not in sys.path:
        sys.path.insert(0, d)

try:
    from backend.engine.market_facts_service import get_or_generate_market_facts
    from backend.job_guard import JobGuard
    from backend.config import BEIJING_TZ, ADMIN_MOBILES
    from backend.utils import send_wecom_notification
except ImportError:
    from engine.market_facts_service import get_or_generate_market_facts
    from job_guard import JobGuard
    from config import BEIJING_TZ, ADMIN_MOBILES
    from utils import send_wecom_notification


def _today_beijing() -> str:
    return datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")


def run_healthcheck(target_date: str, market: str, strict: bool, notify_on_warning: bool) -> int:
    task_name = f"market_facts_health_{market.lower()}"
    triggered_by = "scheduler" if os.getenv("GITHUB_ACTIONS") == "true" else "manual"

    severe_issue = False
    exit_code = 0

    with JobGuard(
        task_name=task_name,
        agent_id="market_observer",
        task_type="healthcheck",
        triggered_by=triggered_by,
        notify_on_success=False,
        notify_on_fail=True,
        channel_alert=True,
        rerun_workflow="almanac_maintenance.yml",
    ) as guard:
        guard.set_dimensions(market=market, target_date=target_date)

        bundle = get_or_generate_market_facts(target_date)
        facts_date = str(bundle.get("fact_date") or "")
        quality = bundle.get("quality") or {}
        gate_pass = bool(quality.get("gate_pass"))
        flags = list(quality.get("flags") or [])
        fallback_used = "stale_fallback_used" in flags
        completeness = quality.get("completeness")
        coverage_score = quality.get("coverage_score")
        missing_fields = quality.get("missing_fields") or []
        fallback_fact_date = quality.get("fallback_fact_date")

        severe_issue = (not gate_pass) or fallback_used
        guard.set_stats(
            success=True,
            gate_pass=gate_pass,
            facts_date=facts_date,
            requested_date=target_date,
            completeness=completeness,
            coverage_score=coverage_score,
            fallback_used=fallback_used,
            fallback_fact_date=fallback_fact_date,
            missing_fields=",".join(missing_fields) if missing_fields else "",
            flags=",".join(flags) if flags else "",
        )

        print(
            f"[market_facts_health] date={target_date} facts_date={facts_date} "
            f"gate_pass={gate_pass} completeness={completeness} coverage={coverage_score} "
            f"fallback_used={fallback_used} flags={flags}"
        )

        if severe_issue and notify_on_warning:
            title = "⚠️ Market Facts Health Warning"
            lines = [
                f"### {title}",
                f"- **Market**: {market}",
                f"- **Requested Date**: {target_date}",
                f"- **Facts Date**: {facts_date}",
                f"- **Gate Pass**: {gate_pass}",
                f"- **Completeness**: {completeness}",
                f"- **Coverage Score**: {coverage_score}",
                f"- **Fallback Used**: {fallback_used}",
                f"- **Fallback Fact Date**: {fallback_fact_date or 'N/A'}",
                f"- **Flags**: {', '.join(flags) if flags else 'none'}",
            ]
            mentioned = ADMIN_MOBILES if not gate_pass else None
            send_wecom_notification("\n".join(lines), mentioned_mobile_list=mentioned)

        if strict and severe_issue:
            guard.set_stats(
                success=False,
                error="market_facts_healthcheck_strict_failed",
            )
            exit_code = 2

    return exit_code


def main() -> int:
    parser = argparse.ArgumentParser(description="Market facts healthcheck for almanac production readiness.")
    parser.add_argument("--date", default=None, help="Target date (YYYY-MM-DD). Defaults to today in Beijing.")
    parser.add_argument("--market", default="CN", choices=["CN", "HK", "US", "ALL"], help="Market label for logs.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when gate fails or fallback is used.")
    parser.add_argument(
        "--no-notify-on-warning",
        action="store_true",
        help="Disable WeCom warning notification for non-strict health issues.",
    )
    args = parser.parse_args()

    target_date = args.date or _today_beijing()
    return run_healthcheck(
        target_date=target_date,
        market=args.market,
        strict=args.strict,
        notify_on_warning=not args.no_notify_on_warning,
    )


if __name__ == "__main__":
    raise SystemExit(main())
