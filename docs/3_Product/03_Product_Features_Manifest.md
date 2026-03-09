# 产品功能清单 (Product Features Manifest)

一份全面、结构化的 ZISO AI 产品功能清单，旨在对齐前后端开发状态，并追踪功能的实现情况。

**防遗漏方法论 (Methodology)**：
1.  **UI/UX 深度扫描**：不仅扫描页面路由，还深入组件内部状态 (`useState`)，识别折叠视图 (Sub-views)、弹窗 (Drawers) 和条件渲染逻辑。
2.  **交互逻辑审计**：追踪 `onClick`、`useEffect` 和 `scroll` 事件，捕捉"隐形"交互（如触感反馈、延迟加载、无限滚动）。
3.  **前后端契约验证**：通过 API 调用 (`fetch`) 和参数 (`SearchParams`) 反推后端能力，确保功能描述的端到端完整性。
4.  **后端架构审计**：基于 `engineering_backlog.md` 和 `10_Architecture.md`，梳理数据流、AI 引擎核心及基础设施。

---

## 1. 核心体验与信息流 (Core Experience & Feed)

| 模块     | 子功能          | 功能描述                                                               | 前端实现细节 (文件/逻辑)                                                  | 后端支持 (Engine/Service)                        | 状态     |
| :------- | :-------------- | :--------------------------------------------------------------------- | :------------------------------------------------------------------------ | :----------------------------------------------- | :------- |
| **Feed** | **时光机模式**  | 上滑回溯历史预测，展示当时的市场语境。                                 | `StockVerticalFeed.tsx`: 垂直无限滚动                                     | `api/history`: 分页加载预测记录                  | ✅ 已实现 |
| **Feed** | **横向空间**    | 左右滑动切换股票标的；左溢出进入监控池，右溢出进入个人中心。           | `dashboard/page.tsx`: `useTikTokScroll` + `snap-x`                        | N/A                                              | ✅ 已实现 |
| **Feed** | **TikTok 滚动** | 沉浸式全屏垂直翻页，带自定义滚动进度条。                               | `VerticalIndicator.tsx`: 自绘进度条，`snap-y` CSS 属性                    | N/A                                              | ✅ 已实现 |
| **Feed** | **交互优先**    | 点击 0 延迟，数据加载延后 400ms，确保 iOS 动画流畅。                   | `StockProfile.tsx`: `setTimeout` 延迟 fetch (Interaction First)           | N/A                                              | ✅ 已实现 |
| **Feed** | **防未来函数**  | **Strict Mode V2**: 严格区分盘前/盘中/盘后数据可见性，拒绝"僵尸数据"。 | `StockDashboardCard.tsx`: `thresholdDateStr` & `isDataStale` 逻辑         | Engine: `ai_service.py` 生成确切的 `target_date` | ✅ 已实现 |
| **Feed** | **智能标题**    | 动态文案：盘前显示"今日建议"，盘后显示"复盘"。                         | `StockDashboardCard.tsx`: `getSmartTitle`                                 | N/A                                              | ✅ 已实现 |
| **Feed** | **RSI 隐喻**    | 绿涨红跌逆向设计：绿色(安全区<30)，红色(危险区>70)。                   | `StockDashboardCard.tsx`: 颜色常量映射                                    | Engine: `calculate_indicators` 计算 RSI          | ✅ 已实现 |
| **Feed** | **性能模式**    | 根据设备性能自动降级动画 (Spring -> Tween)。                           | `UserCenterDrawer.tsx`, `lib/device-utils`: `shouldEnableHighPerformance` | N/A                                              | ✅ 已实现 |
| **Feed** | **深度链接**    | 从 URL 参数直接定位到特定股票或打开简报。                              | `dashboard/page.tsx`: `searchParams` + `scrollTo`                         | N/A                                              | ✅ 已实现 |

## 2. AI 智慧与分析 (AI Intelligence)

| 模块     | 子功能         | 功能描述                                                      | 前端实现细节 (文件/逻辑)                            | 后端支持 (Engine/Service)                            | 状态     |
| :------- | :------------- | :------------------------------------------------------------ | :-------------------------------------------------- | :--------------------------------------------------- | :------- |
| **分析** | **脉冲共振**   | 呼吸动画频率表示 AI 活跃度与模型共识。                        | `StockDashboardCard.tsx`: `animate-ping`            | Engine: `indicators.py` (共振算法)                   | ✅ 已实现 |
| **分析** | **置信度系统** | 展示可解释的评分；**<75% 强制熔断为观望**。                   | `StockDashboardCard.tsx`: 百分比展示                | Engine: `ai_service.py` (Circuit Breaker 逻辑)       | ✅ 已实现 |
| **分析** | **大盘黄历**   | 每日盘前/盘后全市场宏观气象与动作宜忌推演 (静默数学视角)。    | `MarketAlmanacFeed.tsx`: 零号位挂载展示             | Engine: `almanac_generator.py` (Trusted v1 架构)     | ✅ 已实现 |
| **分析** | **战术简报**   | 点击卡片展开 JSON 结构化的战术分析 (买/卖点)。                | `TacticalBriefDrawer.tsx`: 解析 `ai_reasoning` JSON | Engine: `ai_service.py` 生成并存入 DB                | ✅ 已实现 |
| **分析** | **历史矩阵**   | 30天胜率可视化矩阵，直观展示预测准确性。                      | `StockProfile.tsx`: Grid 布局 + 颜色编码            | Service: `/api/predictions` (Limit=30)               | ✅ 已实现 |
| **分析** | **AI 智囊团**  | 展示多模型 (DeepSeek, Hunyuan, Quant) 对同一标的的共识/分歧。 | `AICouncil.tsx`: `mode=full` 及前端共识算法         | Service: `/api/predictions` 支持多模型返回           | ✅ 已实现 |
| **分析** | **关键价位**   | 独立展示支撑位、压力位、突破位及止损参考。                    | `TacticalBriefDrawer.tsx`: Key Levels 卡片渲染      | Engine: `ai_service.py` 生成 Key Levels              | ✅ 已实现 |
| **分析** | **上下文提取** | 从全局日报中正则提取特定个股的段落 (Regex Extraction)。       | `BriefDrawer.tsx`: `useMemo` + Regex 匹配           | Engine: `brief_generator.py` (Markdown Generation)   | ✅ 已实现 |
| **分析** | **失败回溯**   | 对历史预测进行"准确/错误/验证中"打标 (T+1/2/3)。              | `StockDashboardCard.tsx` & `HistoricalCard.tsx`     | Engine: `validator.py` (verify_all_pending 多日验证) | ✅ 已实现 |

## 3. 用户体系与增长 (User & Growth)

| 模块     | 子功能       | 功能描述                                            | 前端实现细节 (文件/逻辑)                         | 后端支持 (Engine/Service)                   | 状态     |
| :------- | :----------- | :-------------------------------------------------- | :----------------------------------------------- | :------------------------------------------ | :------- |
| **身份** | **身份护照** | 基于 UserID 的匿名身份系统，支持一键复制。          | `IdentityPassport.tsx`: Clipboard API            | Service: `/api/user/me` (User Identity)     | ✅ 已实现 |
| **安全** | **邮箱绑定** | 绑定邮箱以跨设备/重装后恢复权益 (Pro 功能)。        | `UserCenterDrawer.tsx` (Identity View): 邮箱验证 | Service: `/api/user/recovery`               | ✅ 已实现 |
| **裂变** | **邀请系统** | 邀请好友双方获赠会员时长 (Loot Box 激励)。          | `UserCenterDrawer.tsx`: 动态计算奖励天数         | Service: `/api/user/referral`               | ✅ 已实现 |
| **裂变** | **渠道分润** | 特殊渠道用户 (IsChannel) 显示佣金、提现及交易记录。 | `UserCenterDrawer.tsx`: 条件渲染 Channel 看板    | Service: `/api/user/me` (IsChannel/Balance) | ✅ 已实现 |
| **设置** | **账户找回** | 通过 UserID (`user_xxxx`) 找回旧账号数据。          | `UserCenterDrawer.tsx`: `restoreUserIdentity`    | Service: `/api/user/recovery/link`          | ✅ 已实现 |

## 4. 商业化与权益 (Monetization)

| 模块     | 子功能       | 功能描述                                         | 前端实现细节 (文件/逻辑)                    | 后端支持 (Engine/Service)                    | 状态     |
| :------- | :----------- | :----------------------------------------------- | :------------------------------------------ | :------------------------------------------- | :------- |
| **支付** | **订阅视图** | 动态展示 Free/Pro 权益对比，支持 Stripe 支付流。 | `UserPricingView.tsx`: 调用 Stripe Checkout | Service: `/api/checkout`, Stripe Webhook     | ✅ 已实现 |
| **权益** | **配额锁**   | 免费版限制 3 只股票，Pro 版 10 只。              | `stock-pool/page.tsx`: 配额检查逻辑         | Service: `/api/user/watchlist` (Limit Check) | ✅ 已实现 |
| **权益** | **内容锁**   | 免费版查看"Teaser"简报，Pro 版解锁深度复盘。     | `BriefDrawer.tsx`: 模糊/截断/升级引导       | Service: `/api/brief` (Tier Check)           | ✅ 已实现 |
| **激活** | **兑换码**   | 支持手动输入 `PRO-XXXX` 兑换权益 (Beta)。        | `UserCenterDrawer.tsx`: `handleRedeem`      | Service: `/api/user/redeem`                  | ✅ 已实现 |

## 5. 内容与知识中心 (Content & Support)

| 模块     | 子功能       | 功能描述                                                | 前端实现细节 (文件/逻辑)                    | 后端支持 (Engine/Service)   | 状态     |
| :------- | :----------- | :------------------------------------------------------ | :------------------------------------------ | :-------------------------- | :------- |
| **投教** | **101 指南** | 体系化投教内容 (心法/方法/资金/工具/案例)，含阅读时长。 | `LearnCenterView.tsx`: Markdown 渲染 + 目录 | Service: `/api/learn/:slug` | ✅ 已实现 |
| **客服** | **帮助中心** | 常见问题 (FAQ) 列表，支持即时搜索。                     | `SupportCenterView.tsx`: 客户端搜索过滤     | Service: `/api/support`     | ✅ 已实现 |
| **客服** | **人工通道** | 展示客服二维码，支持离线支付/问题咨询。                 | `UserPricingView.tsx`: 静态资源展示         | N/A                         | ✅ 已实现 |

## 6. 监控池管理 (Stock Pool)

| 模块     | 子功能       | 功能描述                                         | 前端实现细节 (文件/逻辑)                      | 后端支持 (Engine/Service)                    | 状态     |
| :------- | :----------- | :----------------------------------------------- | :-------------------------------------------- | :------------------------------------------- | :------- |
| **管理** | **乐观更新** | 添加/删除股票时 UI 立即响应，不等待 API。        | `stock-pool/page.tsx`: 乐观 UI 模式           | Service: `/api/user/watchlist`               | ✅ 已实现 |
| **管理** | **搜索联想** | 输入代码/拼音首字母实时联想股票 (防抖 300ms)。   | `stock-pool/page.tsx`: Debounce 逻辑          | Service: `/api/stock/search`                 | ✅ 已实现 |
| **管理** | **iOS 优化** | 针对 iOS 禁用高斯模糊背景以提升滚动帧率。        | `stock-pool/page.tsx`: `isIOS` 检测与样式降级 | N/A                                          | ✅ 已实现 |
| **管理** | **实时拼接** | 盘中实时计算指标，拼接历史数据生成最新 MA/MACD。 | N/A (后端计算)                                | Engine: `prices.py` (Local History Splicing) | ✅ 已实现 |

## 7. 通知与触达 (Notification)

| 模块     | 子功能           | 功能描述                                                      | 前端实现细节 (文件/逻辑)                        | 后端支持 (Engine/Service)                                  | 状态     |
| :------- | :--------------- | :------------------------------------------------------------ | :---------------------------------------------- | :--------------------------------------------------------- | :------- |
| **推送** | **Web Push**     | 浏览器级推送通知 (Service Worker)。                           | `UserCenterDrawer.tsx`: PWA Push Manager 集成   | Service: `/api/notifications/subscribe`                    | ✅ 已实现 |
| **设置** | **精细化开关**   | 独立控制 7 类通知：反转/早报/验证/更新/复盘/实时行情/黄历。   | `UserCenterDrawer.tsx`: 详细的开关面板          | Engine: `notification_service.py` (_check_user_preference) | ✅ 已实现 |
| **推送** | **智能反转**     | **Cross-Zero Logic**: 仅在趋势根本改变时(多转空/空转多)推送。 | N/A                                             | Engine: `notification_service.py` (check_signal_flip)      | ✅ 已实现 |
| **治理** | **统一模板引擎** | 通知文案统一由模板中心渲染，支持 tier 化与类型回退。          | N/A                                             | Engine: `notification_templates.py`                        | ✅ 已实现 |
| **测试** | **本地测试**     | "测试当前设备推送" 按钮，验证通路连通性。                     | `UserCenterDrawer.tsx`: `showNotification` 测试 | N/A                                                        | ✅ 已实现 |

## 8. 客户端基础设施 (Client Infrastructure)

| 模块     | 子功能           | 功能描述                                 | 前端实现细节 (文件/逻辑)                        | 后端支持 (Engine/Service)                          | 状态     |
| :------- | :--------------- | :--------------------------------------- | :---------------------------------------------- | :------------------------------------------------- | :------- |
| **系统** | **角标清除**     | 进入 App 时自动清除手机系统红点角标。    | `dashboard/page.tsx`: `navigator.clearAppBadge` | N/A                                                | ✅ 已实现 |
| **系统** | **振动反馈**     | 关键操作 (如回到今天) 触发微弱触感反馈。 | `dashboard/page.tsx`: `navigator.vibrate(10)`   | N/A                                                | ✅ 已实现 |
| **内容** | **Markdown渲染** | 支持复杂格式 (列表/引用/代码) 的渲染。   | `BriefDrawer.tsx`, `LearnCenterView.tsx`        | Engine: `brief_generator.py` (Markdown Generation) | ✅ 已实现 |

## 9. 后端与数据核心 (Backend & Data Core)

此部分追踪不直接暴露给前端，但支撑整个系统运行的核心后端模块(基于 `backend/engine` 审计)。

### 9.1 核心数据 Lane

为避免功能文档误把正式产品数据与研究数据混在一起，本清单采用以下口径：

中文术语约定：

- 中文统一使用“生产线 / 实验线”
- 英文保留 `Production Decision Lane / Research Quant Lane`

1. `Production Decision Lane`
   - 面向用户正式展示。
   - 典型链路：`daily_prices -> ai_predictions_v2 -> mode_pipeline -> /api/modes/*`
   - 对应产品能力：Investment Mode、模式表现、模式决策明细。

2. `Research Quant Lane`
   - 面向量化研究与参数治理。
   - 典型链路：`daily_prices -> sample sync -> sidecar -> calibration`
   - 对应工程能力：`quant_tradeability_signals`、策略版本并行观测、weekly calibration。

3. 边界约束
   - 两条 lane 都建立在真实行情数据之上。
   - 但 `Research Quant Lane` 不是当前前台正式展示的数据源。
   - 生产侧当前重点是按模式分别查看正式绩效，而不是把模式总和作为核心展示目标。

| 模块       | 子功能              | 描述与技术细节                                                               | 代码位置 (Backend/Engine)                     | 状态     |
| :--------- | :------------------ | :--------------------------------------------------------------------------- | :-------------------------------------------- | :------- |
| **ETL**    | **AbstractFetcher** | 统一数据获取接口，支持 AkShare (主) 和 Yahoo (备) 自动降级切换。             | `fetchers.py`, `backend/engine/fetchers/`     | ✅ 已实现 |
| **ETL**    | **Session Context** | 智能缓存 Session，减少对上游数据源的重复连接请求，防止 IP 被封。             | `context.py`                                  | ✅ 已实现 |
| **AI**     | **Prompt 模板化**   | 使用 **Jinja2** 模板引擎管理 System/User prompt，杜绝硬编码字符串拼凑。      | `prompts.py`, `templates/`                    | ✅ 已实现 |
| **AI**     | **LLM Registry**    | 数据库驱动的模型注册表，支持角色路由 (Role-based Routing) 和多模型并发预测。 | `llm_registry.py`                             | ✅ 已实现 |
| **AI**     | **Trace ID**        | 全链路追踪 ID，贯穿 API 请求 -> AI 推理 -> 数据库存储，便于问题排查。        | `logger.py`, `context_service.py`             | ✅ 已实现 |
| **AI**     | **Response Parser** | 统一的结构化响应解析器，替代脆弱的 Regex，增强对 LLM 输出格式的容错性。      | `parsers.py`                                  | ✅ 已实现 |
| **调度**   | **Task Registry**   | 定义清晰的 **Agent Persona** (马库斯/奎因) 和每日任务时间表 (Daily Plan)。   | `task_registry.py`                            | ✅ 已实现 |
| **调度**   | **Task Logger**     | 结构化的任务执行日志，记录状态、耗时、维度信息，支持自动重试和报警。         | `task_logger.py`                              | ✅ 已实现 |
| **监控**   | **Structured Log**  | 统一 JSON 格式日志，集成 Trace ID、User ID 和 Latency 信息。                 | `backend/logger.py`                           | ✅ 已实现 |
| **验证**   | **Multi-Day Valid** | **T+3 验证窗口**：不再仅验证T+1，而是追踪预测后3天的价格轨迹，计算最大收益。 | `validator.py` (verify_all_pending)           | ✅ 已实现 |
| **调度**   | **On-Demand Sync**  | 按需同步机制：优先更新 `watchers_count > 0` 的股票，节省计算资源。           | GitHub Actions workflows, `main.py` arguments | ✅ 已实现 |
| **数据库** | **Query Layer**     | SQL 语句外部化管理，杜绝 Python 代码中内嵌 SQL 字符串，提高可维护性。        | `backend/db/queries/`                         | ✅ 已实现 |

## 10. 内部管理与运维 (Internal Admin & Ops)

仅对内部可用的运维管理界面，确保系统健康与数据透明度。

| 模块     | 子功能           | 描述与技术细节                                                                  | 代码位置                             | 状态     |
| :------- | :--------------- | :------------------------------------------------------------------------------ | :----------------------------------- | :------- |
| **看板** | **核心概况**     | 查看注册用户、AI 预测总量、行情快照等核心指标，支持 Cloud/Local 数据库切换。    | `frontend/src/app/admin/page.tsx`    | ✅ 已实现 |
| **调试** | **Chain 执行端** | 可视化查看一次 AI 分析的所有步骤（Prompt、Raw Response、Time Cost）。           | `frontend/src/app/admin/traces/`     | ✅ 已实现 |
| **监控** | **任务实时状态** | **智能特工指挥中心**：实时监控每日任务（马库斯/奎因）的执行进度，支持手动重跑。 | `frontend/src/app/status/page.tsx`   | ✅ 已实现 |
| **网关** | **推荐分发器**   | 自定义邀请链接 (如 `ziso.cc/v/QUANT`) 的分发与归因网关。                        | `frontend/src/app/v/[code]/page.tsx` | ✅ 已实现 |
