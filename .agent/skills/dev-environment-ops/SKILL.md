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
1.  **Local Dev**: `backend/stockwise.db` (SQLite)
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

### 🏠 Local Development Database Operations
**Primary Tool**: `sqlite3` (CLI) or Python Scripts

The local database is a file at `backend/stockwise.db`. The `turso-cli.mjs` tool is **hardcoded** to read `.env` and connect to Turso. Do NOT use it for local DB by default.

*   **Accessing Local DB**:
    *   If `sqlite3` is in your path:
        ```powershell
        sqlite3 backend/stockwise.db "SELECT name FROM sqlite_master WHERE type='table';"
        ```
    *   **Using Python (Recommended)**:
        Most backend scripts respect the `DB_STRATEGY` (or `DB_SOURCE`) environment variable.
        *   `local`: Uses `backend/stockwise.db`
        *   `cloud`: Uses Turso

*   **Example: Running Query Locally via Python**:
    Create a quick one-off script:
    ```powershell
    python -c "import sqlite3; conn = sqlite3.connect('backend/stockwise.db'); print(conn.execute('SELECT COUNT(*) FROM daily_prices').fetchone())"
    ```

*   **Switching Contexts**:
    When running `daily_morning_call.py` or `brief_generator.py`, **explicitly set the target**:
    *   **Target Cloud**:
        ```powershell
        $env:DB_SOURCE="cloud"; python backend/scripts/daily_morning_call.py --dry-run
        ```
    *   **Target Local** (Default if env var missing, but be explicit):
        ```powershell
        $env:DB_SOURCE="local"; python backend/scripts/daily_morning_call.py --dry-run
        ```

## 3. Workflow Summary (Cheatsheet)

| Task                   | Command / Pattern                                              |
| :--------------------- | :------------------------------------------------------------- |
| **Check Product Data** | `node frontend/scripts/turso-cli.mjs query "SELECT ..."`       |
| **Check Local Data**   | `sqlite3 backend/stockwise.db "SELECT ..."`                    |
| **Run Python (Prod)**  | `$env:DB_SOURCE="cloud"; python backend/script.py`             |
| **Run Python (Dev)**   | `$env:DB_SOURCE="local"; python backend/script.py`             |
| **Search Code**        | Use Agent Tool `grep_search` or `Select-String` (avoid `grep`) |
