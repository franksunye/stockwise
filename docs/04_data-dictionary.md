# 04. 数据字典

> **唯一真理来源 (Single Source of Truth)** —— 所有数据定义以此为准

---

## 🗄️ 数据库表

### `daily_prices` (日线数据)

**数据库**：Turso (libSQL)  
**更新频率**：每日 18:00 (收盘后)  
**写入方式**：`INSERT OR REPLACE` (Upsert)

```sql
CREATE TABLE daily_prices (
    -- 主键
    symbol TEXT NOT NULL,           -- 股票代码 (e.g., '02171')
    date TEXT NOT NULL,             -- 日期 (ISO 8601: 'YYYY-MM-DD')

    -- 基础行情
    open REAL,                      -- 开盘价
    high REAL,                      -- 最高价
    low REAL,                       -- 最低价
    close REAL,                     -- 收盘价
    volume REAL,                    -- 成交量
    change_percent REAL,            -- 涨跌幅 (e.g., 1.28 = +1.28%)

    -- 技术指标
    ma20 REAL,                      -- 20日均线
    rsi REAL,                       -- RSI (14日)

    -- AI 层
    ai_summary TEXT,                -- 每日简评 (≤50字)

    PRIMARY KEY (symbol, date)
);
```

### 字段详解

| 字段 | 类型 | 必填 | 示例 | 说明 |
|------|------|------|------|------|
| `symbol` | TEXT | ✅ | `'02171'` | 股票代码，港股不带前缀 |
| `date` | TEXT | ✅ | `'2024-12-20'` | ISO 8601 格式 |
| `open` | REAL | | `15.20` | 开盘价 (前复权) |
| `high` | REAL | | `15.50` | 最高价 |
| `low` | REAL | | `14.80` | 最低价 |
| `close` | REAL | | `14.95` | 收盘价 |
| `volume` | REAL | | `5000000` | 成交量 (股) |
| `change_percent` | REAL | | `1.28` | 涨跌幅百分比 |
| `ma20` | REAL | | `15.10` | 20日简单移动均线 |
| `rsi` | REAL | | `43.5` | 14日 RSI 指标 |
| `ai_summary` | TEXT | | `'缩量回调，主力观望'` | AI 生成的简评 |

---

## 💾 本地存储

### `stock_rules` (LocalStorage)

**存储位置**：浏览器 localStorage  
**Key**：`stock_rules`

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

**示例**

```json
{
  "02171": {
    "support_price": 14.78,
    "pressure_price": 15.80,
    "min_volume": 5000000,
    "last_updated": 1703145600000
  }
}
```

---

## 📊 前端数据接口

### DailyPrice (TypeScript)

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
  ma20: number;
  rsi: number;
  ai_summary: string;
}
```

---

## 📈 技术指标计算公式

### MA20 (20日均线)

```
MA20 = (C1 + C2 + ... + C20) / 20
```

其中 `Cn` 为第 n 天收盘价。

### RSI (14日)

```
RS = 平均涨幅 / 平均跌幅
RSI = 100 - (100 / (1 + RS))
```

| 区间 | 含义 |
|------|------|
| RSI > 70 | 超买区 |
| RSI < 30 | 超卖区 |
| 30 ≤ RSI ≤ 70 | 正常区 |

---

## 🏷️ 术语表

| 术语 | 中文 | 说明 |
|------|------|------|
| HUD | 抬头显示器 | 产品核心隐喻 |
| Support | 支撑位 | 用户设定的止损红线 |
| Pressure | 压力位 | 用户设定的突破目标 |
| Upsert | 插入或更新 | `INSERT OR REPLACE` |
| PWA | 渐进式 Web 应用 | 可添加到手机桌面 |

---

## 🔄 数据流向

```
Akshare (原始数据)
    ↓
Pandas TA (指标计算)
    ↓
Gemini (AI 点评)
    ↓
Turso (daily_prices)
    ↓
Next.js Server Component (读取)
    ↓
Dashboard (展示)
    +
LocalStorage (用户规则)
    ↓
信号计算 (红绿灯)
```

---

*← 返回：[00. README](./00_README.md)*
