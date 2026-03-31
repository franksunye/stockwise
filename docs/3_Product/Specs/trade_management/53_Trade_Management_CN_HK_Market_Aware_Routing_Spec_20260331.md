---
title: "功能规格说明书：交易管理 CN/HK 市场分化路由（Spec 53）"
doc_id: "spec-trade-management-cn-hk-market-aware-routing-20260331"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-31"
summary: "定义交易管理下一阶段的最小闭环：保持统一状态机，在 CN/HK 两个市场上引入 market-aware lane / policy routing，并形成研究、实现、验收闭环。"
---

# 功能规格说明书：交易管理 CN/HK 市场分化路由（Spec 53）

## 1. 一句话定义

**下一阶段不拆两套交易管理模型，而是在统一状态机之上，引入面向 CN/HK 的 market-aware 路由配置层。**

---

## 2. 为什么现在做这件事

当前已同时成立两件事：

1. live advice loop 已能按 `market` 跑真实持仓建议
2. 正式研究已经证明 `CN` 与 `HK` 的交易管理表现存在分化

当前正式结论：

- `CN` 更像风险优化器：更稳，但不更赚
- `HK` 在池内呈现收益与回撤双改善，但仍未成为 benchmark winner

因此，下一步不应继续假设：

- 同一默认 lane / threshold / policy ranking 在两个市场上天然同优

---

## 3. 这次 spec 的目标

这次只做一个很小但完整的闭环：

1. 研究上确认 `CN/HK` 在路由层的关键差异
2. 工程上引入 `market-aware trade management config`
3. live runner 按市场读取配置
4. 产出一轮可比较、可验收的结果

这次不做：

- 不拆状态机
- 不做两套前台产品
- 不新增复杂 policy family
- 不直接追求 benchmark outperformance

---

## 4. 正式产品判断

### 4.1 必须统一的层

以下层继续统一：

1. `Position State Schema`
2. 六状态契约
3. 前台输出形态：`状态 / 动作 / 纪律`

### 4.2 允许分化的层

以下层允许按市场分化：

1. 默认 lane
2. second-pass takeover threshold
3. 各状态下的 policy ranking
4. observation / discipline 的保守度

### 4.3 本阶段的核心原则

**先做 market-aware routing，不先做 market-specific model fork。**

---

## 5. 最小实施范围

### 5.1 研究任务

补一轮正式诊断，至少回答：

1. `CN` 哪些状态最容易被过度减仓
2. `HK` 哪些状态更适合保留趋势弹性
3. `baseline_3d -> low_risk_5d` 的接管，在 `CN/HK` 各自贡献了什么
4. 哪些 threshold / ranking 变化能改善当前市场表现

### 5.2 工程任务

新增一层轻配置，例如：

```text
backend/management/config/market_trade_management.py
```

最小字段建议：

```text
markets.CN:
  default_lane
  low_score_second_pass_threshold
  state_policy_preferences

markets.HK:
  default_lane
  low_score_second_pass_threshold
  state_policy_preferences
```

### 5.3 live runner 接入

`run_trade_management_advice_loop` 后续必须：

1. 读取持仓 `market`
2. 读取对应市场配置
3. 基于该配置完成 lane / policy routing
4. 在 advice log 中保留 market-aware 的来源痕迹

---

## 6. Phase 1 闭环定义

本阶段的闭环定义为：

1. 有一份正式的 `CN/HK routing diagnostic`
2. 有一版 `market-aware config v1`
3. live advice loop 已接入该配置
4. 至少完成一轮 `CN / HK / CN+HK` 对比验证
5. 有明确结论说明：
   - 哪些指标改善
   - 哪些指标没有改善
   - 当前是否值得成为默认配置

---

## 7. 验收标准

### 7.1 研究验收

必须同时满足：

1. 有独立的 `CN` 与 `HK` 对比结果
2. 结论不只看收益，还包含：
   - drawdown
   - giveback
   - lane stability
   - cross-market consistency
3. 文档能明确回答：
   - `CN` 是否应更保守
   - `HK` 是否应更保留趋势弹性

### 7.2 工程验收

必须同时满足：

1. 配置层存在，且不破坏当前统一状态机
2. live runner 可按 `market` 加载不同 routing config
3. advice log 可追溯本次建议使用的 market-aware routing
4. 不影响现有 C 端 `管理` 页签消费结构

### 7.3 产品验收

必须同时满足：

1. 前台文案不需要出现 `CN 版 / HK 版`
2. 仍保持统一的 `状态 / 动作 / 纪律`
3. 用户只感知建议更合理，不感知系统变复杂

---

## 8. 实施顺序

建议顺序固定为：

1. `研究诊断`
2. `配置抽象`
3. `live runner 接入`
4. `对比验证`
5. `默认配置判定`

不建议顺序：

1. 先改 live，再回头找理由
2. 先拆双模型，再做证据

---

## 9. 下一步输出物

本 spec 通过后，下一份工程输出应是：

1. 一份 `CN/HK routing diagnostic` 结果文档
2. 一份 `market-aware config v1` 工程实施稿
3. 一次最小实现与回归验证

---

## 10. 当前结论

交易管理下一步最值得做的，不是继续扩前台，也不是急着拆成两套系统。

**正确下一步是：在统一状态机之上，把 CN/HK 的差异正式沉淀到 market-aware routing 层，并用研究与 live advice loop 一起完成闭环。**
