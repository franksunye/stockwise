#!/usr/bin/env bash
set -euo pipefail

# Vercel Ignored Build Step rule:
# exit 1 => build is required
# exit 0 => build can be skipped

BASE_SHA=""
HEAD_SHA="HEAD"
TARGET_PATH="."

# Support both:
# 1) running at repo root (has ./frontend)
# 2) running inside frontend root directory
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
  TARGET_PATH="frontend"
fi

if [ -n "${VERCEL_GIT_PREVIOUS_SHA:-}" ] && [ -n "${VERCEL_GIT_COMMIT_SHA:-}" ] \
  && git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null \
  && git cat-file -e "${VERCEL_GIT_COMMIT_SHA}^{commit}" 2>/dev/null; then
  BASE_SHA="${VERCEL_GIT_PREVIOUS_SHA}"
  HEAD_SHA="${VERCEL_GIT_COMMIT_SHA}"
elif git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  BASE_SHA="HEAD^"
else
  echo "No previous commit available. Build required."
  exit 1
fi

if git diff --quiet "${BASE_SHA}" "${HEAD_SHA}" -- "${TARGET_PATH}"; then
  echo "No changes in ${TARGET_PATH}/. Skip build."
  exit 0
fi

echo "Changes detected in ${TARGET_PATH}/. Build required."
exit 1
