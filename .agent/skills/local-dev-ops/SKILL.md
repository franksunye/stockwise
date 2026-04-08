---
name: local-dev-ops
description: Offline Developer Operations. Covers local environment setup (PowerShell/Git), SQLite database synchronization (Bootstrap), and Local AI/Data experimentation.
---

# Local Developer Operations (Offline)

This skill is the master guide for maintaining and operating within the StockWise **Local Development Environment**. It ensures that your local machine is correctly configured, synchronized with production data for testing, and capable of running local AI prediction experiments.

## 1. PowerShell & Environment Setups

We operate primarily in **macOS (zsh)** in this environment, but these guidelines also respect project standards for cross-platform compatibility where mentioned.

### ⚠️ Environment Variables
*   **Targeting Local**: Ensure `$env:DB_SOURCE = "local"` (or `export DB_SOURCE=local`) is set to use the local `data/stockwise.db`.
*   **Targeting Cloud**: Use `cloud` for production-related scripts (only when explicitly necessary for debugging).

---

## 2. Local Database Lifecycle (Bootstrap & Sync)

When you need to "make the local DB complete" or "reproduce production data locally," follow these SOPs.

### 2.1 Sync Remote to Local (1:1 Replica)
**Goal**: Pull a 1:1 replica of the Turso database (schema and data) into your local `data/stockwise.db`.
- **Command**: 
    ```bash
    cd frontend && node scripts/sync-remote-to-local.mjs
    ```
- **Prerequisites**: `TURSO_DB_URL` and `TURSO_AUTH_TOKEN` must be in the root `.env` or `backend/.env`.
- **Safety**: The script automatically creates a timestamped backup of the existing `data/stockwise.db`.

### 2.2 Local Database Audit
**Goal**: Verify if the local DB has business data (not just empty tables).
- **Command**: 
    ```bash
    cd frontend && node scripts/local-db-audit.mjs
    ```
- **Checklist**:
    - `daily_prices`: `MAX(date)` should not be empty.
    - `stock_meta`: Should contain records.
    - `ai_predictions_v2`: Should contain historical records for testing.

---

## 3. Local AI & Data Experimentation

Use the local environment to test new prompts, models, or data pipelines without affecting production.

### 3.1 Local AI Prediction Flow
**Goal**: Run a prediction for a specific stock using local data.
1.  **Sync specific stock data to local**:
    ```bash
    export DB_SOURCE=local; python backend/main.py --symbol 00700
    ```
2.  **Execute Local Inference**:
    ```bash
    export DB_SOURCE=local; python backend/main.py --analyze --symbol 00700 --model gemini-3-flash --force
    ```
3.  **Instant Verification**:
    ```bash
    sqlite3 data/stockwise.db "SELECT signal, ai_reasoning FROM ai_predictions_v2 WHERE symbol='00700' ORDER BY created_at DESC LIMIT 1;"
    ```

### 3.2 Troubleshooting Common Issues
- **Missing PRO Symbols**: Use `turso-cli` (wrapped in `local-data-ops` logic previously) to fetch the target list from production before running local backfills.
- **SQL Parsing Errors**: If PowerShell strips quotes, use a one-off Python migration script for JSON updates.

---

## 🛠️ Resources & Scripts

- **Sync Script**: `frontend/scripts/sync-remote-to-local.mjs`
- **Audit Script**: `frontend/scripts/local-db-audit.mjs`
- **Turso CLI Wrapper**: `frontend/scripts/turso-cli.mjs`
- **Local DB Path**: `data/stockwise.db`
