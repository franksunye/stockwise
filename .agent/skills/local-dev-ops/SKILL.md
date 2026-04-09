---
name: local-dev-ops
description: Offline Developer Operations. Covers local environment setup (zsh/Git), SQLite database synchronization (Bootstrap), and Local AI/Data experimentation.
---

# Local Developer Operations (Offline)

This skill is the master guide for maintaining and operating within the StockWise **Local Development Environment**. It ensures that your local machine is correctly configured, synchronized with production data for testing, and capable of running local AI prediction experiments.

## 1. Local Environment & Setups

We operate primarily in **macOS (zsh)**. All commands and scripts follow standard shell conventions.

### ⚠️ Environment Variables
*   **Targeting Local**: Ensure `export DB_SOURCE=local` is used to target the local `data/stockwise.db`.
*   **Targeting Cloud**: Use `export DB_SOURCE=cloud` for production-related debugging.

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
- **Missing PRO Symbols**: 使用 `node frontend/scripts/turso-cli.mjs query "..."` 直接从生产环境（Cloud）探索并获取目标列表，避免本地回填时的盲区。
- **Data Inconsistency**: If local results differ significantly from cloud, use the **Turso CLI Wrapper** to explore cloud data and compare with `node scripts/local-db-audit.mjs` outputs.

---

## 🛠️ Resources & Scripts

- **Sync Script**: `frontend/scripts/sync-remote-to-local.mjs`
- **Audit Script**: `frontend/scripts/local-db-audit.mjs`
- **Turso CLI Wrapper**: `frontend/scripts/turso-cli.mjs`
- **Local DB Path**: `data/stockwise.db`
