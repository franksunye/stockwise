"""
Run HK short selling POC sync and print a concise report.
"""
import argparse
import json
import os
import sys

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
ROOT_DIR = os.path.dirname(BACKEND_DIR)
for p in (ROOT_DIR, BACKEND_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.database import init_db
from backend.sync.hk_short import sync_hk_short_poc


def main():
    parser = argparse.ArgumentParser(description="HK short selling POC sync")
    parser.add_argument("--limit", type=int, default=50, help="HK scope symbol limit from global_stock_pool")
    args = parser.parse_args()

    init_db()
    result = sync_hk_short_poc(limit_symbols=args.limit)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())

