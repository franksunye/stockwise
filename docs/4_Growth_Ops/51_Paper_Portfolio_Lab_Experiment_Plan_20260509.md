# Paper Portfolio Lab Experiment Plan（2026-05-09）

## 1. 定位结论

Paper Portfolio Lab 是一个面向英文市场的增长 / 产品实验，用来验证 serious retail investors 是否愿意关注并参与 AI-assisted paper portfolio tracking。

它不是 International V1 的核心交付，也不是当前就要上线的交易管理系统。它承接的是一个更远期的问题：在 Stockwise 完整 trade management 能力成熟前，能否先用公开、克制、可追踪的实验方式测试用户对“AI 投资 thesis + 模拟组合复盘”的兴趣。

一句话定义：

> Watch AI investment theses play out before risking real capital.

## 2. 灵感来源与可借鉴点

nof1.ai 的启发不在于普通 paper trading 功能，而在于它把 AI 投资能力包装成一个可观看、可追踪、可讨论的实验场。

可借鉴的元素：

- Arena / benchmark：不是普通功能页，而是持续观察 AI 决策行为的实验场。
- Transparency：展示决策、仓位、偏好、风险变化，而不是只展示一个结论。
- Seasonality：用 Season / round / recap 组织用户持续关注。
- Research narrative：强调观察、学习、复盘，而不是承诺收益。
- Waitlist / early access：先收集兴趣，再决定是否进入重工程建设。

Stockwise 不应直接复制“AI 自动交易真钱”。更合适的方向是：把现有 AI prediction、reasoning、watchlist、risk boundary 与未来 trade journal 连接起来，形成一个普通投资者能理解和参与的 AI thesis tracking lab。

## 3. 与 International V1 的边界

International V1 当前核心仍是：

- 英文营销页与 launch routing。
- onboarding / invite / referral 激活链路。
- watchlist 与 AI prediction 体验。
- Learn / Support / pricing 的英文承接。
- Go tier 的主卖点与 Plus upcoming 口径。

Paper Portfolio Lab 不进入 V1 release blocker，不改变当前 v1 发布承诺，也不应让用户误解为 Stockwise 已经提供完整模拟交易账户。

边界原则：

- 可以在英文营销页做概念试水。
- 可以收集 waitlist / feedback signal。
- 可以展示人工维护或配置化的示例 thesis。
- 不在 Phase 0 对接用户级交易后台。
- 不展示夸张收益、不做自动交易、不提供跟单承诺。

## 4. 四阶段路线

### Phase 0：英文营销页静态 / 配置化试水

目标：验证这个叙事是否吸引英文用户，而不是建设交易系统。

交付：

- 英文首页新增 `Paper Portfolio Lab` 或 `AI Thesis Lab` 模块。
- 展示 3-5 个模拟 thesis 卡片：
  - ticker
  - thesis
  - entry date
  - status
  - risk note
  - review cadence
- CTA 使用 `Join the paper trading beta`、`Follow the experiment` 或 `Tell us what you want to track`。
- 增加明确免责声明：
  - paper trading is simulated
  - educational only
  - not investment advice
  - not actual investment results
  - no guarantee of future outcomes
- 加埋点：
  - paper_lab_view
  - paper_lab_cta_click
  - paper_lab_case_open
  - paper_lab_waitlist_submit

验收：

- 英文首页存在入口。
- 用户不会误解为当前已有完整模拟交易账户。
- CTA 能记录兴趣信号。
- 文案不承诺收益，不使用 `beat the market`、`guaranteed return`、`AI stock picker` 等高风险表达。

### Phase 1：官方公开 paper portfolio 实验页

目标：从静态营销升级为官方可追踪实验，但仍然不是用户级产品功能。

交付：

- 新增公开实验页，例如 `/paper-portfolio-lab`。
- 维护一组官方 paper portfolio 或 AI thesis list。
- 每个 thesis 记录：
  - initial thesis
  - entry reference
  - invalidation / risk boundary
  - follow-up notes
  - status changes
  - closing review
- 可以由后台定时任务或配置文件生成内容，但不开放用户创建组合。
- 每周或每个 market cycle 输出 recap。

验收：

- 页面能讲清楚“我们如何追踪 AI thesis”。
- 用户可以看到历史复盘，而不是只看到当日结果。
- 所有展示都带 simulated / educational disclaimer。
- 数据口径清楚，避免混淆真实账户收益与模拟记录。

### Phase 2：用户级模拟组合

目标：开始验证用户是否愿意在 Stockwise 内记录自己的 simulated portfolio。

交付：

- 登录用户可以创建 paper positions。
- 支持 watchlist stock -> simulated entry。
- 支持记录：
  - entry thesis
  - target / risk boundary
  - add / trim / exit note
  - AI thesis change
  - post-trade review
- 与 prediction / tactical brief / alerts 做轻量连接。

验收：

- 用户可以完成完整 simulated trade lifecycle。
- 系统能区分用户输入、AI thesis、价格变化、复盘结论。
- 不涉及真实券商连接，不下单，不托管资产。

### Phase 3：完整交易管理 / Trade Journal / Risk Management

目标：进入长期产品能力，承接 3.0 或更后期的 trade management。

交付方向：

- Trade journal。
- Portfolio-level risk view。
- Position sizing review。
- Drawdown / rule violation tracking。
- AI-assisted post-trade review。
- 与 alerts、nightly plan、decision model 深度融合。

验收方向：

- 用户可以用 Stockwise 管理完整交易复盘流程。
- 系统能帮助用户识别纪律偏差，而不是只记录盈亏。
- 产品定位仍然是 research / workflow / discipline，不变成自动荐股或自动交易系统。

## 5. Phase 0 文案原则

推荐表达：

- `Practice trade planning with a simulated portfolio.`
- `Track entries, exits, thesis changes, and mistakes before risking real capital.`
- `Follow how AI-generated investment theses evolve over time.`
- `Build conviction before you trade.`
- `A transparent paper-trading experiment for tracking AI-generated investment theses.`

避免表达：

- `Beat the market with AI.`
- `See how much you could have made.`
- `Backtest our AI signals.`
- `Let AI trade for you.`
- `Guaranteed returns.`
- `Best AI stock picker.`

免责声明底线：

```text
Paper trading is simulated and for education only. It does not reflect actual investment results and does not guarantee future outcomes. ZISO AI is not financial advice.
```

## 6. 成功指标

Phase 0 先看兴趣，不看收益：

- English homepage paper lab view rate。
- CTA click rate。
- Waitlist / feedback submission count。
- 用户留言中是否主动提到：
  - paper trading
  - trade journal
  - risk management
  - thesis tracking
  - portfolio review
- 从 Reddit / PH / X / organic traffic 进入后的点击差异。

Phase 1 再看复访：

- public lab page repeat visits。
- recap open rate。
- thesis detail open rate。
- 用户是否询问“我能不能跟踪自己的组合”。

## 7. 工程挂钩

本实验最终应与既有 trade management 研究资产连接，但不能倒逼当前 v1 提前建设完整交易系统。

相关文档：

- `docs/1_Engineering/42_Trade_Management_Research_Architecture_20260327.md`
- `docs/1_Engineering/43_Trade_Management_POC_02171_20260328.md`
- `docs/1_Engineering/44_CEnd_Trade_Management_Phase0_Implementation_Plan_20260330.md`
- `docs/4_Growth_Ops/48_V1_International_Launch_Playbook.md`
- `docs/4_Growth_Ops/50_English_Mobile_Content_Completion_Plan_20260506.md`

未来进入 Phase 1 前，需要补一份轻量数据口径说明，至少回答：

- 官方 paper portfolio 的样本如何选择。
- entry / exit / invalidation 是否来自 AI、人工、还是固定规则。
- 价格与市场数据的刷新频率。
- recap 是否展示 performance，如果展示，如何避免误导。
- 是否需要独立的 compliance copy review。

## 8. 当前决策

- 先作为英文市场增长实验记录，不进入 International V1 release blocker。
- Phase 0 使用静态或配置化营销内容，不对接后台模拟交易功能。
- Phase 0.1 调整为独立英文实验页 `/paper-portfolio-lab`，不再占用英文首页主叙事。
- Backlog 放入 Vx 候选池，保留战略价值，但不占用 v1 当前执行优先级。
- 若 Phase 0 / 0.1 获得明确兴趣信号，再进入 Phase 1 的公开实验页设计。

## 9. Phase 0 实施记录（2026-05-09）

已在英文首页落地 Phase 0 试验模块：

- 位置：`frontend/src/components/marketing/en/EnglishHomePage.tsx`
- 入口标题：`Paper Portfolio Lab Preview`
- 展示方式：静态 / 配置化 AI thesis cases，当前包含 `NVDA`、`MSFT`、`TSLA` 三个示例。
- CTA：
  - `Join the paper trading beta`
  - `Follow the experiment`
- 埋点：
  - `paper_lab_view`
  - `paper_lab_cta_click`
  - `paper_lab_case_open`
- 边界文案：已明确 `simulated`、`education only`、`not actual investment results`、`no guarantee of future outcomes`、`not financial advice`。

本次仍未接入后台模拟交易功能，也未创建用户级 paper portfolio 数据结构。Phase 0 的目标是验证英文首页用户是否对 AI thesis tracking / paper trading beta 有兴趣。

## 10. Phase 0.1 实施记录（2026-05-09）

Phase 0.1 最终调整为独立英文实验页 `/paper-portfolio-lab`，而不是继续放在英文首页。原因是 Paper Portfolio Lab 与当前 International V1 主推产品不同：它是增长 / 产品试验，不应稀释首页对现有 research / watchlist / pricing 转化链路的表达。

页面形态仍是轻量 `Lab Console`，更接近 nof1.ai 带来的“可观看实验场”启发，但保持 Stockwise 自己的边界：模拟、教育、thesis discipline，不展示 P&L，不连接券商，不承诺收益。

已落地：

- 顶部状态栏：`Paper Portfolio Lab`、`Season 0`、`Simulated`、`No P&L`、示例 ticker。
- 左侧定位区：`Live Lab Preview`、核心句 `Build conviction before you trade.`、3 个轻量指标与 beta / follow CTA。
- 中间 `Thesis Board`：展示 NVDA / MSFT / TSLA 的 thesis、状态、entry reference、review cadence、risk boundary。
- 右侧 `AI Thesis Log`：展示模拟的 post-close review / boundary check / volatility note，让页面更像可持续观察的实验日志。
- 埋点 phase 更新为 `phase_0_1`，继续使用 `paper_lab_view` / `paper_lab_cta_click` / `paper_lab_case_open`。
- 免责声明保留：paper trading is simulated、educational only、not actual investment results、not financial advice。
- 英文首页移除完整 Lab 模块，避免影响当前 v1 主叙事和首屏转化。
- 英文 footer 增加轻入口 `Paper Portfolio Lab`，提供稳定内部入口，但不进入首页首屏或主导航。

仍然不做：

- 不展示收益率、排名或 leaderboard。
- 不对接用户级 paper positions。
- 不写入后台交易或组合数据。
- 不引入真实 order / brokerage / copy-trading 语义。

0.1 的判断标准不是“功能完整”，而是页面是否让英文用户一眼理解这是一个可持续关注的 AI thesis tracking experiment，并愿意点击 beta / follow CTA。

## 11. Phase 0.1 上线后诊断待办（2026-05-09）

`/paper-portfolio-lab` 上线后回看，主要不满意点集中在两条：品牌视觉与首页主行为色脱钩、工程上把独立页伪装成 `currentPage="home"` 触发了真实的导航 / locale 切换 bug。本节落具体修复清单，按优先级排序，等启动 Phase 0.1 修补轮再迁回 Backlog v1 执行面。

### 11.1 P0（顶部导航真实 bug，必须修）

- 顶部导航 Features / FAQ 锚点失效：`MarketingHeader.tsx:28,72,77` 在 `currentPage === 'home'` 时把 anchor 前缀置空，导致从 `/paper-portfolio-lab` 上点击会停在 `/paper-portfolio-lab#features` / `#faq`（本页无该 anchor），不会跳回首页 anchor。
- 语言切换器丢上下文：`MarketingHeader.tsx:87-92` 在 `currentPage === 'home'` 时把切换链接构造为各语种首页，用户在本页点 中文 / 한 / ES 会被静默扔到 `/zh-CN/` 等首页。
- 修复方向：把 `MarketingHeaderPage` 类型扩展加 `'paper-portfolio-lab'`，本页改写 `<PageShell currentPage="paper-portfolio-lab">`；`MarketingHeader` 在该 currentPage 下让 anchor 前缀正确指向首页、且隐藏或 disable 语言切换器（本页是 EN-only 实验）。

### 11.2 P1（品牌一致性 + 工程契约）

- 主 CTA 颜色 / 形状 / 阴影：`EnglishPaperPortfolioLabPage.tsx:125` 当前 `bg-cyan-500 text-black rounded-2xl` 无阴影，与首页 `EnglishHomePage.tsx:80` 的 `bg-indigo-500 text-white rounded-3xl shadow-[0_20px_40px_rgba(99,102,241,0.3)]` 主行为色脱钩。整页 indigo 一次都未出现，需要至少在 hero badge / h1 渐变 / 主 CTA 三处之一让 indigo 回归，避免"换了产品"的瞬间错觉。
- h1 高亮渐变：`EnglishPaperPortfolioLabPage.tsx:115` 单色 `text-cyan-300`，应恢复首页 `bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent` 的两段式渐变。
- `MarketingHeaderPage` 类型修复：`MarketingHeader.tsx:9` 与 `EnLayout.tsx:11` 的 union 当前不含本页，被强行塞 `'home'` 绕过类型系统；同 P0 修复一并完成。
- 埋点契约对账：实验计划第 70-74 行列出的 `paper_lab_waitlist_submit` 在 `EnglishPaperPortfolioLabPage.tsx:67-91` 未接（也无 waitlist 表单）；要么补一个真实 waitlist 表单（推荐复用现有 invite / feedback 通道），要么把文档里这条事件标记为延后到 Phase 1。
- metadata `keywords` 合规口径：`paper-portfolio-lab/layout.tsx:11-12` 加入了 `paper portfolio` / `paper trading` 等敏感词，需要先和 `brandCoreEn.boundaryNotice` 的措辞口径对齐再确认是否保留。
- `alternateLocales` 与 UI 切换器一致性：`paper-portfolio-lab/layout.tsx:11` 写 `['en']`（EN-only 策略），但页面仍展示四语种切换器，hreflang 与 UI 不一致；需配合 P0 切换器隐藏方案一并收口。

### 11.3 P2（节奏 / 信息架构 / 重构）

- Hero 排版从首页中轴居中破成左对齐网格：`EnglishPaperPortfolioLabPage.tsx:105` 与首页 `EnglishHomePage.tsx:59` 节奏不一致，建议改回中轴或保留左对齐但新增设计理由说明。
- 状态栏样本与定语混排：`EnglishPaperPortfolioLabPage.tsx:160` 当前列 `['Season 0', 'Simulated', 'No P&L', 'NVDA', 'MSFT']` 漏了 TSLA，且把"实验阶段"、"合规标签"、具体 ticker 塞进同一条，建议拆成"阶段标签"和"样本 ticker"两栏。
- `tracking-*` 数值五个值在同页轮换（`tracking-widest` / `tracking-[0.16em]` / `tracking-[0.2em]` / `tracking-[0.14em]` / `tracking-tighter`），建议收敛到 2-3 个层级值。
- JsonLd 稀薄：`EnglishPaperPortfolioLabPage.tsx:93-99` 仅 `@type: WebPage` 三字段，建议补 `url` / `isPartOf` / `inLanguage` / `publisher`，与首页 / About JsonLd 对齐。
- 文件结构：268 行单 client 文件混 data / view / analytics / JsonLd，未来 Phase 1 接配置化数据时需要把 `paperLabCases` / `paperLabLogs` 抽成可外部维护的数据源（例如 `frontend/src/content/paper-lab/cases.en.ts`），不然每条 thesis 更新都要走前端 PR。

### 11.4 已核实非本页问题（不进入修复清单）

- `paper-portfolio-lab/layout.tsx:2` 用 `brandCoreZhCN` 取 domain：和 `pricing/layout.tsx:2`、`about/layout.tsx:2` 是仓库现有约定，不是本页特有问题。后续可在仓库层面起一个"为 EN 页接 `brandCoreEn`"的小重构 ticket，但不阻塞本页的 0.1 修补轮。
