# StockWise

> A multi-agent financial assistant for everyday investors.

StockWise is designed to empower everyday investors by leveraging advanced AI agents to provide personalized financial insights, analysis, and tracking. It combines a robust backend agentic system with a modern, user-friendly frontend interface.

## 📁 Project Structure

- **`/frontend`**: The user-facing web application built with Next.js, providing an intuitive dashboard and interactive tools.
- **`/backend`**: The core AI and data processing engine, handling financial data aggregation, prediction algorithms, and multi-agent coordination.
- **`/docs`**: The centralized knowledge base (Single Source of Truth), containing product strategy, system architecture, and operations guides.
- **`/scripts`**: Automation and utility scripts for local development and deployment.
- **`/data`**: Local data storage and configuration files.

## 🚀 Getting Started

Please refer to the detailed documentation located in the [`/docs`](./docs) directory for setup instructions, architecture overwiews, and contribution guidelines.

## 🧪 Test Environment

Backend test environment can be bootstrapped locally with the repo venv:

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install -r backend/requirements-dev.txt
./.venv/bin/python -m pytest backend/tests
```

Or use the helper script:

```bash
./scripts/run_backend_tests.sh
```

Available backend suites:

```bash
./scripts/run_backend_tests.sh --suite unit
./scripts/run_backend_tests.sh --suite integration
./scripts/run_backend_tests.sh --suite network
./scripts/run_backend_tests.sh --suite all
```

Default behavior runs the stable backend regression set and excludes `network` tests unless explicitly requested.

Manual diagnostics that are not part of the default regression suite live under `backend/manual_checks/`.

---
*Built for the everyday investor.*
