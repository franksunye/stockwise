---
title: "Frontend Architecture Baseline"
doc_id: "eng-frontend-architecture-baseline-20260327"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-27"
summary: "定义前端第一阶段架构升级完成后的稳定基线、默认验证动作、冻结边界与下一阶段进入条件。"
---

# Frontend Architecture Baseline

## 1. 适用范围

本基线适用于当前 `dashboard` 前端核心区域：

1. `bootstrap` 与入口准入
2. `symbol navigation`
3. `modal context`
4. `refresh contract`
5. `dashboard` 主展示区与已收口的非首帧功能面

架构事实源仍以 [`46_Frontend_SWR_Architecture_Upgrade.md`](/Users/yesun/Code/stockwise/docs/3_Product/Specs/46_Frontend_SWR_Architecture_Upgrade.md) 为准；本文件只定义“现在怎么维护这套基线”。

## 2. 已建立的稳定基线

截至 2026-03-27，以下能力已视为第一阶段完成态：

1. `Dashboard bootstrap state` 第一轮收口已完成。
2. `dashboard/layout` 已压薄，入口编排、entry gate 与 shell 已模块化。
3. `Dashboard Data Refresh Contract` 已建立，并已进入正式 release gate。
4. `dashboard entry / interaction / refresh` 三道页面级 gate 已进入 [`verify:release`](/Users/yesun/Code/stockwise/frontend/scripts/verify-release.mjs)。
5. `Brief`、`StockProfile`、`UserCenterDrawer`、`TacticalBriefDrawer` 邻接内容层、`StockDashboardCard`、`HistoricalCard`、`StockVerticalFeed` 已完成第一轮收口。
6. `symbol navigation` 与 `modal context` 已有独立 contract 与页面级 smoke 护栏。

## 3. 默认验证动作

以后只要改到 `dashboard` 核心路径，默认验证动作就是：

1. `cd frontend && npm run verify:release`

若只是做局部诊断或问题复现，可以按需补跑：

1. `cd frontend && npm run verify:dashboard-entry`
2. `cd frontend && npm run verify:dashboard-interaction`
3. `cd frontend && npm run verify:dashboard-refresh`
4. `cd frontend && npm run check:dashboard-refresh`

原则：

1. `verify:release` 是默认发布前检查
2. 页面级 smoke 负责真实路径回归
3. 纯逻辑测试负责 contract / surface 语义护栏
4. 不把局部问题升级成重型全链路 E2E 工程

## 4. 当前冻结边界

当前阶段默认不做：

1. 重写 `useDashboardData` 主请求链路
2. 推进 Watchlist 主链路 SWR 化
3. 引入全局持久化 SWR provider
4. 继续扩张 `Dashboard Data Refresh Contract`，把它做成通用平台或事件框架
5. 为了统一抽象而牺牲首帧体感、本地快照秒开或业务一致性约束

## 5. 允许继续改动的条件

只有在以下条件出现时，才建议进入下一轮架构推进：

1. release gate 或本地 smoke 暴露出真实回归
2. 线上观测证明 refresh contract 存在过刷、漏刷或重复请求问题
3. 新业务功能明确落在非首帧关键数据面，且可以独立收口
4. 有充分证据表明继续沿用当前主链路会显著拖慢交付或放大风险

## 6. 当前工作模式

从现在开始，推荐的默认模式是：

1. 先观测
2. 问题驱动地做小修或局部收口
3. 只有在进入条件明确满足时，才开启下一轮里程碑

一句话：

当前阶段的目标不再是“继续做更大的重构”，而是“守住已经建立的稳定基线”。 
