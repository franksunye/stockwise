# Stock Name i18n (CN/HK) — Current Standard

本文档已从“设计提案”收口为“当前标准”，聚焦已上线方案与维护口径。  
历史讨论与阶段性细节不再在此展开；如需追溯，查看 git 历史即可。

---

## 1. 目标与边界

### 目标

- 让 CN/HK 股票在英文界面优先显示可信英文名。
- 保持中文界面体验不变。
- 缺失英文名时稳定退化，不制造“伪英文名”。

### 边界

- 仅覆盖 `CN` / `HK` 的证券名称。
- 不包含 `industry` / `description` 等公司简介翻译。
- 不包含 US 市场命名体系改造。

---

## 2. 数据与显示语义

- `stock_meta.name`：中文主名称（canonical）
- `stock_meta.name_en`：可信英文名（nullable）
- `symbol`：唯一身份键，不参与“翻译”

英文界面显示规则（统一 helper）：

- `en`：`name_en`（去空白后）→ `symbol`
- `cn`：`name`

---

## 3. 线上真实架构（Single Source of Truth）

### 3.1 运行时（API / 前端）

- 权威来源：**数据库 `stock_meta.name_en`**
- API 返回 `name` + `name_en`
- 前端只消费 API 数据，不直接读取 `backend/data/*.json`

### 3.2 同步时（ETL）

`sync_stock_meta` 写入流程：

1. 上游元数据抓取（含 HK 英文字段）
2. 批量 UPSERT（保留 profile 字段，避免 `REPLACE` 擦字段）
3. `name_en_backfill`（Yahoo Finance，限速与每轮上限）
4. 策展 JSON 覆盖（`cn_name_en_curated.json` / `hk_name_en_curated.json`）

> 结论：JSON 是“ETL 覆盖层”，不是运行时数据源。

---

## 4. 质量与安全约束

- 仅接受可信 `name_en`；空值、中文污染、同名污染要过滤。
- 不允许用 `symbol` / `pinyin` 写入 `name_en`。
- `UPSERT` 只更新元数据字段，避免清空 `industry/main_business/description`。
- 缺失英文名允许 `NULL`，由前端按规则回退到 `symbol`。

---

## 5. 关键实现点（维护关注）

- DB schema: `backend/database.py`
- 元数据同步: `backend/fetchers.py`
- 英文名补全: `backend/name_en_backfill.py`（Yahoo）
- 质量清洗: `backend/name_en_sanitize.py`
- 查询与 SQL: `backend/db_repo/queries.py`
- 前端显示 helper: `frontend/src/lib/stock-name.ts`

---

## 6. 当前运维口径（2026-04）

- 每日定时任务：`meta_sync.yml`（UTC 22:00）
- 可手动补跑：GitHub Actions `Daily Stock Metadata Sync`
- 线上验证：
  - `backend/scripts/validate_prod_schema.py`
  - `backend/scripts/verify_prod_stock_meta_name_en_sample.py`
  - `frontend/scripts/verify-local-stock-name-en.mjs`（本地）

## 7. Production Runbook（合并自原 04）

### 7.1 发布前一次确认

- 主分支包含：`stock_meta.name_en`、`sync_stock_meta`、`name_en_backfill`（Yahoo）、`getLocalizedStockName`
- CI 绿（或本地关键检查通过）

### 7.2 数据库前置

- 确认生产 `stock_meta` 有 `name_en` 列：`python backend/scripts/validate_prod_schema.py`
- 若缺列，先补迁移，再执行同步任务

### 7.3 生产同步

- 日常依赖 `meta_sync.yml` 的 schedule（UTC 22:00）
- 需要立即生效时手动触发 `Daily Stock Metadata Sync`
- 观察 run 为 `success` 且日志包含“元数据同步完成”

### 7.4 发布后验证

抽样：

```bash
python backend/scripts/verify_prod_stock_meta_name_en_sample.py
```

覆盖率建议 SQL：

```sql
SELECT market,
       COUNT(*) AS total,
       SUM(CASE WHEN name_en IS NOT NULL AND TRIM(name_en)!='' THEN 1 ELSE 0 END) AS with_en
FROM stock_meta
GROUP BY market;
```

期望：`with_en` 随每日任务上升；个别 symbol 暂时为空属正常。

### 7.5 故障处理

- `name_en` 允许为 `NULL`，不阻塞主流程
- 若同步异常：回退 workflow/代码后重跑一次
- 若个别名称异常：优先修改 curated JSON 后重跑同步

---

## 8. 过渡说明（保留）

- 该专题已从“HK-first + curated CN”演进到“HK + CN 的 Yahoo 周期补齐 + curated 覆盖”。
- Tushare 路线已移除，不再作为正式方案的一部分。
- 后续仅保留两类增量工作：
  - 扩大策展映射（高价值标的）
  - 优化 Yahoo 补齐批次参数（时长 vs 覆盖率）

---

*Last updated: 2026-04-06*
