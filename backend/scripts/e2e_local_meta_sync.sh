#!/usr/bin/env bash
# Local E2E: SQLite stock_meta full sync + name_en coverage report.
# Usage (repo root):
#   chmod +x backend/scripts/e2e_local_meta_sync.sh
#   ./backend/scripts/e2e_local_meta_sync.sh
#
# Optional: 全新空库（删除旧 stock_meta 残留行）可先执行:
#   rm -f data/stockwise.db
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export DB_SOURCE=local
# 快速验证可调低 Yahoo 上限；全量补全去掉或增大 NAME_EN_YAHOO_MAX_*
export NAME_EN_YAHOO_MAX_CN="${NAME_EN_YAHOO_MAX_CN:-2000}"
export NAME_EN_YAHOO_MAX_HK="${NAME_EN_YAHOO_MAX_HK:-1200}"
export NAME_EN_YAHOO_SLEEP_SEC="${NAME_EN_YAHOO_SLEEP_SEC:-0.12}"

echo "==> init_db (local SQLite)"
python3 -c "import sys; sys.path.insert(0,'${ROOT}/backend'); from database import init_db; init_db()"

echo "==> sync_stock_meta"
python3 backend/main.py --sync-meta

echo "==> name_en coverage"
DB_SOURCE=local python3 backend/scripts/verify_local_stock_meta_name_en_stats.py

echo "==> optional single-symbol check (frontend)"
echo "    cd frontend && npm run verify:local-stock-name-en -- 00700"
