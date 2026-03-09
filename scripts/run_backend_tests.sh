#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
SUITE="default"

if [ "${1:-}" = "--suite" ]; then
  SUITE="${2:-default}"
  shift 2
fi

if [ ! -x "${VENV_DIR}/bin/python" ]; then
  python3 -m venv "${VENV_DIR}"
fi

"${VENV_DIR}/bin/python" -m pip install -r "${ROOT_DIR}/backend/requirements-dev.txt"

if [ "$#" -gt 0 ]; then
  "${VENV_DIR}/bin/python" -m pytest "$@"
else
  case "${SUITE}" in
    default)
      "${VENV_DIR}/bin/python" -m pytest backend/tests -m "not network"
      ;;
    unit)
      "${VENV_DIR}/bin/python" -m pytest backend/tests -m "not integration and not network"
      ;;
    integration)
      "${VENV_DIR}/bin/python" -m pytest backend/tests -m "integration"
      ;;
    network)
      RUN_NETWORK_TESTS=1 "${VENV_DIR}/bin/python" -m pytest backend/tests -m "network"
      ;;
    all)
      RUN_NETWORK_TESTS=1 "${VENV_DIR}/bin/python" -m pytest backend/tests
      ;;
    *)
      echo "Unknown suite: ${SUITE}" >&2
      echo "Usage: ./scripts/run_backend_tests.sh [--suite default|unit|integration|network|all] [pytest args...]" >&2
      exit 1
      ;;
  esac
fi
