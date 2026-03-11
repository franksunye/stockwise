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
```

## 2. 标准分析流程

### Step 1: 新增用户概览 (北京时间校准)

```sql
-- 过去 24 小时近似北京今日的新增总量与 Pro 分布
SELECT 
  COUNT(*) as total_new,
  SUM(CASE WHEN subscription_tier='pro' THEN 1 ELSE 0 END) as new_pro,
  SUM(CASE WHEN subscription_tier='free' THEN 1 ELSE 0 END) as new_free,
  SUM(CASE WHEN referred_by IS NOT NULL THEN 1 ELSE 0 END) as from_referral
FROM users 
WHERE datetime(created_at, '+8 hours') >= '<YYYY-MM-DD> 00:00:00'
```

### Step 2: 用户明细 (BJT 转换)

```sql
-- 今日活跃/新增用户详情
SELECT 
  user_id, 
  subscription_tier, 
  referred_by, 
  datetime(created_at, '+8 hours') as registered_at_bj,
  datetime(last_active_at, '+8 hours') as last_active_bj
FROM users 
WHERE datetime(last_active_at, '+8 hours') LIKE '<YYYY-MM-DD>%' 
ORDER BY last_active_at DESC
```

### Step 3: Pro 订阅时长与类型判定

```sql
-- 通过到期时间差推断订阅类型
SELECT 
  user_id, 
  datetime(created_at, '+8 hours') as created_at_bj, 
  datetime(subscription_expires_at, '+8 hours') as expires_at_bj,
  subscription_tier,
  CAST((julianday(subscription_expires_at) - julianday(created_at)) AS INT) as duration_days
FROM users 
WHERE subscription_tier = 'pro' 
ORDER BY created_at DESC 
LIMIT 20
```

**判定规则**：
- `duration_days ≈ 3` → 自然试用
- `duration_days ≈ 5` → 推荐试用
- `duration_days ≈ 30` → 💰 付费月卡
- `duration_days ≈ 365` → 💰 付费年卡

### Step 4: 活跃用户分析 (DAU)

```sql
-- 今日活跃分布 (基于北京时间)
SELECT 
  COUNT(DISTINCT user_id) as dau,
  SUM(CASE WHEN subscription_tier='pro' THEN 1 ELSE 0 END) as active_pro,
  SUM(CASE WHEN datetime(created_at, '+8 hours') >= '<YYYY-MM-DD> 00:00:00' THEN 1 ELSE 0 END) as active_new_users,
  SUM(CASE WHEN datetime(created_at, '+8 hours') < '<YYYY-MM-DD> 00:00:00' THEN 1 ELSE 0 END) as active_returning_users
FROM users 
WHERE datetime(last_active_at, '+8 hours') LIKE '<YYYY-MM-DD>%'
```

### Step 5: 自选股热力

```sql
-- 统计最近 24 小时新增关注
SELECT symbol, COUNT(*) as count 
FROM user_watchlist 
WHERE datetime(added_at, '+8 hours') >= datetime('now', '+8 hours', '-24 hours')
GROUP BY symbol ORDER BY count DESC LIMIT 10
```

## 3. 进阶运营查询

### 3.1 核心试用用户转化窗口 (即将到期)

```sql
-- 查找未来 3 天内试用到期的用户（续费提醒窗口）
SELECT 
  user_id, 
  datetime(subscription_expires_at, '+8 hours') as expires_at_bj,
  subscription_tier
FROM users 
WHERE subscription_tier = 'pro' 
  AND subscription_expires_at BETWEEN datetime('now') AND datetime('now', '+3 days')
ORDER BY subscription_expires_at ASC
```

### 3.2 推荐人贡献排行

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

## 4. 报告输出模板

分析完成后，按以下结构输出报告：

```markdown
## 📊 <YYYY-MM-DD> 用户增长日报 (北京时间)

### 一、今日增长与活跃概览
| 指标 | 数值 | 状态 |
| :--- | :--- | :--- |
| 今日新增用户 | X 人 | (增长/停滞) |
| 今日活跃用户 (DAU) | X 人 | (高/中/低) |
| --- 其中老用户回访 | X 人 | |
| --- 其中 Pro 活跃 | X 人 | |
| 全站累计用户 | X 人 | (Pro 率 XX%) |

### 二、活跃详情 (BJT)
表格：用户ID / 层级 / 注册时间 / 最后活跃 / 关键动作

### 三、Pro 订阅与转化预期
表格：用户ID / 注册时间 / 到期时间 / 订阅类型 / 距离到期(天)

### 四、自选股热力 (24h)
表格：股票名 / 代码 / 新增关注数

### 五、近 7 天趋势
表格：日期 / 新增 / Pro数 / Pro转化率

### 六、关键洞察
- 流量波次分析
- 试用到期窗口预警
- 推荐链接效果评估
```

## 5. 注意事项

1. **时区一致性**：所有报告时间必须统一为 **北京时间 (BJT)**。在 SQL 中使用 `datetime(field, '+8 hours')`。
2. **隐私保护**：脱敏展示 `user_id`（如 `user_abcd123...`）。
3. **Turso 重试**：遇到 `ECONNRESET` 必须重试。
4. **判定逻辑**：优先使用 `duration_days` 判定订阅类型，而非仅看 `tier`。
