# StockWise 技术设计方案

> **Serverless & Data-Driven** —— 低成本、高可用、自动化。

---

## 1. 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        用户设备 (PWA)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Next.js 14 (Vercel)                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │Dashboard │  │ History  │  │ Settings │          │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘          │   │
│  │       │              │              │               │   │
│  │       ▼              ▼              │               │   │
│  │  ┌─────────┐   ┌───────────┐       │               │   │
│  │  │ Turso   │   │LocalStorage│       │               │   │
│  │  │ (读取)  │   │ (Watchlist)│       │               │   │
│  │  └─────────┘   └───────────┘       │               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    数据管道 (每日 18:00)                     │
│                                                              │
│  GitHub Actions → Python → Akshare → Pandas TA → Turso     │
│       (验证昨日预测)            ↓           (持久化价格与预测)  │
│                           Gemini AI                          │
│                         (生成今日预测)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 数据库设计 (Turso/SQLite)

### 2.1 `daily_prices` (行情数据)
存储每日历史 K 线及技术指标。
```sql
CREATE TABLE daily_prices (
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    open REAL, high REAL, low REAL, close REAL, volume REAL,
    change_percent REAL,
    ma20 REAL, rsi REAL, macd REAL, -- 均线及常用指标
    PRIMARY KEY (symbol, date)
);
```

### 2.2 `ai_predictions` (预测与验证)
存储 AI 预测结论及后续验证结果。
```sql
CREATE TABLE ai_predictions (
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,          -- 预测生成日
    target_date TEXT NOT NULL,   -- 预测目标日
    signal TEXT,                 -- Long/Short/Side
    confidence REAL,             -- 置信度 (0-1)
    support_price REAL,          -- AI 建议支撑位
    validation_status TEXT,      -- Correct/Incorrect/Pending
    actual_change REAL,          -- 实际涨跌幅
    PRIMARY KEY (symbol, date)
);
```

---

## 3. 数据流向与代码逻辑

### ETL 处理逻辑
1. **抓取**：Akshare 抓取最新日线。
2. **验证**：读取昨日 `ai_predictions`，对比今日收盘价，更新 `validation_status`。
3. **计算**：Pandas TA 计算 MA20, RSI(14) 等。
4. **预测**：Gemini 根据指标生成今日 `signal` 和 `support_price`。
5. **落库**：Upsert 数据到 Turso。

---

## 4. 技术栈明细

- **前端**：Next.js, TypeScript, Tailwind CSS, Lucide Icons.
- **后端**：Python 3.10+, Pandas TA, LibSQL (Turso SDK).
- **AI**：Google Gemini Pro.
- **算力**：GitHub Actions (定时任务)。
- **持久化**：Turso (Edge Database), LocalStorage (User Prefs)。
