# 功能规格说明书：投资模式（Investment Mode）(Spec 47)

> 定位：底层专业，表层极简（2C）。
> 本 Spec 聚焦“模式定义、表现定义、系统边界、上线标准”，用于产品、前端、后端、量化统一实现。

> 发布状态（2026-03-07）：
> - 后端与 API 已发布到 `main`（commit: `a941edf`）
> - 前端体验改造与增长实验仍按后续阶段推进
> - Investment Mode / Tradeability 专项已完成，本文继续作为现行产品规格

---

## 0. 设计基线（外部依据）

### 0.1 2C 设计原则
- 前台只展示可执行结论：模式名、风险带、表现。
- 后台保留专业复杂度：策略版本、参数包、状态机、样本口径。
- 复杂解释采用渐进披露（默认折叠，按需展开）。

### 0.2 约束来源（用于设计取舍，不构成投资建议）
- 渐进披露：Nielsen Norman Group
  - https://www.nngroup.com/articles/progressive-disclosure/
- 平台一致性与信息层级：Apple HIG
  - https://developer.apple.com/design/human-interface-guidelines/
- 面向消费者的清晰文案（Plain Language）：CFPB
  - https://www.consumerfinance.gov/plain-writing/
- 风险适配（风险承受能力、期限、流动性）：FINRA Rule 2111
  - https://www.finra.org/rules-guidance/rulebooks/finra-rules/2111
- 默认项会影响选择行为：Johnson & Goldstein (2003)
  - https://pubmed.ncbi.nlm.nih.gov/14631022/

---

## 1. 核心目标（Goal）

把“量化策略工程”封装成“用户可理解、可选择、可执行”的投资模式层。
用户选择的是“决策风格”，不是底层参数。

---

## 1.1 战略承接（Strategy Alignment）

本 Spec 必须与产品战略保持同向，作为长期约束，不随单次迭代摇摆。

### A. 北极星与产品定位
- 北极星：降低普通用户的投资决策复杂度，提高“可执行决策”的稳定供给。
- 产品定位：2C 决策产品，不是量化终端或专业交易工作台。
- 表达原则：用户看“模式与结论”，系统内部才看“模型与参数”。
- 当前量化风格：以趋势突破、动量确认和风险否决为核心，而不是高频、统计套利或多因子终端。

### B. 用户分层战略
- Free：先让用户“看得懂、用得起、能执行”（单模式、低负担）。
- Pro：在不破坏简洁的前提下，提供更多控制权与个性化表现（多模式、双轨表现、多周期）。
- 分层目标：Pro 增强“深度”，不是增强“复杂度”。

### C. 能力边界战略
- 当前阶段：单用户单激活模式（Active Mode），避免并行模式共决策带来的认知与归因混乱。
- 当前阶段不做：模式组合权重引擎、自动混合策略、黑箱共决策。
- 后续扩展：若进入模式组合阶段，必须先建立可解释归因与回测口径，再开放给用户。

### D. 版本演进战略
- V1：先把“模式对象 + 体现矩阵 + Free/Pro 边界”做扎实。
- V2：在稳定数据口径后扩展市场区隔与行情区隔。
- 所有版本演进必须保持：表层极简、底层专业、历史可追溯。

### E. 战略一致性验收
- 新增功能若提升复杂度，必须说明“用户收益 > 认知成本”。
- 任一改动不得破坏“默认可用、无需学习即可执行”的体验底线。
- 术语必须与领域词表一致（Mode/Stock/Pool/Decision），禁止同物多名。

---

## 2. 模式定义（必须写死）

### 2.1 模式是什么
投资模式（Investment Mode）是用户侧决策偏好层，用于决定系统如何把同一套模型输出转译为可执行建议。

### 2.2 模式不是什么
- 不是模型本身（Model）。
- 不是单一策略版本（Strategy Version）。
- 不是单条买卖信号（Signal）。
- 不是高频交易策略的前台封装。
- 不是传统多因子组合产品的直接映射。
- 不是给普通用户暴露裸参数的研究工作台。

### 2.3 模式与底层的关系
`mode_id -> strategy_version + params_bundle + display_policy`

说明：模式可映射到不同策略版本，也可在同策略版本下切不同参数包。模式与策略版本不是永久 1:1 绑定。

补充约束：模式的本质是把“出手条件与风险立场”产品化，而不是把研究参数直接商品化。

### 2.4 模式发布物（Release Artifact）

当前阶段，正式进入生产的不是一组孤立参数，而是一个“模式发布物”。

模式发布物至少应绑定：
- 参数包（`params_bundle`）
- 对应研究窗口与研究样本
- 研究结论摘要（候选比较、选择理由、核心指标）
- 后续生产生效时间与生产绩效追踪入口

口径要求：
- 线下研究环境负责形成和验证模式发布物。
- 上线后，生产环境使用该发布物中的参数，在生产数据和生产池上运行，生成该模式的正式生产效果。
- 研究证据属于模式发布物的一部分，但不直接替代前台正式表现。

---

## 3. 核心对象（Mode Entity）

### 3.1 InvestmentMode

| 字段 | 类型 | 说明 |
|---|---|---|
| `mode_id` | string | 模式唯一标识（如 `balanced_v1`） |
| `name` | string | 用户展示名 |
| `tagline` | string | 一句话说明 |
| `risk_band` | enum | `low` / `medium` / `high` |
| `default_horizon` | enum | `7d` / `30d` / `90d`（默认 `30d`） |
| `strategy_mapping` | object | `strategy_version + params_bundle` |
| `display_policy` | object | 前台指标与文案策略 |
| `is_default` | boolean | 是否默认模式 |
| `status` | enum | `active` / `shadow` / `deprecated` |
| `effective_from` | datetime | 生效时间（可追溯） |

### 3.2 最小模式目录（V1）

| 模式 | 风格 | 默认映射 |
|---|---|---|
| 稳健 | 回撤优先 | `tradeability_v2` + 稳健参数包 |
| 平衡（默认） | 覆盖与质量平衡 | `tradeability_v2` + 平衡参数包 |
| 进取 | 覆盖优先 | `tradeability_v2` + 进取参数包 |
| 仅观察 | 不给进场建议 | `tradeability_v2` + 观察参数包 |

补充口径：

- 生产侧对用户可见为 4 个可选模式。
- 其中 `稳健 / 平衡 / 进取` 是需要持续量化优化、比较和升级治理的核心模式。
- `仅观察` 也是正式生产模式，但属于特殊模式：
  - 目标是提供保守观察位，而不是参与“最优参数”竞争。
  - 不以量化回测找最优参数为主要目标。
  - 在后台展示时应单独标记，避免与三类核心模式混作同类排名。
  - 它代表的是更低动作密度和更保守的出手方式，不代表收益承诺，也不天然等于“更安全”。

术语约定：

- 本文中文统一使用“生产线”指代正式用户结果链路。
- 若需引用英文或系统概念，对应 `Production Decision Lane`。

---

## 4. 表现定义（Performance）

### 4.1 强制双轨（必须）
每个模式必须同时产出两套表现：

1. `universal_performance`（通用表现）
- 口径：标准市场样本（平台统一样本池）
- 回答问题：这个模式本身是否稳定

2. `pool_performance`（监控池表现）
- 口径：用户当前监控池样本
- 回答问题：这个模式对我是否有效

后台查看原则（当前阶段）：

- PC 端 Admin 当前重点不是“把所有模式汇总成一个总成绩”。
- 当前重点是分别查看各模式的独立绩效，判断平台通过每个模式分别为用户提供了什么价值。
- 若存在汇总口径，也只作为辅助分析，不作为当前后台核心展示目标。

补充边界：

- 研究绩效回答“该模式发布物是否值得进入生产”。
- 生产绩效回答“该模式发布物在生产数据和生产池中的正式效果如何”。
- 两者都属于同一模式对象，但不得互相混称，也不得把研究绩效直接表述为前台正式表现。

### 4.2 强制周期（必须）
每套表现都必须有三周期：
- `short` = 7D
- `mid` = 30D
- `long` = 90D

### 4.3 推荐区隔（专业层，可折叠）
在三周期之外，建议增加两类区隔，但默认不在首屏展示：
- 市场区隔：`CN` / `HK`（后续可扩）
- 行情区隔：`trend_up` / `range` / `risk_off`

### 4.4 指标与展示规则（2C）
首屏固定 3 指标：
- 覆盖率 `coverage`
- 命中率 `hit_rate`
- 最大回撤 `max_drawdown`

高级指标（展开）可包含：
- 样本量 `sample_size`
- 盈亏比 `payoff_ratio`
- 信号稳定度 `stability_score`

样本阈值规则：
- `sample_size < 30` 时显示“样本不足，不给结论”。

展示约束：

- 任一模式表现都属于历史统计结果，不得被表达为未来收益承诺。
- `hit_rate`、`payoff_ratio`、`stability_score` 不允许脱离 `sample_size`、时间窗和风险指标单独强调。
- 后台与前台都应优先表达“模式价值与适配性”，而不是制造“稳赢”或“天然更安全”的误导。

---

## 5. 前台语义与模式联动

### 5.1 四语义（统一）
- 建议进场
- 建议观察
- 建议防守
- 暂无信号

### 5.2 展示优先级
1. `layer1_status` -> 四语义
2. 若为空，`signal` 兼容映射 -> 四语义
3. 仍为空：`等待分析`

### 5.3 关键约束
模式切换改变的是“后续新预测的解释与决策策略”，不回写历史预测结论。

---

## 6. 数据与接口契约

### 6.1 数据对象
- `user_investment_mode`
  - `user_id`
  - `mode_id`
  - `updated_at`
- `ai_predictions_v2` 扩展字段
  - `mode_id`
  - `layer1_strategy_version`（已存在，必须持续写入）

### 6.2 API
- `GET /api/user/mode`：当前用户模式
- `POST /api/user/mode`：切换模式
- `GET /api/modes`：模式定义、文案、风险标签
- `GET /api/modes/performance?scope=universal|pool&horizon=7d|30d|90d`：表现输出

### 6.3 兼容策略
- 未设置模式用户默认回退 `平衡模式`。
- 历史无 `mode_id` 记录展示“历史默认模式”。
- 当前线上默认策略版本：`tradeability_v2`。

### 6.4 后台能力建设（必须）

为支撑“模式绩效可解释、可验证、可复盘”，后台必须建设两层记录能力：

1. `mode_decision_log`（决策日志）
- 定义：记录每个模式在每个交易日的决策结论与触发依据（如：进场/观察/防守/暂无信号）。
- 目标：保证“为什么这样判断”可审计、可追溯。
- 最小字段建议：`mode_id`, `date`, `symbol`, `decision_semantic`, `strategy_version`, `trigger_flags`, `reasoning_snapshot`, `created_at`。

2. `mode_simulated_trade_ledger`（模拟交易台账）
- 定义：按统一撮合与持仓规则，把决策日志转译为模拟开平仓记录（非真实券商成交）。
- 目标：所有模式绩效指标都从该台账聚合，避免口径漂移。
- 最小字段建议：`mode_id`, `symbol`, `entry_date`, `exit_date`, `entry_price`, `exit_price`, `holding_days`, `pnl_pct`, `trade_status`, `rule_version`, `created_at`。

约束：
- `universal_performance` 与 `pool_performance` 必须可回溯到上述两层记录。
- 前台“表现”口径必须引用同一台账聚合结果，不得使用临时口径。

### 6.5 数据模型（Backend Contract）

#### A. `user_investment_mode`（用户激活模式）
- 作用：记录用户当前激活模式（单用户单激活）。
- 约束：`(user_id)` 唯一，切换模式只更新当前行，不删除历史。
- 建议字段：
  - `user_id` TEXT PRIMARY KEY
  - `mode_id` TEXT NOT NULL
  - `updated_at` TIMESTAMP NOT NULL
  - `updated_by` TEXT DEFAULT 'user'

#### B. `mode_decision_log`（决策日志）
- 作用：记录“每日/每标的/每模式”的决策结论及依据，是解释链与审计基线。
- 唯一键建议：`(mode_id, symbol, decision_date, strategy_version)`
- 建议字段：
  - `id` TEXT PRIMARY KEY
  - `mode_id` TEXT NOT NULL
  - `symbol` TEXT NOT NULL
  - `decision_date` TEXT NOT NULL
  - `strategy_version` TEXT NOT NULL
  - `decision_semantic` TEXT NOT NULL（仅允许：进场/观察/防守/暂无信号）
  - `layer1_status` TEXT
  - `trigger_flags` TEXT（JSON）
  - `reasoning_snapshot` TEXT（摘要快照，避免前台重算）
  - `confidence` REAL
  - `created_at` TIMESTAMP NOT NULL

#### C. `mode_simulated_trade_ledger`（模拟交易台账）
- 作用：把决策日志按统一规则转成模拟交易记录，作为绩效统计唯一事实源。
- 唯一键建议：`(mode_id, symbol, entry_date, rule_version)`
- 建议字段：
  - `id` TEXT PRIMARY KEY
  - `mode_id` TEXT NOT NULL
  - `symbol` TEXT NOT NULL
  - `entry_date` TEXT NOT NULL
  - `exit_date` TEXT
  - `entry_price` REAL NOT NULL
  - `exit_price` REAL
  - `holding_days` INTEGER
  - `trade_status` TEXT NOT NULL（`open` / `closed`）
  - `decision_source_id` TEXT NOT NULL（关联 `mode_decision_log.id`）
  - `pnl_pct` REAL
  - `max_drawdown_pct` REAL
  - `rule_version` TEXT NOT NULL
  - `created_at` TIMESTAMP NOT NULL
  - `updated_at` TIMESTAMP NOT NULL

#### D. `mode_performance_snapshot`（绩效快照，建议）
- 作用：按 `scope + horizon + mode` 预聚合，前台查询稳定低延迟。
- 唯一键建议：`(mode_id, scope, horizon, as_of_date, segment_key)`
- 建议字段：
  - `mode_id` TEXT NOT NULL
  - `scope` TEXT NOT NULL（`universal` / `pool`）
  - `horizon` TEXT NOT NULL（`7d` / `30d` / `90d`）
  - `segment_key` TEXT DEFAULT 'all'
  - `coverage` REAL
  - `hit_rate` REAL
  - `max_drawdown` REAL
  - `sample_size` INTEGER
  - `payoff_ratio` REAL
  - `stability_score` REAL
  - `as_of_date` TEXT NOT NULL
  - `computed_at` TIMESTAMP NOT NULL

### 6.6 计算链路与作业节奏（Backend Workflow）

统一链路（不可跳步）：
1. 预测落库：`ai_predictions_v2` 持续写入 `mode_id + layer1_strategy_version`。
2. 决策归档：按四语义生成 `mode_decision_log`。
3. 台账结算：按统一规则生成/更新 `mode_simulated_trade_ledger`。
4. 绩效聚合：产出 `mode_performance_snapshot`（`universal/pool` + `7d/30d/90d`）。
5. 前台读取：仅从快照和明细只读接口获取，不在前台重算。

作业节奏建议：
- `post_close`：主计算窗口（生成当日决策、结算台账、刷新快照）。
- `intraday`：仅允许增量刷新，不回写历史结论。
- `backfill`：允许离线补算，但必须带 `rule_version` 且可审计。

一致性约束：
- 任意绩效指标都必须可回溯到台账记录集。
- 任意台账记录都必须可回溯到决策日志与来源预测。

### 6.7 API 契约（可落地）

#### 已定义（保留）
- `GET /api/user/mode`
- `POST /api/user/mode`
- `GET /api/modes`
- `GET /api/modes/performance?scope=universal|pool&horizon=7d|30d|90d`

#### 新增（建议纳入本期）
1. `GET /api/modes/performance/summary`
- query: `mode_id`, `scope`, `horizon`, `segment?`
- response: `coverage`, `hit_rate`, `max_drawdown`, `sample_size`, `as_of_date`, `disclaimer`

2. `GET /api/modes/performance/ledger`
- query: `mode_id`, `horizon`, `page`, `page_size`, `symbol?`, `trade_status?`
- response: `items[]`（模拟交易台账）、`total`, `page`, `page_size`
- Free/Pro：Free 仅返回最近 N 条摘要；Pro 返回完整分页与筛选。

3. `GET /api/modes/decisions`
- query: `mode_id`, `date_from`, `date_to`, `symbol?`, `page`
- response: `items[]`（决策语义 + 触发依据摘要），用于“为什么这样判断”。

4. `GET /api/modes/performance/drilldown`
- query: `mode_id`, `scope`, `horizon`
- response: 指标分解（按市场/行情区隔，默认折叠字段）。

接口统一约束：
- 全部接口必须 `requireUserSession` 鉴权。
- 全部接口必须兼容 `cloud/local` 双数据源客户端。
- `sample_size < 30` 时统一返回 `insufficient_sample=true` 与提示文案。

### 6.8 权限、口径与审计

权限分层：
- Free：仅 `summary + 30D universal`，可看有限明细摘要。
- Pro：`summary + drilldown + ledger + decisions` 全量。

口径红线：
- 不允许把模拟台账表述为真实成交。
- 所有收益/回撤展示必须带 `as_of_date` 与 `rule_version`。
- 文案必须显式包含“历史表现不代表未来收益”。

审计要求：
- 每次重算必须记录 `job_id`, `rule_version`, `triggered_by`。
- 任一前台展示值可追溯：`UI值 -> snapshot -> ledger rows -> decision log -> prediction`。

---

## 7. 交互规范（表层极简）

前台只负责交付形态，不负责重定义数据口径：同一套后台能力与数据，按用户层级与设备场景，以简洁、克制的方式呈现。

- 模式卡片首屏只显示：模式名 + 风险带 + 30D 三指标。
- 周期切换只给 `7D/30D/90D`，不开放自由日期。
- 所有解释文本不超过两行，详情进入二级面板。
- 默认只推荐一个模式（平衡），其余作为可选。

### 7.1 无缝接入现有体验（基于当前前端结构）

接入原则：不新增主导航层级，不打断当前 Dashboard 卡片流。

- 入口落点（主入口）：`UserCenterDrawer` 内新增“投资模式”折叠区。
- 入口落点（辅入口）：首次引导完成后，给一次性轻提示（不强制弹窗）。
- 保持现有横向主流：`/dashboard` 与 `/dashboard/stock-pool` 的左右手势不变。
- 保持现有头部操作：顶部左右按钮仍用于个人中心/简报，不改交互语义。
- 模式详情承载：沿用现有 Drawer/面板样式，不新增独立全屏路由。

### 7.2 Dashboard 首屏展示策略（不增负担）

- 首屏不新增“模式大卡”。
- 仅在现有核心结论附近显示轻量模式标识：`平衡模式 · 30D`（一行微文案）。
- 点击微文案进入模式抽屉；不触发页面跳转。
- 未加载完成时不占位，不闪烁（遵循现有 Zero UI Flash 原则）。

### 7.3 交互细节（移动端优先）

- 模式切换为单选列表，卡片高度与当前设置项风格一致。
- 切换后使用底部 Toast 反馈：“已切换为平衡模式，新预测将按该模式生效”。
- 不在切换后强制刷新整页，仅触发相关数据 revalidate。
- 历史卡片保持原结论，避免用户感知“回写历史”。

### 7.4 禁止破坏项（Must Not）

- 不新增底部 Tab。
- 不改变 Dashboard 主卡片排版层级。
- 不引入二次确认弹窗链（最多一次确认）。
- 不把专业指标堆到首屏。

### 7.5 模式体现矩阵（用户选择后必须可见）

用户切换模式后，系统必须在以下触点体现“当前模式”，避免“切了但无感”：

| 触点 | 组件/页面 | 必须体现内容 | 交互要求 |
|---|---|---|---|
| Dashboard 主卡 | `StockDashboardCard` | 当前模式短标签（如 `平衡 · 30D`） | 轻量一行，不抢主结论 |
| 策略内参抽屉 | `TacticalBriefDrawer`（策略内参） | 当前模式名 + 风险带 + 生效说明（仅新预测） | 放在顶部信息区，默认展开 |
| 投研决议页签 | `TacticalBriefDrawer`（投研决议） | 头部共识区旁显示“模式徽标文案”（文字型，不做复杂图形） | 不改变现有卡片层级 |
| 监控池列表 | `/dashboard/stock-pool` | 列表头显示当前模式；单股沿用四语义 | 不增加列表行高 |
| 个人中心 | `UserCenterDrawer` | 模式入口 + 当前模式 + 最近切换时间 | 可直接切换 |
| 首次引导完成 | `Onboarding` 完成后轻提示 | 告知“可在个人中心切换投资模式” | 仅一次提示，可关闭 |

文案约束：
- 模式体现默认用“文字徽标”，不引入复杂 icon 动效。
- 禁止出现“收益承诺”词汇。
- 历史记录若模式缺失，显示“历史默认模式”。

### 7.6 投研决议场景（对应截图）

- 在“投研决议”页签头部（`x席 投研决议` / 共识词旁），增加 `当前模式` 文本标签。
- 在成员卡片不重复灌入模式信息，避免视觉噪音。
- 共识结论仍由四语义和模型结果驱动，模式只做“解释上下文”，不覆盖结论。

### 7.7 交付矩阵（极简 / 专业 × 移动端 / PC）

同一套后台数据，前台只做交付分层，不做口径分叉：

| 形态 | 移动端 | PC |
|---|---|---|
| 极简（默认） | 一行模式徽标 + 30D 三指标 + 一键切换 | 顶部模式条 + 30D 三指标 + 快捷切换 |
| 专业（展开） | 二级抽屉看决策摘要与有限台账 | 侧栏/抽屉看完整台账、筛选、区隔分解 |

交付原则：
- 移动端优先“单手可读、单次决策、低跳转”。
- PC 优先“并排对比、筛选复盘、信息密度可控”。
- 默认不展示大段数字表格，按需展开。

### 7.8 前台状态机（必须统一）

模式相关前台状态仅允许：
- `loading`
- `ready`
- `insufficient_sample`
- `stale_data`
- `error`

行为约束：
- `stale_data` 允许展示上次快照，但必须显示时间戳。
- `error` 不得展示过期错误结论，应回退到“等待分析/稍后重试”。
- 状态文案保持 Plain Language，禁止专业术语堆叠。

### 7.9 明细披露边界（前台克制）

- 首屏永远不出现“交易流水长表”。
- 明细入口默认命名为“查看依据/查看明细”，避免“跟单”暗示。
- 明细页固定包含：
  - 数据标签：`模拟台账（非真实成交）`
  - 统计时间：`as_of_date`
  - 合规提示：`历史表现不代表未来收益`

---

## 8. 风控与合规边界

- 禁止收益承诺文案（如“稳定翻倍”）。
- 必须显示“历史表现不代表未来收益”。
- 模式必须声明适配人群：风险偏好、投资期限、流动性需求。
- 模式与用户画像的关系必须可解释：至少覆盖风险承受能力、投资期限和流动性需求三项，不得只做营销式标签分层。

### 8.1 Free / Pro 分层（模式能力）

基于当前会员体系（`free` / `pro`）定义如下差异：

| 维度 | Free | Pro |
|---|---|---|
| 可选模式 | 仅 `平衡模式`（默认） | 全部模式（稳健/平衡/进取/仅观察） |
| 表现数据 | 仅看 `通用表现` 的 `30D` | `通用+监控池`，可切 `7D/30D/90D` |
| 投研决议中的模式信息 | 显示当前模式，不展示高级细分 | 显示当前模式 + 风险带 + 周期切换 |
| 模式切换频率 | 可限制冷却时间（如每日 1 次） | 实时切换 |
| 高级解释 | 折叠且部分锁定 | 全量可见 |

升级触发点（仅文案提示，不打断）：
- Free 用户点击非平衡模式时，展示 Pro 权益底栏，不强制跳转。
- Free 用户在投研决议点击“监控池表现”时，展示“Pro 解锁”占位卡。

### 8.2 增长联动文档（Owner: Growth Ops）

投资模式相关的增长假设、KPI、A/B 实验、上线门槛与回滚，
统一维护在增长文档：

- `docs/4_Growth_Ops/50_Growth_Roadmap_333_Plan.md`（章节：投资模式增长专项）

本 Spec 只保留产品定义与能力边界，避免产品与增长口径重复维护。

---

## 9. 上线节奏

### Phase 1（MVP）
- 上线模式实体、用户模式持久化、双轨表现接口。
- 前台默认展示 30D，可切 7D/90D。

### Phase 2
- 打开四模式全量切换。
- 增加市场区隔与行情区隔（折叠展示）。

### Phase 3
- 模式灰度、影子运行、A/B 效果追踪。

### 9.1 增长实验（引用）

模式增长实验在增长文档统一管理：
- `docs/4_Growth_Ops/50_Growth_Roadmap_333_Plan.md`（章节：投资模式增长专项）

### 9.2 上线门槛与回滚（引用）

具体门槛与回滚条件以增长文档为准：
- `docs/4_Growth_Ops/50_Growth_Roadmap_333_Plan.md`（章节：投资模式增长专项）

---

## 10. 验收标准（Done）

- [ ] 模式定义在前后端与文案层一致（同名同义）。
- [x] 每个模式都有 `通用表现 + 监控池表现`。
- [x] 每套表现都有 `7D/30D/90D`。
- [x] 样本不足规则生效且前台有明确提示。
- [ ] 前台核心场景只使用四语义主文案。
- [x] 新预测写入 `mode_id + layer1_strategy_version`。
- [x] 已建设 `mode_decision_log`，并可按 `mode_id/date/symbol` 查询决策依据。
- [x] 已建设 `mode_simulated_trade_ledger`，模式绩效可回溯至模拟交易台账。
- [x] 已建设 `mode_performance_snapshot`，前台首屏查询不依赖实时重算。
- [x] 模式绩效全链路可追溯（snapshot -> ledger -> decision -> prediction）。
- [x] 默认策略版本为 `tradeability_v2`。
- [ ] 用户切换模式后，Dashboard/投研决议/监控池/个人中心四处均可见当前模式。
- [ ] Free 与 Pro 的模式能力边界按分层规则生效。
- [ ] 前台已实现“极简/专业 × 移动端/PC”交付矩阵且不破坏现有导航。
- [ ] 已建立模式功能增长看板（触达、交互、转化、留存）。
- [ ] 至少完成 1 轮 A/B 实验并形成结论与后续动作。
- [ ] 明确上线门槛与回滚条件，并在发布前演练。

---

## 11. 定量目标（Quarter Targets）

> 以下目标用于“是否进入下一阶段”的硬门槛。若未达标，优先做优化迭代，不盲目扩量。

### 11.1 Free 侧目标
- 模式入口触达率：`>= 60%`
- 模式交互率（点击/查看）：`>= 25%`
- Free 首周留存：不低于当前基线，目标 `+5%` 相对提升

### 11.2 Pro 侧目标
- 模式切换渗透率（至少切换 1 次）：`>= 35%`
- 监控池表现查看率：`>= 30%`
- Pro 首周活跃率：`>= 65%`
- Pro 次月留存率：不低于当前基线，目标 `+8%` 相对提升

### 11.3 商业目标
- Free -> Pro 转化率（30D）：`>= 基线 +10%`（相对提升）
- 升级后 7D 退款率：不高于当前基线

---

## 12. 埋点与口径（Analytics Contract）

### 12.1 事件清单（必须）

| 事件名 | 触发时机 | 必填属性 |
|---|---|---|
| `mode_entry_exposed` | 用户看到模式入口/模式标识 | `user_tier`, `entry_surface`, `current_mode_id` |
| `mode_entry_clicked` | 用户点击模式入口 | `user_tier`, `entry_surface`, `current_mode_id` |
| `mode_panel_viewed` | 模式面板成功展示 | `user_tier`, `default_mode_id`, `available_modes` |
| `mode_switched` | 用户确认切换模式 | `from_mode`, `to_mode`, `user_tier`, `surface` |
| `mode_upgrade_prompt_exposed` | Free 用户看到 Pro 解锁提示 | `locked_feature`, `surface` |
| `mode_upgrade_prompt_clicked` | Free 用户点击升级提示 | `locked_feature`, `surface` |
| `mode_performance_viewed` | 用户查看表现数据 | `scope(universal/pool)`, `horizon`, `mode_id`, `user_tier` |
| `mode_decision_detail_viewed` | 用户查看决策依据明细 | `mode_id`, `symbol?`, `date_range`, `user_tier` |
| `mode_ledger_viewed` | 用户查看模拟交易台账 | `mode_id`, `horizon`, `page`, `user_tier` |

### 12.2 漏斗定义（统一口径）
1. `触达`：`mode_entry_exposed`
2. `交互`：`mode_entry_clicked` 或 `mode_panel_viewed`
3. `深度使用`：`mode_switched` 或 `mode_performance_viewed`
4. `升级意图`：`mode_upgrade_prompt_clicked`
5. `付费转化`：结算成功事件（按现有支付口径）

### 12.3 归因窗口
- 触达到升级点击：`7D`
- 触达到支付成功：`30D`
- 模式切换到 Pro 留存：`30D/60D`

---

## 13. 合规与文案红线（Copy Guardrails）

### 13.1 禁止词（不得出现）
- “稳赚”“保本”“稳定翻倍”“必赚”“零风险”

### 13.2 必显语句（必须出现）
- “历史表现不代表未来收益”
- “模式仅提供决策参考，不构成个股买卖建议”

### 13.3 升级提示约束
- 允许：强调“解锁更多视角/周期/监控池表现”
- 禁止：暗示“升级即可提高收益”或“升级即可避免亏损”

---

## 14. 失败预案（Rollback Runbook）

### 14.1 触发条件（任一满足即进入回滚流程）
- Dashboard / 投研决议错误率显著升高并持续。
- 模式切换后出现结论错配或历史回写。
- 转化率在观察窗口内显著下滑并持续。

### 14.2 响应时限（SLA）
- `T+5min`：值班工程师确认告警与影响范围。
- `T+15min`：产品与增长负责人共同判定是否回滚。
- `T+30min`：完成开关回退与流量切回基线方案。
- `T+24h`：提交事故复盘与修复计划。

### 14.3 回滚步骤（最小化）
1. 关闭模式相关实验开关（入口实验/文案实验）。
2. 强制回退为 `平衡模式` 显示与默认策略映射。
3. 暂停 Pro 解锁提示位，避免错误引导继续放大。
4. 验证核心路径：Dashboard、投研决议、监控池、个人中心。

### 14.4 责任人
- Incident Commander：值班后端负责人
- Product Owner：产品负责人
- Growth Owner：增长负责人
- Frontend Owner：前端负责人

---

## 15. 文档信息
- 文档版本：`v1.7`
- 更新日期：`2026-03-07`
- 维护：Product / Quant / Frontend / Backend

---

## 16. Backend 落地状态（2026-03-07）

本轮已完成（本地环境）：
- 后端数据结构：`user_investment_mode`、`mode_decision_log`、`mode_simulated_trade_ledger`、`mode_performance_snapshot`
- 预测落库扩展：`ai_predictions_v2.mode_id`（兼容补列）
- 后台产数管线：`prediction -> decision -> ledger -> snapshot`
- API：`GET/POST /api/user/mode`、`GET /api/modes`、`GET /api/modes/performance`、`GET /api/modes/performance/summary`、`GET /api/modes/performance/ledger`、`GET /api/modes/decisions`
- 审计字段：`job_id`、`rule_version`、`triggered_by` 已写入 mode 三层数据

发布记录：
- 已合并并发布到 `main`：`a941edf`
- 合并路径：`feat/spec47-mode-backend-api` -> `main`（fast-forward）

作业验证（本地等价 workflow 全量演练）：
- 已覆盖 `.github/workflows` 后端相关 job（sync / analyze / verify / brief / almanac / maintenance / tradeability / gate）
- 结果归档：`tmp/workflow_e2e/light_jobs_result.json`、`tmp/workflow_e2e/heavy_jobs_result.json`
- 结论：后端 job 可运行，Spec47 新增链路未发现回归

当前边界：
- 模式切换不回写历史结论，仅影响后续产数与表现聚合。
- `drilldown` 接口未纳入本轮，其余扩展接口已落地。

工程运行与排障参考：
- `docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`
