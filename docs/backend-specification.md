# StockWise 后端开发规格 v1.0

> **Serverless ETL 架构** —— 稳定、准时地生产高质量决策数据

---

## 🏗️ 架构概览

| 组件 | 技术选型 | 职责 |
|------|----------|------|
| ETL 核心 | GitHub Actions + Python | 每日数据抓取与计算 |
| 视觉分析 | Next.js API Routes | 图片分析即时响应 |
| 数据仓库 | Turso (libSQL) | 边缘数据库 |
| 数据源 | Akshare | 开源财经数据 |
| AI 引擎 | Google Gemini | 文本点评 + 图片分析 |

---

## 🗄️ 数据库设计

### 表：`daily_prices`（唯一真理来源）

```sql
CREATE TABLE IF NOT EXISTS daily_prices (
    -- 联合主键
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,

    -- 基础行情
    open REAL, high REAL, low REAL, close REAL,
    volume REAL,
    change_percent REAL,

    -- 技术指标
    ma20 REAL,                  -- 20日均线
    rsi_14 REAL,                -- RSI (14)
    boll_upper REAL,            -- 布林上轨
    boll_lower REAL,            -- 布林下轨
    kdj_k REAL, kdj_d REAL, kdj_j REAL,

    -- AI 层
    ai_summary TEXT,            -- 每日简评 (≤50字)
    ai_mood TEXT,               -- 情绪标签

    PRIMARY KEY (symbol, date)
);
```

---

## ⚙️ ETL 管道

**脚本**：`/backend/main.py`  
**执行**：每日 UTC 10:00 (北京 18:00)

### 依赖

```text
akshare
pandas
pandas_ta
libsql-experimental
google-generativeai
```

### 处理流程

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│  Akshare   │ -> │  Pandas TA │ -> │   Gemini   │ -> │   Turso    │
│  数据抓取  │    │  指标计算  │    │  AI 点评   │    │  Upsert    │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
```

### Step 1: 获取数据

```python
# 获取最近 365 天 (长周期指标计算需要)
df = ak.stock_hk_daily(symbol="02171")
```

### Step 2: 计算指标

```python
import pandas_ta as ta

df.ta.sma(length=20, append=True)     # MA20
df.ta.rsi(length=14, append=True)     # RSI
df.ta.bbands(length=20, append=True)  # BOLL
df.ta.kdj(append=True)                # KDJ
```

### Step 3: AI 注入

**Prompt 模板**：
> "你是机构风控官。股票 {symbol} 今日收盘 {close}，涨跌 {change}%。RSI {rsi}，股价位于 MA20 ({ma20}) 下方。用不超过 50 字点评主力意图。风格：冷酷、客观。"

### Step 4: 数据入库

```sql
INSERT OR REPLACE INTO daily_prices (...) VALUES (...)
```

---

## 🤖 GitHub Actions

**配置**：`.github/workflows/daily_sync.yml`

### Secrets 配置

| Key | 用途 |
|-----|------|
| `TURSO_DB_URL` | `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | 数据库读写 Token |
| `GEMINI_API_KEY` | AI 点评生成 |

### 任务流程

1. Checkout Code
2. Setup Python 3.9
3. `pip install -r requirements.txt`
4. `python main.py`
5. 失败时发送通知

---

## 🔌 即时 API

### 图片分析

**Endpoint**：`POST /api/analyze`

**Request**
```json
{
  "image": "base64...",
  "user_rules": "支撑位 14.78"
}
```

**Response**
```json
{
  "trend": "Bearish (看空)",
  "advice": "大阴线跌破支撑位 14.78，建议止损。"
}
```

---

## 🚀 开发计划

| Phase | 目标 | 天数 |
|-------|------|------|
| 1 | 数据跑通 (本地 + Turso) | Day 1 |
| 2 | AI 点评集成 | Day 2 |
| 3 | GitHub Actions 部署 | Day 3 |
| 4 | 前后端联调 | Day 4 |

---

## ⚠️ 异常处理

| 场景 | 对策 |
|------|------|
| Akshare 接口失效 | try-catch + 备用接口切换 |
| LLM 超时/幻觉 | 填入默认值，**不阻塞入库** |
| 休市日 | 检测交易日，否则 `exit(0)` |

---

*文档版本: v1.0 | 更新日期: 2024-12-22*
