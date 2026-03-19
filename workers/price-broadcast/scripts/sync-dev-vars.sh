#!/bin/sh
# 从 backend/.env 或 frontend/.env 同步 TURSO_DB_URL、TURSO_AUTH_TOKEN 到 .dev.vars
# 用于 wrangler dev 本地联调
cd "$(dirname "$0")/.."
ROOT="$(cd ../.. && pwd)"
for f in "$ROOT/backend/.env" "$ROOT/frontend/.env"; do
  if [ -f "$f" ]; then
    echo "# Synced from $(basename $(dirname $f))/.env" > .dev.vars
    grep -E "^(TURSO_DB_URL|TURSO_AUTH_TOKEN)=" "$f" >> .dev.vars 2>/dev/null || true
    echo "Created .dev.vars from $f"
    exit 0
  fi
done
echo "No backend/.env or frontend/.env found"
exit 1
