# StockWise 系统架构

> **更新时间**: 2025-12-26  
> **版本**: v1.0

## 📐 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    用户层 (Browser)                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Next.js Frontend (Vercel)                         │    │
│  │  - Dashboard (实时监控 + AI 建议)                   │    │
│  │  - Stock Pool (个人自选股管理)                      │    │
│  │  - History (历史预测验证)                           │    │
│  └────────────────────┬───────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Routes (Serverless)                │
│  /api/stock          - 获取股票数据 + AI 预测               │
│  /api/stock-pool     - 用户自选股 CRUD                      │
│  /api/predictions    - AI 预测历史                          │
│  /api/user/*         - 用户管理 (隐式注册)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database (Turso SQLite)                    │
│  - stock_meta           (股票元数据, 5000+ 只)              │
│  - global_stock_pool    (全局关注池)                        │
│  - user_watchlist       (用户自选股)                        │
│  - daily/weekly/monthly_prices (多周期行情 + 技术指标)      │
│  - ai_predictions       (AI 预测 + 验证结果)                │
└────────────────────────┬────────────────────────────────────┘
                         │ Read Stock Pool
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            Python ETL Pipeline (GitHub Actions)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Daily Sync (18:30 UTC+8, 工作日)                    │  │
│  │  - 抓取行情 (AkShare)                                 │  │
│  │  - 计算技术指标 (Pandas TA)                           │  │
│  │  - 生成 AI 预测 (基于规则引擎)                        │  │
│  │  - 验证昨日预测                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Realtime Sync (每 10 分钟, 交易时段)                │  │
│  │  - 更新盘中价格                                       │  │
│  │  - 重算实时指标                                       │  │
│  │  - 触发器: Cloudflare Worker                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Metadata Sync (每日 06:00 UTC+8)                    │  │
│  │  - 同步 A 股/港股列表 (5000+ 只)                      │  │
│  │  - 更新拼音索引 (支持搜索)                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🗄️ 核心数据表

### 1. 股票数据层
```sql
-- 多周期行情 (日/周/月)
daily_prices, weekly_prices, monthly_prices
  - symbol, date (联合主键)
  - OHLCV (开高低收量)
  - 技术指标: MA(5/10/20/60), MACD, BOLL, RSI, KDJ

-- 股票元数据
stock_meta
  - symbol (PK), name, market (CN/HK)
  - pinyin, pinyin_abbr (搜索索引)
```

### 2. 用户系统层
```sql
-- 用户表 (隐式注册)
users
  - user_id (UUID, PK)
  - registration_type: anonymous/explicit
  
-- 用户自选股 (多对多)
user_watchlist
  - user_id, symbol (联合主键)
  
-- 全局股票池 (聚合)
global_stock_pool
  - symbol (PK)
  - watchers_count (关注人数, 决定 ETL 优先级)
```

### 3. AI 预测层
```sql
ai_predictions
  - symbol, date (联合主键)
  - signal: Long/Short/Side
  - confidence: 0.50-0.88
  - ai_reasoning: JSON (推理链 + 战术建议)
  - validation_status: Pending/Hit/Miss
  - actual_change (验证结果)
```

## 🔄 关键业务流程

### 1. 用户添加自选股
```
用户输入股票代码
  ↓
POST /api/stock-pool
  ↓
写入 user_watchlist
  ↓
更新 global_stock_pool.watchers_count + 1
  ↓
下次 ETL 自动同步该股票
```

### 2. AI 预测生成 (T 预测 T+1)
```
每日收盘后 (18:30)
  ↓
读取最新日线数据
  ↓
多周期趋势判断 (月/周/日)
  ↓
技术指标分析 (RSI, MACD, MA20)
  ↓
共振评分 (0-2 分)
  ↓
生成信号 + 置信度 + 战术建议
  ↓
写入 ai_predictions (status=Pending)
```

### 3. 预测验证 (T+1 日)
```
次日收盘后
  ↓
读取 T 日预测 + T+1 实际涨跌
  ↓
判断: 
  - Long + 涨 → Hit
  - Short + 跌 → Hit
  - 其他 → Miss
  ↓
更新 validation_status + actual_change
```

## 🚀 技术栈

| 层级       | 技术                    | 说明                          |
| ---------- | ----------------------- | ----------------------------- |
| **前端**   | Next.js 15 + TypeScript | App Router, Server Components |
| **部署**   | Vercel                  | Serverless Functions          |
| **数据库** | Turso (libSQL)          | 远程 SQLite, 边缘计算         |
| **ETL**    | Python 3.11             | AkShare + Pandas TA           |
| **调度**   | GitHub Actions          | 定时任务 + Cloudflare Worker  |
| **通知**   | 企业微信机器人          | 同步状态推送                  |

## ⚙️ 配置与环境

### 环境变量
```bash
# Backend (Python)
TURSO_DB_URL=libsql://stockwise-xxx.turso.io
TURSO_AUTH_TOKEN=***
GEMINI_API_KEY=***  # (预留, 当前未使用)
WECOM_ROBOT_KEY=***

# Frontend (Next.js)
TURSO_DATABASE_URL=libsql://stockwise-xxx.turso.io
TURSO_AUTH_TOKEN=***
```

### GitHub Actions 工作流
```yaml
daily_sync.yml       # 每日全量同步 (18:30 UTC+8)
realtime-sync.yml    # 实时同步 (每 10 分钟)
metadata_sync.yml    # 元数据同步 (06:00 UTC+8)
on-demand-sync.yml   # 手动触发 (测试/补数据)
```

## 🎯 设计亮点

### 1. 按需同步 (On-Demand ETL)
- 只同步有人关注的股票 (`watchers_count > 0`)
- 按关注人数排序，优先处理热门股票
- 节省 API 调用和计算资源

### 2. 多周期共振策略
- 月线 (战略方向) + 周线 (波段趋势) + 日线 (战术信号)
- 三期共振 → 置信度 0.88
- 单周期 → 置信度 0.65

### 3. 隐式用户系统
- 前端自动生成 UUID
- 无需注册即可使用
- 支持后续升级为显式用户

### 4. 降级与容错
- 新股数据不足 → 指标填充 0，避免崩溃
- 元数据获取失败 → HTTP API → AkShare 分交易所
- 实时同步冲突 → Concurrency 控制自动取消旧任务

## ⚠️ 已知限制与改进计划

| 问题             | 现状                 | 改进方向             | 优先级 |
| ---------------- | -------------------- | -------------------- | ------ |
| 新股 AI 预测不准 | 数据不足时仍生成预测 | 数据 < 30 天跳过 AI  | P0     |
| AI API 超时风险  | 无超时保护           | 添加 30s 超时 + 降级 | P1     |
| 错误详情截断     | 仅记录前 100 字符    | 结构化错误日志       | P2     |
| 缺少数据质量监控 | 无法追踪准确率趋势   | 添加 metrics 表      | P3     |

---

**文档维护**: 架构变更时需同步更新此文档
