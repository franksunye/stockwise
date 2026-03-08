---
name: local-sqlite-bootstrap
description: 用于把 StockWise 的本地 SQLite 数据库补齐到可开发状态。适用于本地库只有表结构、缺少业务数据、需要从 Turso 1:1 拉取到 data/stockwise.db，或需要审计本地库完整度时。
---

# Local SQLite Bootstrap

当用户要求“把本地 SQLite 配完整”“让本地库数据齐全”“同步线上库到本地”时，优先使用这个技能。

## 目标

把本地开发数据库固定为：

- 路径：`data/stockwise.db`
- 环境：`DB_SOURCE=local`
- 验收：`integrity_check=ok`，且关键业务表有可用数据

## 标准流程

1. 先审计本地库
   - 在 `frontend/` 下执行：`npm run db:audit-local`
   - 若关键表如 `daily_prices`、`stock_meta`、`global_stock_pool`、`ai_predictions_v2` 全为 0，则本地库只有 schema，没有业务数据。

2. 再尝试 1:1 同步远程库到本地
   - 在 `frontend/` 下执行：`npm run db:sync-local`
   - 脚本会自动读取仓库根目录 `.env`，若没有，再读 `backend/.env`
   - 需要存在：`TURSO_DB_URL`、`TURSO_AUTH_TOKEN`
   - 脚本会：
     - 备份旧的 `data/stockwise.db`
     - 拉取远程 schema
     - 批量导入所有表数据
     - 对每张表做远程/本地行数校验
     - 执行 `PRAGMA integrity_check`

3. 同步后再次审计
   - 执行：`npm run db:audit-local`
   - 重点确认：
     - `daily_prices` 有数据且 `MAX(date)` 不为空
     - `stock_meta` 有数据
     - `global_stock_pool` 有数据
     - `ai_predictions_v2`、`users`、`user_watchlist` 视远程库情况不为空

## 阻塞项处理

- 如果 `db:sync-local` 报缺少 `TURSO_DB_URL` / `TURSO_AUTH_TOKEN`
  - 不要假装同步成功
  - 明确说明当前本地库无法做 1:1 完整复制
  - 告诉用户只差把远程库凭据放进根目录 `.env` 或 `backend/.env`

- 如果用户只想要“可启动”而不是“1:1 完整”
  - 可以仅保留 `DB_SOURCE=local`
  - 运行 `backend.main init_db()` 创建 schema
  - 但必须明确说明：这不等于数据齐全

## 相关入口

- 同步脚本：`frontend/scripts/sync-remote-to-local.mjs`
- 审计脚本：`frontend/scripts/local-db-audit.mjs`
- 本地环境文件：`.env`
