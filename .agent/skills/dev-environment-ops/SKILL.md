---
name: dev-environment-ops
description: Essential guidelines and utilities for the Local Development Environment (Windows/Powershell), including specialized instructions for Database Operations (Local vs. Online) and Git workflows.
---

# Development Environment Operations (Powershell & Data)

This skill provides the definitive guide for operating within the current Windows (Powershell) environment. It covers standard Git practices, handling the dual-database architecture (Local SQLite vs. Online Turso), and common Powershell gotchas.

## 1. Powershell Environment Best Practices

We are running in **Powershell Core** on Windows. This environment has specific properties you must respect:

### ⚠️ Critical "Gotchas"
*   **Cmdlet Availability**: 
    *   `grep`, `sed`, `awk` are **NOT** natively available or reliable.
    *   **Do not use** `grep -r`; use `Select-String` or standard `findstr` (only if simple), or better yet, rely on the Agent's file tools (`grep_search`).
    *   **Do not use** `&&` for chaining commands in older Powershell versions (though PS 7+ supports it). Prefer `;` or `if ($?) { ... }` for safety.
*   **Path Separators**: 
    *   Windows uses `\` (Backslash). 
    *   However, Node.js and Python import paths use `/`.
    *   **Agent Rule**: When using tools like `view_file` or `list_dir`, **Always use absolute paths** (e.g., `c:\cygwin64\home\frank\StockWise\...`).
*   **Environment Variables**:
    *   **Setting (Session)**: `$env:VARIABLE_NAME = "value"` (e.g., `$env:DB_SOURCE = "cloud"`)
    *   **Inline (One-off)**: In Powershell, you cannot do `DB_SOURCE=cloud node script.js`. You must do:
        ```powershell
        $env:DB_SOURCE="cloud"; node script.js
        ```

### Git Operations
*   **Git Bash Tools**: If `git` is available, standard git commands work.
*   **Quoting**: Be careful with quoting SQL strings or JSON in parameters. Use single quotes `'` for outer wrappers where possible to avoid Powershell interpreting special characters.
    *   *Bad*: `git commit -m "fix: "hello""`
    *   *Good*: `git commit -m "fix: 'hello'"`

### ⚠️ Terminal Command Status Synchronization

**Problem**: Some commands (especially `git commit` with long messages, or interactive commands) may appear as "RUNNING" in `command_status` even though they have **already completed** in the terminal.

**Root Cause**: The `command_status` tool relies on async callbacks which may not update immediately. The terminal output is the **source of truth**.

**Solution**: When a command seems stuck or `command_status` keeps returning "RUNNING":

1.  **Use `read_terminal` instead of `command_status`**:
    ```
    read_terminal(ProcessID: "<id>", Name: "<name>")
    ```
    This directly reads the terminal buffer and shows the actual output, including the prompt (e.g., `PS C:\...\>`) which confirms command completion.

2.  **Look for completion indicators**:
    *   Git commit success: `[branch hash] commit message`
    *   Git push success: `To https://... branch -> branch`
    *   Command prompt returned: `PS C:\path\>`

3.  **When user mentions terminal via `@[TerminalName: ..., ProcessId: ...]`**:
    Always use `read_terminal` to check the actual state before making assumptions.

**Example**:
```
# If command_status shows RUNNING but user says it's done:
read_terminal(ProcessID: "17556", Name: "Antigravity Agent")
# Check output for: "[main 3af9ca7] fix: ..." or prompt "PS C:\...>"
```

## 2. Database Operations

The project uses a hybrid architecture:
1.  **Local Dev**: `data/stockwise.db` (SQLite)
2.  **Production**: Turso Cloud (LibSQL) via `TURSO_DB_URL`

### 🌐 Online (Cloud) Database Operations
**Primary Tool**: `frontend/scripts/turso-cli.mjs`

To query the **Production** database, use the `turso-cli.mjs` script. It automatically loads credentials from `backend/.env`.

*   **List Tables**:
    ```powershell
    node frontend/scripts/turso-cli.mjs tables
    ```
*   **Run Arbitrary SQL**:
    ```powershell
    node frontend/scripts/turso-cli.mjs query "SELECT id, title FROM notification_logs ORDER BY sent_at DESC LIMIT 5"
    ```
*   **Check Record Counts**:
    ```powershell
    node frontend/scripts/turso-cli.mjs count user_watchlist
    ```
*   **Diagnose Data Issues**:
    Use `--raw` (if supported by script modification) or `console.table` output to verify data existence.

### 🔄 Syncing Cloud Data to Local (1:1 Replica)
**Primary Tool**: `frontend/scripts/sync-remote-to-local.mjs`

To reproduce production issues locally or test safely, you can pull a 1:1 replica of the Turso database (schema and data) into your local `data/stockwise.db`.

```powershell
# Run from the frontend/ directory
node scripts/sync-remote-to-local.mjs
```
*(Note: This automatically makes a timestamped backup of your current local DB before overwriting).*

### 🏠 Local Development Database Operations
**Primary Tool**: `sqlite3` (CLI) or Python Scripts

The local database is a file at `data/stockwise.db`. The `turso-cli.mjs` tool is **hardcoded** to read `.env` and connect to Turso. Do NOT use it for local DB by default.

*   **Accessing Local DB**:
    *   If `sqlite3` is in your path:
        ```powershell
        sqlite3 data/stockwise.db "SELECT name FROM sqlite_master WHERE type='table';"
        ```
    *   **Using Python (Recommended)**:
        Most backend scripts respect the `DB_STRATEGY` (or `DB_SOURCE`) environment variable.
        *   `local`: Uses `data/stockwise.db`
        *   `cloud`: Uses Turso

*   **Example: Running Query Locally via Python**:
    Create a quick one-off script:
    ```powershell
    python -c "import sqlite3; conn = sqlite3.connect('data/stockwise.db'); print(conn.execute('SELECT COUNT(*) FROM daily_prices').fetchone())"
    ```

*   **Switching Contexts (Backend & Frontend)**:
    The entire ecosystem (Python backend & Next.js frontend) uses the `DB_SOURCE` (or `DB_STRATEGY`) environment variable to hot-swap database connections seamlessly.

    *   **Target Local (Default for dev)**:
        Reads from `data/stockwise.db`. Ideal for safe debugging after a remote sync.
        ```powershell
        $env:DB_SOURCE="local"; python backend/scripts/daily_morning_call.py --dry-run
        # Frontend
        $env:DB_SOURCE="local"; npm run dev
        ```
    *   **Target Cloud (Testing Production)**:
        Connects directly to Turso.
        ```powershell
        $env:DB_SOURCE="cloud"; python -m backend.engine.brief_generator
        # Frontend
        $env:DB_SOURCE="cloud"; npm run dev
        ```

### 2.3 Safe Data Purging SOP (Administrative)
When tasked with deleting sensitive production data (e.g., "Delete user X and all their traces"):

1.  **Dependency Discovery**: Identify all tables containing the ID. Common tables include:
    *   `users` (root)
    *   `user_watchlist`, `daily_briefs`, `notification_logs`, `push_subscriptions`
    *   `invitation_codes` (references as logical owner)
    *   `referral_transactions`
2.  **Impact Verification**: Run a single query to count rows across all suspected tables before deleting.
3.  **Safe Sequence**:
    *   **Delete Child/Log Data First**: `daily_briefs`, `notification_logs`, etc.
    *   **Unbind Reusable Resources**: For `invitation_codes`, set `used_by_user_id = NULL` rather than deleting the code itself.
    *   **Delete Root Last**: `DELETE FROM users WHERE user_id = '...'`.
4.  **Final Audit**: Re-run the count query to confirm 0 records remain.

## 3. Workflow Summary (Cheatsheet)

| Task                   | Command / Pattern                                                           |
| :--------------------- | :-------------------------------------------------------------------------- |
| **Sync DB 1:1 to Loc** | `cd frontend; node scripts/sync-remote-to-local.mjs`                        |
| **Check Product Data** | `node frontend/scripts/turso-cli.mjs query "SELECT ..."`                    |
| **Check Local Data**   | `sqlite3 data/stockwise.db "SELECT ..."`                                    |
| **Purge User Data**    | Follow Section 2.3 sequence (Verify -> Purge Logs -> Unbind -> Delete Root) |
| **Run Python (Prod)**  | `$env:DB_SOURCE="cloud"; python backend/script.py`                          |
| **Run Python (Dev)**   | `$env:DB_SOURCE="local"; python backend/script.py`                          |
| **Run Frontend (Prod)**| `$env:DB_SOURCE="cloud"; npm run dev`                                       |
| **Run Frontend (Dev)** | `$env:DB_SOURCE="local"; npm run dev`                                       |
| **Search Code**        | Use Agent Tool `grep_search` or `Select-String` (avoid `grep`)              |
