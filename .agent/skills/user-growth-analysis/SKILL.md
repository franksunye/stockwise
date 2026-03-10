---
name: user-growth-analysis
description: 用户增长分析技能。查询生产数据库，生成每日/自定义时段的新增用户明细、Pro 转化率、自选股热力、订阅时长分析等结构化报告。
---

# 用户增长分析 (User Growth Analysis)

本技能用于从生产数据库 (Turso) 中提取用户增长数据，生成结构化的分析报告。适用于日常运营复盘、增长趋势追踪和用户画像洞察。

## 1. 数据源

- **主数据源**: Turso 云端数据库，通过 `turso-cli.mjs` 查询
- **备用数据源**: 本地 `data/stockwise.db`（需先同步）
- **连接不稳定时**: 等待 5 秒后重试，加 `--raw` 参数获取 JSON 输出

```bash
# 主查询方式
node frontend/scripts/turso-cli.mjs query "<SQL>" --raw

# 如果 Turso 连接失败 (ECONNRESET)，等待后重试
sleep 5 && node frontend/scripts/turso-cli.mjs query "<SQL>" --raw

# 备用：本地数据库（可能不是最新）
sqlite3 data/stockwise.db "<SQL>;"
```

## 2. 标准分析流程

### Step 1: 新增用户概览

```sql
-- 今日新增总量与 Pro 分布
SELECT 
  COUNT(*) as total_new,
  SUM(CASE WHEN subscription_tier='pro' THEN 1 ELSE 0 END) as new_pro,
  SUM(CASE WHEN subscription_tier='free' THEN 1 ELSE 0 END) as new_free,
  SUM(CASE WHEN referred_by IS NOT NULL THEN 1 ELSE 0 END) as from_referral
FROM users 
WHERE created_at LIKE '<YYYY-MM-DD>%'
```

### Step 2: 新增用户明细

```sql
-- 今日每位新用户详情
SELECT 
  user_id, 
  registration_type, 
  subscription_tier, 
  referred_by, 
  created_at 
FROM users 
WHERE created_at LIKE '<YYYY-MM-DD>%' 
ORDER BY created_at ASC
```

**时间转换规则**：数据库存储 UTC 时间，展示时 **+8 小时** 转为北京时间。

### Step 3: Pro 用户订阅时长

```sql
-- 查询 Pro 用户的到期时间
SELECT 
  user_id, 
  created_at, 
  subscription_expires_at 
FROM users 
WHERE created_at LIKE '<YYYY-MM-DD>%' 
  AND subscription_tier = 'pro' 
ORDER BY created_at ASC
```

**Pro 时长计算规则**：
- `expires - created ≈ 3 天` → **试用期（自然流量）**
- `expires - created ≈ 5 天` → **试用期（推荐链接）**
- `expires - created ≈ 30 天` → **💰 付费月卡**
- `expires - created ≈ 365 天` → **💰 付费年卡**

### Step 4: 新用户自选股分析

```sql
-- Pro 用户的自选股
SELECT 
  u.user_id, 
  w.symbol, 
  w.added_at 
FROM users u 
JOIN user_watchlist w ON u.user_id = w.user_id 
WHERE u.created_at LIKE '<YYYY-MM-DD>%' 
  AND u.subscription_tier = 'pro' 
ORDER BY u.created_at ASC, w.added_at ASC
```

```sql
-- 股票代码 → 中文名映射（用本地库即可）
SELECT symbol, name FROM stock_meta 
WHERE symbol IN ('<symbol1>','<symbol2>',...)
```

### Step 5: 近 N 天趋势

```sql
-- 最近 7 天的每日新增趋势
SELECT 
  DATE(created_at) as date, 
  COUNT(*) as new_users, 
  SUM(CASE WHEN subscription_tier='pro' THEN 1 ELSE 0 END) as new_pro 
FROM users 
WHERE created_at >= '<7天前的日期>' 
GROUP BY DATE(created_at) 
ORDER BY date ASC
```

### Step 6: 活跃用户分析 (DAU)

```sql
-- 今日活跃用户分布
SELECT 
  COUNT(DISTINCT user_id) as dau,
  SUM(CASE WHEN subscription_tier='pro' THEN 1 ELSE 0 END) as active_pro,
  SUM(CASE WHEN created_at LIKE '<YYYY-MM-DD>%' THEN 1 ELSE 0 END) as active_new_users,
  SUM(CASE WHEN created_at < '<YYYY-MM-DD>' THEN 1 ELSE 0 END) as active_returning_users
FROM users 
WHERE last_active_at LIKE '<YYYY-MM-DD>%'
```

### Step 7: 全站累计快照

```sql
SELECT 
  COUNT(*) as total_users, 
  SUM(CASE WHEN subscription_tier='pro' THEN 1 ELSE 0 END) as pro_users, 
  SUM(CASE WHEN subscription_tier='free' THEN 1 ELSE 0 END) as free_users 
FROM users
```

## 3. 报告输出模板

分析完成后，按以下结构输出报告：

### 3.1 日报模板

```
## 📊 <YYYY-MM-DD> 用户增长日报

### 一、今日增长与活跃概览
| 指标 | 数值 |
| 今日新增用户 | X 人 |
| 其中 Pro 付费 | X 人 (XX%) |
| 今日活跃用户 (DAU) | X 人 |
| --- 其中老用户回访 | X 人 |
| --- 其中 Pro 活跃 | X 人 |
| 来自推荐链接 | X 人 |

### 二、活跃用户明细（北京时间）
表格：用户ID / 层级 / 注册时间 / 最后活跃 / 关键动作 (如新增自选股)

### 三、Pro 用户订阅详情
表格：用户ID / 注册时间 / 到期时间 / Pro时长 / 订阅类型

### 四、自选股热力
表格：股票名 / 代码 / 被关注次数

### 五、近 7 天趋势
表格：日期 / 新增 / Pro数 / Pro转化率

### 六、全站累计
| 总注册 | Pro | Free |

### 七、关键洞察
- 流量波次分析（按时间段聚类）
- 热门标的与用户画像推断
- 试用到期窗口与续费建议
- 推荐链接效果评估
```

## 4. 进阶查询

### 4.1 即将到期的试用用户（续费窗口）

```sql
SELECT user_id, subscription_expires_at 
FROM users 
WHERE subscription_tier = 'pro' 
  AND subscription_expires_at BETWEEN '<今天>' AND '<3天后>'
ORDER BY subscription_expires_at ASC
```

### 4.2 用户活跃度（最后活跃时间）

```sql
SELECT user_id, subscription_tier, last_active_at 
FROM users 
WHERE created_at LIKE '<YYYY-MM-DD>%' 
ORDER BY last_active_at DESC
```

### 4.3 推荐人贡献排行

```sql
SELECT 
  referred_by as referrer, 
  COUNT(*) as referral_count,
  SUM(CASE WHEN subscription_tier='pro' THEN 1 ELSE 0 END) as pro_referrals
FROM users 
WHERE referred_by IS NOT NULL 
GROUP BY referred_by 
ORDER BY referral_count DESC 
LIMIT 10
```

### 4.4 自定义日期范围

将 `WHERE created_at LIKE '<YYYY-MM-DD>%'` 替换为：
```sql
WHERE created_at >= '<START_DATE>' AND created_at < '<END_DATE>'
```

## 5. 注意事项

1. **时区**：数据库全部存储 UTC，报告展示时统一 +8 转北京时间
2. **Turso 不稳定**：遇到 `ECONNRESET` 时等待 5 秒重试，最多 3 次；仍失败则告知用户网络不稳
3. **股票名称查询**：优先用本地 `stock_meta` 表（字段为 `symbol`, `name`），避免额外的 Turso 请求
4. **隐私保护**：报告中只展示 `user_id` 前缀，不暴露邮箱等 PII 信息
5. **Pro 时长判定**：通过 `subscription_expires_at - created_at` 的差值天数推断订阅类型，而非依赖其他字段
