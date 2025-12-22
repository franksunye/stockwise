# 04. 数据字典

> **唯一真理来源 (Single Source of Truth)** —— 所有数据定义以此为准

---

## 🗄️ 数据库表

### `daily_prices` (日线数据)

**数据库**：SQLite (本地) / Turso (生产)  
**更新频率**：每日 18:00 (收盘后)  
**写入方式**：`INSERT OR REPLACE` (Upsert)

```sql
CREATE TABLE daily_prices (
    -- 主键
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,

    -- 基础行情
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume REAL,
    change_percent REAL,

    -- 均线系统
    ma5 REAL,
    ma10 REAL,
    ma20 REAL,
    ma60 REAL,

    -- MACD
    macd REAL,
    macd_signal REAL,
    macd_hist REAL,

    -- 布林带
    boll_upper REAL,
    boll_mid REAL,
    boll_lower REAL,

    -- RSI
    rsi REAL,

    -- KDJ
    kdj_k REAL,
    kdj_d REAL,
    kdj_j REAL,

    -- AI 层
    ai_summary TEXT,

    PRIMARY KEY (symbol, date)
);
```

---

## 📊 字段详解

### 基础行情

| 字段 | 类型 | 示例 | 说明 |
|------|------|------|------|
| `symbol` | TEXT | `'02171'` | 股票代码 |
| `date` | TEXT | `'2024-12-20'` | ISO 8601 格式 |
| `open` | REAL | `15.20` | 开盘价 (前复权) |
| `high` | REAL | `15.50` | 最高价 |
| `low` | REAL | `14.80` | 最低价 |
| `close` | REAL | `14.95` | 收盘价 |
| `volume` | REAL | `5000000` | 成交量 (股) |
| `change_percent` | REAL | `1.28` | 涨跌幅 % |

### 均线系统

| 字段 | 周期 | 用途 |
|------|------|------|
| `ma5` | 5日 | 短期趋势 |
| `ma10` | 10日 | 短中期趋势 |
| `ma20` | 20日 | 中期趋势 (生命线) |
| `ma60` | 60日 | 中长期趋势 (季线) |

### MACD

| 字段 | 说明 |
|------|------|
| `macd` | MACD 线 (DIF) |
| `macd_signal` | 信号线 (DEA) |
| `macd_hist` | 柱状图 (MACD - Signal) |

**参数**：快线 12, 慢线 26, 信号 9

### 布林带

| 字段 | 说明 |
|------|------|
| `boll_upper` | 上轨 (中轨 + 2σ) |
| `boll_mid` | 中轨 (20日均线) |
| `boll_lower` | 下轨 (中轨 - 2σ) |

**参数**：周期 20, 标准差 2

### RSI

| 字段 | 参数 | 含义 |
|------|------|------|
| `rsi` | 14日 | 相对强弱指数 |

| 区间 | 信号 |
|------|------|
| RSI > 70 | 超买区 |
| RSI < 30 | 超卖区 |

### KDJ

| 字段 | 说明 |
|------|------|
| `kdj_k` | K 值 (快速指标) |
| `kdj_d` | D 值 (慢速指标) |
| `kdj_j` | J 值 = 3K - 2D |

**参数**：K周期 9, D平滑 3

| 区间 | 信号 |
|------|------|
| K, D > 80 | 超买区 |
| K, D < 20 | 超卖区 |
| K 上穿 D | 金叉 (买入) |
| K 下穿 D | 死叉 (卖出) |

### AI 层

| 字段 | 说明 |
|------|------|
| `ai_summary` | 每日简评 (≤50字) |

---

## 💾 本地存储

### `stock_rules` (LocalStorage)

```typescript
interface UserRules {
  [symbol: string]: {
    support_price: number | null;   // 止损/支撑位
    pressure_price: number | null;  // 压力/突破位
    min_volume: number | null;      // 最低量能要求
    last_updated: number;           // 更新时间戳
  }
}
```

---

## 📊 前端数据接口

```typescript
interface DailyPrice {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change_percent: number;
  // 均线
  ma5: number;
  ma10: number;
  ma20: number;
  ma60: number;
  // MACD
  macd: number;
  macd_signal: number;
  macd_hist: number;
  // 布林带
  boll_upper: number;
  boll_mid: number;
  boll_lower: number;
  // 其他
  rsi: number;
  kdj_k: number;
  kdj_d: number;
  kdj_j: number;
  ai_summary: string;
}
```

---

## 🔄 数据流向

```
Akshare (原始 OHLCV)
    ↓
Pandas TA (12个技术指标)
    ↓
Gemini (AI 点评) [可选]
    ↓
SQLite / Turso (daily_prices)
    ↓
Next.js Server Component
    ↓
Dashboard + LocalStorage 规则
    ↓
信号计算 (红绿灯)
```

---

*← 返回：[00. README](./00_README.md)*
