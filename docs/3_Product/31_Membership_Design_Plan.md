---
title: "StockWise 会员体系与商业化方案设计"
doc_id: "product-membership-design-plan"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-19"
summary: "定义当前会员体系、权益边界与商业化分层，是账号、会员与权益类 Support 内容的事实源。"
---

# StockWise 会员体系与商业化方案设计

> **核心思路**：通过“规则引擎 (免费)”与“LLM 深度分析 (付费)”的差异化，平衡服务成本与用户价值。

---

## 💎 1. 订阅方案矩阵 (Tier Matrix)

| 维度 | Free (体验版) | Go (进阶版) | Plus (增强版) | Pro (专业版) | Alpha (终极层) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **内部代号** | **v1 (Actionable Insights 阶段)** | **v1 (Actionable Insights 阶段)** | **v1 (Actionable Insights 阶段)** | **v2 (管理阶段)** | **v3 (优化阶段)** |
| **自选容量** | 3 只 | 10 只 | 10 只 | 30 只 | 200+ / 专线监控 |
| **决策智能** | **逻辑摘要** | **逻辑推演 (Deep)** | **专家共识 (Cross)** | **量化双轨验证** | **极效优化 (Optimal)** |
| **选用模型** | 4o-mini / 混元 | **DeepSeek (思维链)** | **双顶级 LLM 复核** | AI + 量化规则引擎 | 私有化算力代理 |
| **核心体验** | 流程体感与信任建立 | 消费 AI 深度研判逻辑 | 享受席位共识审计 | 全流程量化执行管理 | **择时与交易终极优化** |
| **GTM 价值** | 建立初步信任 | 验证逻辑解释权的变现 | 认知溢价变现 | 工业化工程变现 | **超额收益与风险终结** |
| **定价参考** | ¥0 / $0 | ¥29 / $4.99 | ¥69 / $9.99 | ¥199 / $29.99 | 邀约制 / 利润分成 |

---

## 🛠️ 2. 技术架构调整

### A. 数据库层 (Turso/SQLite)
- **`users` 表增强**：
    - `subscription_tier`: 订阅等级 (`free`, `pro`, `premium`)
    - `subscription_expires_at`: 会员有效期
    - `last_active_at`: 最后活跃时间（用于清理过期监控池）
- **`user_watchlist` 表增强**：
    - `analysis_mode`: `rule` 或 `ai`（由订阅等级决定）

### B. ETL 调度层 (Python)
- **按需分析**：
    1. ETL 过程中，统计该股票的所有订阅用户。
    2. 如果该股票的订阅者中包含至少一名 `pro/premium` 用户，则触发 **LLM 分析流程**。
    3. 如果全是 `free` 用户，则仅运行 **规则引擎**（通过 Pandas 技术指标计算简单信号）。
- **资源浪费避免**：
    - 对于 30 天未登录的免费用户，其监控池停止自动更新。

### C. 分析引擎分流
- **Rule Engine (免费)**：
    - 基于 RSI > 70 卖出、MACD 金叉买入等硬规则生成信号。
    - **成本**：$0。
- **AI Engine (付费)**：
    - 调用 Gemini 2.0 Flash/Pro，注入最近 14 天行情数据。
    - 生成结构化推理链和具体的战术动作。
    - **成本**：按 Token 计费。

---

## 📱 3. 用户体验 (UX) 设计

### A. 个人中心 (Profile Center)
- **身份标识**：展示会员徽章（Pro/Premium）。
- **配额管理**：实时查看自选股使用量（如 2/3）。
- **付费入口**：集成微信支付/支付宝 H5 支付。

### B. Dashboard 差异化控制
- **锁定状态**：免费用户在查看 AI 推理部分时，显示毛玻璃效果并提示“升级 Pro 解锁 AI 深度洞察”。
- **信号区分**：
    - 规则引擎生成的信号标注 `[Rule]`。
    - AI 推理生成的信号标注 `[AI]`。

---

## 📈 4. 实施阶段 (Roadmap)

### 第 0 阶段：邀请制内测验证 (Beta)
> **目标**：在不开发支付系统的前提下，快速验证"Pro 版"价值，并通过裂变机制控制种子用户规模。

#### 1. 准入机制 (Invite-Only)
- **激活码模式**：通过管理员发放的 Pro 激活码直接兑换（如 `PRO-XXXXXX`），赋予 30 天 Pro 权限。
- **邀请链接模式**：支持 `https://stockwise.xxx/dashboard?invite=USER_ID` 格式。
    - **被邀请人**：通过链接进入后，自动获得 Pro 试用（可配置天数，默认 7 天），**无需激活码**。
    - **邀请人**：被邀请人成功入池后，邀请人的 Pro 时长自动延长（可配置天数，默认 7 天）。
    - **逻辑实现**：前端在 `layout.tsx` 拦截 `invite` 参数，后端在 `api/user/profile` 首次创建用户时记录 `referred_by` 并发放双向奖励。

#### 2. 核心任务
- [x] **数据库**：新增 `invitation_codes` 表和 `users` 表扩展 (`referred_by`)。
- [x] **后台**：编写发码脚本 (CLI工具: `manage_codes.py`)。
- [x] **前端**：个人中心增加"邀请好友"入口，支持一键复制带参数的邀请链接。
- [x] **逻辑**：实现 `invite` 参数的持久化捕获与后端关联，被邀请人可绕过邀请墙。
- [ ] **运营**：向核心社群定向发放激活码，收集反馈。

### 第一阶段：地基搭建 (P0)
- [ ] 数据库 Schema 更新。
- [ ] ETL 代码支持"最高等级优先"分析逻辑（即：若有付费用户关注，则进行 AI 分析并缓存结果）。

### 第二阶段：前端分流 (P1)
- [ ] 实现"个人中心"基础页面。
- [ ] Dashboard 根据用户等级决定是否渲染 `TacticalBriefDrawer` 的深度内容。
- [ ] 按钮权限控制：超过 3 只股票时弹出升级弹窗。

### 第三阶段：商业化闭环 (P2)
- [ ] 过期用户数据清理脚本。
- [ ] 支付接口对接。
- [ ] 会员到期提醒功能。

---

## 🎛️ 5. 运营开关设计 (Marketing Switches)

> **目标**：将激活码、邀请奖励等营销机制设计为可配置的全局开关，便于在不同运营阶段灵活启停。

### A. 开关矩阵

| 开关组合     | `requireInvite` | `enableReferralReward` | `enableRedemption` | 适用场景                                  |
| ------------ | --------------- | ---------------------- | ------------------ | ----------------------------------------- |
| **内测期**   | ✅ 开启          | ✅ 开启                 | ✅ 开启             | 严格控制种子用户，邀请可绕过墙+双方获奖励 |
| **公测期**   | ❌ 关闭          | ✅ 开启                 | ✅ 开启             | 任何人都能用免费版，邀请可升级 Pro        |
| **正式版**   | ❌ 关闭          | ❌ 关闭                 | ❌ 关闭             | 纯粹靠付费转化，不搞裂变                  |
| **限时活动** | ❌ 关闭          | ✅ 开启 (加倍天数)      | ✅ 开启             | 短期拉新冲刺                              |

### B. 开关定义

| 开关名                 | 类型    | 说明                                                                                                     |
| ---------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `requireInvite`        | Boolean | **邀请墙开关**。开启时，用户必须有激活码或被邀请才能进入系统；关闭时，所有人可直接进入（默认免费用户）。 |
| `enableReferralReward` | Boolean | **邀请奖励开关**。开启时，邀请链接有效，双方可获得 Pro 试用；关闭时，邀请链接无效。                      |
| `enableRedemption`     | Boolean | **激活码兑换开关**。开启时，允许用激活码兑换 Pro；关闭时，禁用激活码功能。                               |
| `refereeDays`          | Number  | 被邀请人获得的 Pro 试用天数（默认 7 天）。                                                               |
| `referrerDays`         | Number  | 邀请人获得的 Pro 奖励天数（默认 7 天）。                                                                 |

### C. 配置文件位置

```
frontend/src/lib/membership-config.ts
```

### D. 各模块消费关系

| 模块                   | 消费的开关             | 行为变化                                       |
| ---------------------- | ---------------------- | ---------------------------------------------- |
| `dashboard/layout.tsx` | `requireInvite`        | 关闭时：跳过邀请墙，直接让用户进入（免费用户） |
| `dashboard/layout.tsx` | `enableReferralReward` | 关闭时：不解析 `?invite=` 参数，不触发奖励逻辑 |
| `api/user/profile`     | `enableReferralReward` | 关闭时：`referredBy` 参数被忽略，不发放 Pro    |
| `api/user/redeem`      | `enableRedemption`     | 关闭时：API 返回"激活码功能已停用"             |
| `UserCenterDrawer.tsx` | `enableRedemption`     | 关闭时：隐藏"输入激活码"输入框                 |
| `UserCenterDrawer.tsx` | `enableReferralReward` | 关闭时：隐藏"邀请好友"入口                     |

### E. 运营场景示例

#### 场景 1：内测期（当前默认）
```typescript
switches: {
  requireInvite: true,
  enableReferralReward: true,
  enableRedemption: true,
}
```

#### 场景 2：公测期
```typescript
switches: {
  requireInvite: false,  // 关闭邀请墙
  enableReferralReward: true,
  enableRedemption: true,
}
```

#### 场景 3：正式版（纯付费）
```typescript
switches: {
  requireInvite: false,
  enableReferralReward: false,
  enableRedemption: false,
}
```

---

## ⚠️ 6. 资源管控逻辑
1. **监控池过期**：免费用户 14 天不活跃，移出 `global_stock_pool`，节省 ETL 资源。
2. **AI 配额**：Pro 用户每月设定 AI 分析上限（如 1000 次请求/月），防止 API 滥用。
