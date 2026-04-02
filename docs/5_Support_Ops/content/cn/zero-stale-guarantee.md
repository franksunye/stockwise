---
title: "零过期协议：尽量不让你看到旧价格"
subtitle: "价格刷新优先保真，不拿旧数据冒充实时状态"
content_id: "support-zero-stale-guarantee"
content_source: "support"
content_type: "guide"
canonical_role: "canonical"
source_docs:
  - docs/1_Engineering/28_Price_Sync_Zero_Stale_Protocol_20260316.md
category: "Support Ops"
funnel_stage: "BOFU"
campaign_role: "conversion"
campaign: "wechat_4_week_sprint_2026q2"
date: "2026-03-19"
traceability:
  status: "healthy"
  last_reviewed_at: "2026-03-19"
workflow:
  stage: "drafting"
  owner: "cmo"
  reviewer: "founder"
  priority: "high"
  target_publish_date: "2026-04-24"
  last_action_at: "2026-03-19"
  blocked_reason: ""
maintenance:
  change_status: "updated"
  update_reason: "product_change"
website:
  enabled: true
  surface: "support"
distribution:
  wechat:
    enabled: true
    status: "draft"
---

# 零过期协议：尽量不让你看到旧价格

价格刷新时，ZISO 优先保证“别把旧数据当新数据展示”。

如果最新价格没有拿到，系统宁可短暂等待，也尽量避免把上一轮缓存误显示成当前状态。

## 它解决什么问题

- 边缘缓存或浏览器缓存把旧价格误当成新价格
- 盘中已经更新，但页面还停在上一轮时间戳
- 网络抖动时，旧数据看起来像“仍然有效”

## 它怎么做

1. 价格请求会附带时间戳参数，尽量绕开边缘缓存。
2. 接口显式返回 `no-store / no-cache` 相关头，减少中间层缓存污染。
3. 价格刷新链路和重决策链路分开处理：
   - 价格接口优先返回最新数据库状态
   - 重内容接口保留较短服务端缓存，避免整页过重
4. 如果当前时间和返回数据时间明显不匹配，页面应按“缺失/加载中”处理，而不是把旧时间戳硬显示成实时结果。

## 用户会看到什么

- 盘中价格不容易长时间卡在旧时间点
- 刷新后更容易拿到当前价格
- 如果最新数据还没到，系统更倾向于等待或提示加载，而不是把旧价格伪装成当前状态

## 设计原则

- **宁可短暂等待，不拿旧数据冒充实时**
- **价格保真优先于表面秒开**
- **价格刷新和重内容渲染分层处理**
