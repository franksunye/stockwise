---
name: system-devops-ops
description: Online Systems Operations (SRE). Covers production task auditing, Cloudflare Worker orchestration, scheduled maintenance, and safe production data patching.
---

# System DevOps Operations (Online)

This skill provides the definitive guide for maintaining the **StockWise Production Ecosystem**. It focuses on observability, reliability, and precision scheduling of the global market data pipelines.

## 核心原则 (Core Principles)
*   **Turso CLI First**: 对于线上/生产数据库的所有**临时探索 (Exploration)**、查询与修改，**必须优先使用** `node frontend/scripts/turso-cli.mjs`。
    *   *理由*：无需编写样板代码、自动加载生产凭据、执行极速且结果以表格形式呈现，易于审计数据状态。
*   **Observability First**: 任何线上手动操作（如数据 Patching 或 Purging）前必须先执行 `COUNT` 验证受影响行数。

---

## 1. Production Pipeline Auditing (Daily Check)

Every day, the system health must be audited to ensure that CN, HK, and US market tasks executed within their canonical windows.

### 1.1 The Audit Tool
We use the automated audit script to compare `task_logs` data against the orchestration map.
- **Command**: 
    ```bash
    export DB_SOURCE=cloud; python backend/scripts/audit_task_logs.py --hours 24
    ```
- **Acceptance Criteria**:
    - All tasks marked `success`.
    - No "MISSING" flags for the current trading day.
    - Low latency (Execution - Plan Window Start < 15m).

### 1.2 Remediation
If a task is failed or missing:
1.  Check Cloudflare Worker logs for trigger failures.
2.  Check GitHub Actions runs for worker-dispatched failures.
3.  Manually re-run the specific workflow via `workflow_dispatch`.

---

## 2. Cloudflare Worker Orchestration

All global production pipelines are unified under the Cloudflare Worker "Heartbeat" scheduler.

### 2.1 The Job Registry
The canonical trigger times (BJT) are defined in `cloudflare-worker/worker.js`:
- **US Daily**: 06:30
- **Morning Call**: 08:30
- **CN Daily**: 16:00
- **HK Daily**: 16:30
- **Realtime Sync**: Every 5m (during trading windows).

### 2.2 Deployment SOP
When modifying the scheduler or triggers:
1.  Update `worker.js`.
2.  Run deployment:
    ```bash
    cd cloudflare-worker && npx -y wrangler deploy
    ```
3.  Verify the triggers in the Cloudflare Dashboard.

---

## 3. Safe Production Data Patching (Admin)

When tasked with repairing or purging sensitive production data (e.g., "Delete user X" or "Fix corrupted predictions"):

### 3.1 Step-by-Step Data Purging
1.  **Dependency Discovery**: Identify all tables containing the ID (e.g., `users`, `user_watchlist`, `notification_logs`).
2.  **Impact Verification**: Run a `SELECT COUNT(*)` across all identified tables before deleting.
3.  **Safe Sequence**:
    - Delete Child/Log Data First (e.g., `notification_logs`).
    - Unbind Reusable Resources (e.g., `invitation_codes.used_by_user_id = NULL`).
    - Delete Root Last (`DELETE FROM users WHERE user_id = '...'`).
4.  **Final Audit**: Re-verify with counts to ensure 0 records remain.

### 3.2 SQL Execution & Exploration (Cloud)
Always use the `turso-cli` wrapper for both quick exploration and precise data logic patching:
```bash
# Exploration: List tables, show stocks, count records
node frontend/scripts/turso-cli.mjs tables
node frontend/scripts/turso-cli.mjs count <table_name>

# Execution: Run arbitrary SQL safely
node frontend/scripts/turso-cli.mjs query "UPDATE table SET col = val WHERE id = '...'"
```

---

## 4. Periodic User Cleanup (Ghost User Purge)

To maintain database performance and reduce "noise" for marketing push notifications, we perform periodic cleanups of inactive free users.

### 4.1 "Ghost User" Criteria
A user is marked for cleanup if they meet **ALL** of the following:
*   **Tier**: `free` (PRO and GO members are **NEVER** purged).
*   **Inactivity**: `last_active_at` is older than **30 days**.
*   **Zero Data**: No stocks in `user_watchlist` and no simulator data (`user_trade_positions`).

### 4.2 Cleanup SOP
1.  **Dry Run**:
    ```bash
    export DB_SOURCE=cloud; python backend/scripts/cleanup_inactive_users.py
    ```
2.  **Verify Backup**: Check the generated CSV in `tmp/` to ensure no active or premium users are listed.
3.  **Execute**:
    ```bash
    export DB_SOURCE=cloud; python backend/scripts/cleanup_inactive_users.py --execute
    ```

---

## 🛡️ Service Level Standards (SLA)
- **Data Latency**: Daily syncs must complete within 30 minutes of market close.
- **Task Success**: 99.5% completion rate across global markets.
- **Audit Cadence**: Minimum once per 24 hours.
