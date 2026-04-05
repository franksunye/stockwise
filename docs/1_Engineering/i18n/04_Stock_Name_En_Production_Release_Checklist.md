# Stock `name_en` — Production Release Checklist

将「英文证券展示名」安全推到 **app.ziso.cc + Turso** 时的执行清单。设计背景见 [01_Stock_Name_Internationalization.md](./01_Stock_Name_Internationalization.md) §15–§16。

---

## 1. 发布前（代码）

- [ ] 主分支已包含：`stock_meta.name_en`、ETL（`sync_stock_meta` + 策展 JSON + `sanitize_hk_name_en_candidate`）、前端 `getLocalizedStockName`、自选/搜索/Dashboard 合并逻辑、`middleware` 本地与官网分流。
- [ ] 本地已通过：`cd frontend && npm run build`；`pytest backend/tests/test_sanitize_hk_name_en.py backend/tests/test_hk_name_en_curated_json.py backend/tests/test_stock_meta_upsert.py`（或全量 CI）。

---

## 2. 生产数据库（Turso）

- [ ] 确认 `stock_meta` 存在 **`name_en`** 列。  
  - 在已配置 `TURSO_DB_URL` / `TURSO_AUTH_TOKEN` 的环境中运行：  
    `python backend/scripts/validate_prod_schema.py`  
  - 若报错缺列：对生产库执行与 `backend/database.py` 中 `add_column_if_missing('stock_meta', 'name_en', ...)` 等价的迁移，或通过一次会跑 `init_db` 的受控任务补列（按你们现有 SOP）。

---

## 3. 生产元数据同步（写 `name_en`）

- [ ] **合并发布后**，在本仓库 **GitHub Actions → “Daily Stock Metadata Sync”**（`meta_sync.yml`）点 **Run workflow**，或等待定时任务（UTC 22:00 ≈ 北京时间次日 06:00）。
- [ ] 确认 Workflow 使用的 `TURSO_*` Secrets 指向**生产库**。
- [ ] 查看运行日志 / 企微通知：`python backend/main.py --sync-meta` 成功结束。

> 说明：`meta_sync` 从仓库拉代码，自带 `backend/data/cn_name_en_curated.json` 与 `hk_name_en_curated.json`，无需额外配置。

### 自动补全英文名（`backend/name_en_backfill.py`）

每次 `sync_stock_meta` 在批量 UPSERT 之后、策展 JSON 之前会执行：

- **Yahoo Finance（yfinance）**：默认开启，对仍为空的 **CN/HK** 按 symbol 映射为 `.SS/.SZ/.BJ/.HK` 拉 `longName`/`shortName`；限速由 `NAME_EN_YAHOO_SLEEP_SEC` 控制，每轮上限 `NAME_EN_YAHOO_MAX_CN` / `NAME_EN_YAHOO_MAX_HK`（多跑几轮元数据任务可逐步扫完）。关闭：`NAME_EN_YAHOO=0`。

策展 JSON 仍最后写入，覆盖自动结果。

---

## 4. 发布后抽样校验（可选但推荐）

在**已配置 Turso 环境变量**的机器上：

```bash
python backend/scripts/verify_prod_stock_meta_name_en_sample.py
```

或手工 SQL（Turso CLI / 控制台）：

```sql
SELECT symbol, name, name_en FROM stock_meta WHERE symbol IN ('00700', '600519', '09988');
```

期望：港股 `00700` 等在同步成功后 **`name_en` 非空**（具体字符串以上游/策展为准）；策展 A 股如 `600519` 有英文名。

---

## 5. 端上抽检（app.ziso.cc）

- [ ] 部署最新 **Vercel**（或当前 App 前端渠道）。
- [ ] 浏览器 `stockwise_locale` / 语言为 **English**，自选包含 **00700**（或任意已知有 `name_en` 的标的）。
- [ ] Dashboard 顶栏显示 **英文名**（或仅代码——若该标的在生产库仍无 `name_en`，属数据未覆盖而非前端故障）。

---

## 6. 回滚与风险

- `name_en` 可为 `NULL`；旧客户端忽略多余字段，**回滚主要为回滚前端部署**。
- 若仅同步写坏数据（极少见），可用备份或按 symbol 手工 `UPDATE stock_meta SET name_en = ...` 修复。

---

## 7. 相关自动化

| 项 | 位置 |
|----|------|
| 定时/手动元数据同步 | `.github/workflows/meta_sync.yml` |
| 生产 schema 校验 | `backend/scripts/validate_prod_schema.py` |
| 抽样打印 `name_en` | `backend/scripts/verify_prod_stock_meta_name_en_sample.py` |
| Yahoo 周期补全 | `backend/name_en_backfill.py`（由 `fetchers.sync_stock_meta` 调用） |
| 本地库自检 | `frontend`: `npm run verify:local-stock-name-en` |

---

*Last updated: 2026-04-05*
