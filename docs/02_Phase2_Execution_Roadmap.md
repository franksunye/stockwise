# Phase 2: The Retention Loop (Execution Roadmap)

> **当前阶段**: Phase 2 (留存为王)
> **核心目标**: 打造完美的 "EOD (End-of-Day) 闭环"，确保从数据获取、AI 分析到通知推送的整条链路在 10,000 用户规模下依然稳定、快速、精准。
> **质量标准**: 生产级 (Production Grade), 99.9% 可用性。

---

## 1. 阶段定义 (Definition of Done)

Phase 2 不仅仅是堆砌功能，而是建立一个**用户无法离开的习惯回路 (Hook Loop)**：
1.  **触发 (Trigger)**: 每天固定时间 (08:30 / 18:00) 收到精准通知。
2.  **行动 (Action)**: 用户点击通知，打开 StockWise。
3.  **奖赏 (Reward)**: 获得高质量、不仅是"数据"而是"观点"的 AI 简报。
4.  **投入 (Investment)**: 用户信赖系统，将更多股票放入 Watchlist。

**我们目前的进度**: `[=======---] 70%` (核心功能已通，但扩展性和精细度不足)。

---

## 2. 差距分析 (Gap Analysis for 10k Users)

要支持 10,000 名用户 (假设平均每人关注 5 只股票 = 50,000 次每日请求)，我们目前的架构面临以下挑战：

### A. 性能瓶颈 (The "Sequential" Trap)
*   **现状**: Python 脚本可能是串行或简单并发。
*   **问题**: 如果处理一只股票耗时 3秒，50,000 次请求需要 41 小时！
*   **10k 标准**: 必须在 30 分钟内完成所有盘前分析。
*   **对策**: 
    1.  **共享缓存 (Shared Cache)**: 1000 个用户都关注了“腾讯”，新闻只需要抓 1 次，AI 分析只需要跑 1 次（针对公共部分）。
    2.  **异步大规模并发**: 必须使用真正的 `asyncio` 甚至是分布式 Worker (后续)。

### B. 信号状态追踪 (Signal Flip Logic)
*   **现状**: 只有“当日快照”。前端 UI 有“信号翻转”开关，但后端没有逻辑支撑。
*   **问题**: 用户最关心的是的变化（从“空”变“多”）。
*   **10k 标准**: 系统必须像能够识别 `State Change Event` 并优先推送此类高价值信息。
*   **对策**: 
    1.  实现 `StateTracker` 模块，对比 T vs T-1 结果。
    2.  生成结构化的 `NotificationEvent` (Type: Flip | Confirm | Risk)。

### C. 容错与兜底 (Graceful Degradation)
*   **现状**: EastMoney 接口偶尔可能会挂，或者无新闻。
*   **10k 标准**: 
    *   绝不能发给用户一个报错页面。
    *   **新闻挂了** -> 降级为纯技术分析模式。
    *   **AI 挂了** -> 降级为规则引擎模式。
*   **对策**: 完善 `StrategyFactory` 的 Fallback 机制。

---

## 3. 执行行动清单 (Action Plan)

### P0: 核心稳定性与扩展性 (Foundation)
- [ ] **去重与缓存机制**: 确保同一股票在同一天只被 AI 分析一次。结果存入 `ai_predictions` 表，其余用户直接读取 (Read-Model)。(这将极大降低 API 成本和时间)。
- [ ] **错误隔离**: 单个股票/用户的失败绝不能阻塞整个 Batch 任务。
- [ ] **EastMoney API 增强**: 增加重试机制和 Result Parsing 的健壮性。

### P1: 智能信号逻辑 (Intelligence)
- [ ] **实现 Signal Flip 检测**: 在写入新预测前，读取旧预测，计算 `Status` (Upgraded/Downgraded/Unchanged)。
- [ ] **通知分级 (Notification Tiering)**: 
    - 紧急 (Flip): 立即推送 / 单独推送。
    - 普通 (Daily): 合并在“日报”中推送。

### P2: 用户体验打磨 (Delight)
- [ ] **简报排版优化**: 确保 AI 输出的 Markdown 在手机端阅读体验极佳（关键数字高亮）。
- [ ] **推送文案优化**: 告别机械的 "日报已生成"，转向 "腾讯控股出现买入信号..." 这样高点击率的文案。

---

## 4. 架构原则 (Architecture Guidelines)

为了达到世界级标准，所有新增代码必须遵守：

1.  **Fail Silently & Log Loudly**: 用户界面永远展示最佳可用数据，后台记录详细错误堆栈。
2.  **User-Centric Time**: 永远注意时区。08:30 推送是用户的当地时间（目前主要针对 CN/HK 时区）。
3.  **Idempotency (幂等性)**: 脚本运行 1 次和运行 10 次，结果应该是一样的，不会重复发送 10 条通知。

---

## 5. 准入 Phase 3 的标准 (Exit Criteria)

只有满足以下条件，我们才启动 Phase 3 (Impulse Guard)：

1.  ✅ **自动化率 100%**: 不需要人工干预即可完成每日数据更新。
2.  ✅ **推送送达率 > 99%**: 解决所有 WebPush 相关的 Token 失效问题。
3.  ✅ **成本可控**: 单用户每日 AI 成本控制在预期范围内 (通过缓存机制实现)。
