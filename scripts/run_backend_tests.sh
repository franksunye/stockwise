#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
SUITE="default"
PYTEST_ARGS=()
HAS_TARGETS=0

if [ "${1:-}" = "--suite" ]; then
  SUITE="${2:-default}"
  shift 2
fi

if [ ! -x "${VENV_DIR}/bin/python" ]; then
  python3 -m venv "${VENV_DIR}"
fi

"${VENV_DIR}/bin/python" -m pip install -r "${ROOT_DIR}/backend/requirements-dev.txt"

for arg in "$@"; do
  PYTEST_ARGS+=("${arg}")
  if [[ "${arg}" != -* ]]; then
    HAS_TARGETS=1
  fi
done

if [ "${HAS_TARGETS}" -eq 1 ]; then
  if [ "${#PYTEST_ARGS[@]}" -gt 0 ]; then
    "${VENV_DIR}/bin/python" -m pytest "${PYTEST_ARGS[@]}"
  else
    "${VENV_DIR}/bin/python" -m pytest
  fi
  exit 0
fi

case "${SUITE}" in
  default)
    if [ "${#PYTEST_ARGS[@]}" -gt 0 ]; then
      "${VENV_DIR}/bin/python" -m pytest backend/tests -m "not network" "${PYTEST_ARGS[@]}"
    else
      "${VENV_DIR}/bin/python" -m pytest backend/tests -m "not network"
    fi
    ;;
  unit)
    if [ "${#PYTEST_ARGS[@]}" -gt 0 ]; then
      "${VENV_DIR}/bin/python" -m pytest backend/tests -m "not integration and not network" "${PYTEST_ARGS[@]}"
    else
      "${VENV_DIR}/bin/python" -m pytest backend/tests -m "not integration and not network"
    fi
    ;;
  integration)
    if [ "${#PYTEST_ARGS[@]}" -gt 0 ]; then
      "${VENV_DIR}/bin/python" -m pytest backend/tests -m "integration" "${PYTEST_ARGS[@]}"
    else
      "${VENV_DIR}/bin/python" -m pytest backend/tests -m "integration"
    fi
    ;;
  network)
    if [ "${#PYTEST_ARGS[@]}" -gt 0 ]; then
      RUN_NETWORK_TESTS=1 "${VENV_DIR}/bin/python" -m pytest backend/tests -m "network" "${PYTEST_ARGS[@]}"
    else
      RUN_NETWORK_TESTS=1 "${VENV_DIR}/bin/python" -m pytest backend/tests -m "network"
    fi
    ;;
  all)
    if [ "${#PYTEST_ARGS[@]}" -gt 0 ]; then
      RUN_NETWORK_TESTS=1 "${VENV_DIR}/bin/python" -m pytest backend/tests "${PYTEST_ARGS[@]}"
    else
      RUN_NETWORK_TESTS=1 "${VENV_DIR}/bin/python" -m pytest backend/tests
    fi
    ;;
  *)
    echo "Unknown suite: ${SUITE}" >&2
    echo "Usage: ./scripts/run_backend_tests.sh [--suite default|unit|integration|network|all] [pytest args...]" >&2
    exit 1
    ;;
esac
