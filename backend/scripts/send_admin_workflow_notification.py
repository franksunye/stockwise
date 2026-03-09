import argparse
import os
import sys
from typing import Dict, List


CURRENT_FILE = os.path.abspath(__file__)
SCRIPTS_DIR = os.path.dirname(CURRENT_FILE)
BACKEND_DIR = os.path.dirname(SCRIPTS_DIR)
ROOT_DIR = os.path.dirname(BACKEND_DIR)
for candidate in (ROOT_DIR, BACKEND_DIR):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

try:
    from backend.admin_notifications import (
        build_failure_message,
        build_success_message,
        get_admin_mobiles,
    )
    from backend.utils import send_wecom_notification
except ImportError:
    from admin_notifications import (  # type: ignore
        build_failure_message,
        build_success_message,
        get_admin_mobiles,
    )
    from utils import send_wecom_notification  # type: ignore


def parse_metadata(items: List[str]) -> Dict[str, str]:
    metadata: Dict[str, str] = {}
    for item in items:
        if "=" not in item:
            raise ValueError(f"Invalid metadata entry: {item}")
        key, value = item.split("=", 1)
        key = key.strip()
        if not key:
            raise ValueError(f"Invalid metadata key in entry: {item}")
        metadata[key] = value.strip()
    return metadata


def send_admin_workflow_notification(
    task_name: str,
    status: str,
    message: str,
    rerun_workflow: str | None = None,
    metadata: Dict[str, str] | None = None,
) -> bool:
    if status not in {"success", "failed"}:
        raise ValueError(f"Unsupported status: {status}")

    metadata = dict(metadata or {})
    if status == "success":
        content = build_success_message(task_name=task_name, metadata=metadata)
        return bool(send_wecom_notification(content))

    mentions = get_admin_mobiles() or ["@all"]
    content = build_failure_message(
        task_name=task_name,
        error_message=message,
        metadata=metadata,
        rerun_workflow=rerun_workflow,
    )
    return bool(send_wecom_notification(content, mentioned_mobile_list=mentions))


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a standardized ADMIN workflow notification.")
    parser.add_argument("--task-name", required=True, help="Human-readable workflow/task name.")
    parser.add_argument("--status", required=True, choices=["success", "failed"])
    parser.add_argument("--message", required=True, help="Summary text or failure reason.")
    parser.add_argument("--rerun-workflow", default=None, help="Workflow file for retry entry on failure.")
    parser.add_argument(
        "--meta",
        action="append",
        default=[],
        help="Metadata entry in key=value format. Repeatable.",
    )
    args = parser.parse_args()

    metadata = parse_metadata(args.meta)
    if args.message:
        metadata.setdefault("message", args.message)

    ok = send_admin_workflow_notification(
        task_name=args.task_name,
        status=args.status,
        message=args.message,
        rerun_workflow=args.rerun_workflow,
        metadata=metadata,
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
