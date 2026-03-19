# 44 量化回测方法审计与行业对照

日期：2026-03-10  
状态：Current Audit  
作者：Codex

## 1. 研究目的

本文件只解决一件事：

**从方法论审计角度，客观判断 StockWise 当前“量化回测与参数治理”体系的真实水平。**

它回答的是一个容易被混淆、但必须单独拆开的核心问题：

1. StockWise 当前底层是否属于“量化回测驱动”的方法体系？
2. 这种方法与行业内机构量化、零售量化软件的常见做法相比，处在什么位置？
3. 我们当前方法是否足以支持“给普通投资者提供模式化操作建议”这一产品目标？
4. 如果要论证这条路线是对的，应该用什么标准，而不该用什么标准？

本文件的目标不是为当前做法背书，而是做一次客观定位与证据校对。

说明：

1. 如果你要看“行业大地图 / 我们是谁 / 我们该去哪里”，主文档应看：
   - `../0_Strategy/06_Quant_Industry_Positioning_Map.md`
2. 本文件不再承担完整战略世界观说明，只承担：
   - 当前方法审计
   - 行业方法学对照
   - 对现阶段路线是否成立的判断

---

## 2. 先给结论

### 2.1 简结论

StockWise 当前底层，确实属于量化回测驱动的规则优化体系。

但它**不是**机构级“寻找最强 alpha（超额收益）”的研究栈，也**不能**被表述为“已经接近行业最优量化方法”。

更准确的定位是：

1. 它是一套**规则化、可解释、日线级、产品导向**的量化研究框架。
2. 它在方法论上，和行业的常见流程有相似之处：
   - 历史回测
   - 参数校准
   - 3-window 时间切片稳定性检查 / 多窗口观察
   - 生产观察与灰度切换
3. 但它在研究深度上，当前更接近：
   - 零售量化平台中偏严谨的一类
   - 或内部研究工具化的第一阶段
4. 它与机构量化的主要差距，不在“有没有回测”，而在：
   - 成本与成交建模
   - 容量与冲击分析
   - 多重检验 / 过拟合控制
   - universe（研究股票池） / survivorship（幸存者偏差） / point-in-time（时点可得）数据治理
   - benchmark（基准）与风险归因

### 2.2 更重要的结论

如果 StockWise 的产品目标仍然是“把复杂策略转成普通投资者可执行的模式与动作建议”，那么当前方向**可以成立**，但论证标准不能是：

- “我们是否找到了市场里最好的 alpha（超额收益）”

而应该是：

- “我们是否建立了一套足够稳健、可解释、可治理的规则回测方法，用来持续产出可信的模式建议”

这两个命题不是一回事。

### 2.3 宏观定位说明

从顶层战略上看，StockWise 当前应归入：

- **L2 级规则化量化研究系统**

但这一定义的完整行业地图、道法术器分析与未来路线，已迁移到：

- `../0_Strategy/06_Quant_Industry_Positioning_Map.md`

本文件后续只保留和“当前方法是否严谨”直接相关的判断。

> [!IMPORTANT]
> **判定准则补充**：关于“信号判定正确”的底层量化公理（如 MFE 与 Stateful Execution 的分离），已固化在：[05 量化信号验证与执行公理](../0_Strategy/05_Quant_Signal_and_Execution_Axioms.md)。

---

## 3. 行业内的常见做法

## 3.1 机构量化的大行业做法

机构量化内部流派很多，但对“方法是否严谨”的共识点相当稳定，通常包括：

1. 明确区分研究样本、验证样本、上线样本
2. 不把单次回测净值最好看当成主要证据
3. 将交易成本、冲击、滑点、容量、借券约束等纳入现实性建模
4. 对多重检验、数据挖掘偏差、过拟合做显式控制
5. 尽量使用 point-in-time（时点可得）数据、可复现 universe（研究股票池）、统一 benchmark（基准）与风险归因
6. 在生产上继续做 paper trading（模拟交易） / shadow trading（影子交易） / live monitoring（实时监控）

### 外部依据

1. Bailey / López de Prado 等关于 backtest overfitting（回测过拟合）的研究，核心论点是：在重复搜索与选择策略的过程中，历史最优结果极易是伪发现，必须显式处理多重检验与过拟合问题。  
2. Bailey 关于 Deflated Sharpe Ratio（折减夏普比率）的工作，本质上也是在提醒：单个 Sharpe（夏普比率）或单次回测结果不足以证明策略可靠。  
3. AQR 等系统化投资机构长期强调：交易成本不是后处理装饰项，而是策略研究本体的一部分。  
4. MSCI / BlackRock 这类系统化投资材料的共同点，是把因子、容量、换手、风险暴露、数据治理放在同一张研究图谱里，而不是只看收益曲线。

### 对 StockWise 的启发

机构量化真正重视的，不只是“能不能回测”，而是：

1. 这个结果是否经得起样本外和交易现实
2. 这个结果是否仍然能活在真实市场约束里
3. 研究流程是否能说明它不是被搜索出来的假象

---

## 3.2 零售量化软件的常见做法

零售量化软件并不都“很弱”，但通常会做三类取舍：

1. 强调易用性，弱化机构级数据与执行细节
2. 提供参数优化、回测、多窗口验证或 formal walk-forward（正式滚动前推验证）、paper trading（模拟交易）等能力
3. 在默认体验中，很少把容量、冲击、point-in-time（时点可得）数据、组合级风控建模做到机构级完整度

### 代表性产品的常见特点

1. QuantConnect
   - 提供 walk-forward optimization（滚动前推优化）、slippage（滑点） / fee（费用） / fill（成交撮合）等 reality modeling（现实成交建模）模块
   - 说明零售/开发者平台也在向严谨研究靠拢
   - 但仍要求使用者自己定义合理目标函数与约束
2. Freqtrade
   - 提供 hyperopt（超参数搜索）、lookahead-analysis（未来函数检测）等功能
   - 说明零售社区已经把“避免未来函数污染”单独工具化
3. Backtrader
   - 支持 commission（手续费）、slippage（滑点）、sizers（仓位分配器）、observers（观察器）等现实化组件
   - 但严谨程度很大程度取决于用户自己怎么配置
4. Composer
   - 前端产品表达更接近消费者
   - 回测体验强调简单和易理解，但研究现实度相对更轻，体现了零售产品的典型折中

### 对 StockWise 的启发

零售软件里较成熟的一类，一般至少会具备：

1. 参数优化
2. 基础成本建模
3. formal walk-forward（正式滚动前推验证）或 paper trading（模拟交易）
4. anti-lookahead（防未来函数）工具或明确提醒

因此，只要我们自称“量化回测方法”，就不能只做到参数搜索和历史收益统计；至少要逐步补齐这些中位线能力。

---

## 4. StockWise 当前的真实做法

以下判断只基于当前仓库和本地数据库现状，不做理想化推断。

## 4.1 研究输入

截至 2026-03-10，本地 SQLite 底座为：

1. `daily_prices`: 320,167 行
2. 覆盖标的：655
3. 时间范围：2022-12-27 至 2026-03-10
4. 其中：
   - 若按 `stock_meta` 可分类股票计：CN 464 个标的，235,482 行；HK 188 个标的，84,406 行
   - 另有 3 个未归入 `stock_meta` 市场分类的指数/辅助序列：`510300 / sh000001 / sh000300`
5. `quant_tradeability_signals`: 605,120 行
   - 覆盖 `tradeability_v1 / tradeability_v2`
   - 时间范围：2024-01-02 至 2026-03-06
   - 其中 CN：463 个标的，451,200 行；HK：187 个标的，153,920 行

结论：

1. 对 CN 来说，本地研究底座已经足够支撑中等强度的规则回测与参数筛选
2. 对 HK 来说，底座已经明显补厚，能够支撑模式分层和成本版本地 best，但横截面厚度仍弱于 CN
3. 对“模式绩效快照”来说，生产样本仍偏薄，不适合作为本次定参主依据

## 4.2 规则引擎与回测主循环

当前最核心的本地回测脚手架是：

- `backend/scripts/run_min_tradeability_loop.py`

它的特征非常明确：

1. 只使用日线数据
2. 核心条件是少量显式规则：
   - 收缩/盘整（VCP-like，类似波动收缩形态）
   - 放量突破
   - 强收盘
   - 动量
   - 风险否决（MA）
3. 触发后按下一日 `open` 进场，后续按：
   - 止损
   - 风险 MA 失守
   - 超时持有
   进行退出
4. 资金曲线支持：
   - 手续费 `fee_bps_each_side`
   - 最大持仓数 `max_positions`
   - 简化的日度 MTM（盯市估值）
   - 显式 `spread_bps / slippage_bps`
   - `fixed / liquidity_bucketed` 两种执行成本口径

### 代码证据

1. 信号条件定义：`backend/scripts/run_min_tradeability_loop.py`
2. 次日开盘进场：`entry_price = next day open else close`
3. 退出条件：止损 / 风险 MA / 持有期超时
4. 资金曲线：已支持 fee（费用）与显式 spread/slippage（价差/滑点）建模，并新增按市场与近 20 日成交额分桶的 `liquidity_bucketed` 成本口径，但仍没有显式 market impact（市场冲击） / partial fill（部分成交） / 容量约束模型

## 4.3 参数校准方式

当前参数校准主脚本：

- `backend/scripts/run_tradeability_weekly_calibration.py`

它的主要方法是：

1. 围绕预设步长做单参数、小步长搜索
2. 使用 3-window 时间切片聚合指标
3. 用启发式 guardrails 约束：
   - expectancy 必须为正
   - risk_off 不显著恶化
   - drawdown 不显著恶化
   - coverage 不回退

这是一个明显偏工程治理、而不是偏学术优化的框架。

需要特别说明：

这里更准确的说法是“3-window stability check（3 窗口稳定性检查）”，而不是严格意义上的 rolling walk-forward（滚动前推训练/验证/发布纪律）。

优点：

1. 可解释
2. 不容易失控
3. 对生产参数治理友好

缺点：

1. 搜索空间窄
2. 缺乏对多重检验次数的正式记录
3. consistency 指标当前是代理量，不是完整现实指标

## 4.4 模式参数包的本地 best 流程

当前新增的模式参数流程：

- `backend/scripts/build_mode_params_release.py`
- `backend/scripts/promote_mode_params_release.py`

其逻辑是：

1. 给 `steady / balanced / aggressive` 分别提供候选参数
2. 用同一回测引擎逐一跑候选
3. 用 mode-specific objective weights（模式专属目标权重）排序
4. 生成 release artifact（发布产物）
5. 再由发布脚本写入生产参数配置

当前这条链路相比文档初稿又前进了一步：

1. release artifact 已不只是参数，还会携带 `research_performance`、`selection_summary`、`production_effect`
2. 正式配置文件已按市场沉淀 `market_release_artifacts`
3. 也就是说，当前生产配置里已经能够同时保存 CN / HK 两套模式发布物，而不是只有裸参数

这说明我们已经从“单策略参数搜索”过渡到了“模式层参数治理”。

但必须客观指出：

1. 这里的目标函数仍然是人工设计的启发式加权
2. 它不是机构常见的组合层最优化，也不是多目标 Pareto（帕累托）前沿分析
3. 它更像“产品化参数治理器”

## 4.5 生产效果链

当前正式模式绩效链在：

- `backend/analysis/mode_pipeline.py`

它会产出：

1. `mode_decision_log`
2. `mode_simulated_trade_ledger`
3. `mode_performance_snapshot`

这条链路的重要价值不在于它有多高级，而在于：

1. 它让参数研究和用户结果之间存在可追踪映射
2. 它把“本地研究结论”接到了“生产模式表现观察”
3. 同时，模式发布物本身现在也能带上“研究绩效摘要”，作为模式对象的一部分进入线上配置

但这里也有明显限制：

1. `mode_performance_snapshot` 的 `max_drawdown` 目前来自已闭合交易的最差单笔 `pnl_pct`（盈亏百分比），不是标准组合净值路径回撤
2. `stability_score = hit_rate - abs(max_drawdown)` 也是启发式指标，不是行业标准
3. 因此，生产效果链可以做治理参考，但不能被表述成机构级绩效分析系统
4. 虽然现在已经有 `backfill_mode_performance.py` 用于批量重建生产绩效，但它本质上仍是生产口径刷新工具，不等于机构级实时绩效归因系统

## 4.6 研究口径与生产口径必须分开理解

这是本次审计里最需要单独说明的一点。

当前仓库中，“研究回测”和“生产模式绩效”不是同一个经济对象。

### 研究回测口径

研究主循环 `run_min_tradeability_loop.py` 的核心假设是：

1. 规则触发后，按**下一日开盘**进场
2. 之后按：
   - 止损
   - 风险 MA 失守
   - 持有期超时
   退出
3. 结果中包含：
   - 单笔收益
   - 资金曲线
   - 简化组合回撤

### 生产模式绩效口径

生产链 `mode_pipeline.py` 的核心假设是：

1. 从 `ai_predictions_v2` 的主记录出发
2. 按 `date -> target_date` 的生产预测窗口生成模拟台账
3. 以生产表为基础生成 mode snapshot（模式快照）

### 这意味着什么

1. 生产链可以证明：
   - 参数/模式是否在用户结果链中留下了可观测痕迹
2. 生产链**不能直接证明**：
   - 研究回测里的那套持仓经济学已经被线上一比一验证
3. 因此，“生产传导有效性”应被理解为：
   - 研究结论是否对生产口径产生了改善信号
   - 而不是研究回测收益曲线被线上逐笔复现

如果不把这两套口径分开，最容易产生两种误判：

1. 把生产快照误当成研究回测的 live validation（线上逐笔验证）
2. 把研究回测结果误当成真实用户可成交收益

---

## 5. 与行业做法的对照

## 5.1 我们已经做对的部分

### A. 没把“参数搜索”直接等同于“上线”

这点很重要。

我们已经开始区分：

1. 本地研究
2. artifact（产物）产出
3. promotion（发布） / rollback（回滚） / audit（审计）
4. 生产效果追踪

这比很多零售量化脚本“回测好看就改线上”更成熟。

### B. 回测对象是可解释规则，而不是黑盒模型

对 C 端产品来说，这是优势。

因为用户最终需要的是：

1. 为什么现在建议观察
2. 为什么切到防守
3. 为什么稳健和平衡不一样

如果底层不可解释，这个产品价值会断裂。

### C. 我们已经在做多窗口稳定性检查与生产观察

虽然还不够强，但至少方向是对的：

1. 不只看单窗口
2. 不只看单次最好结果
3. 不只看研究线，还看 mode pipeline 的正式表
4. 参数上线后，已经支持用脚本批量 backfill（回刷）生产模式绩效，而不是只能等待线上自然累积

### D. 研究目标和产品目标是一致的

这一点和很多“从量化研究硬翻译成产品”的项目不同。

我们的规则本身就是围绕：

1. 观察
2. 出手
3. 防守

这类动作语义构建的，而不是先做抽象 alpha（超额收益）打分，再强行包装给用户。

---

## 5.2 我们明显弱于行业中位线的部分

### A. 还没有显式滑点与冲击建模

这条判断需要按当前状态修订。

当前成本模型已经不再只包含手续费，而是已经加入了两层显式现实成交建模：

1. 固定 `spread_bps / slippage_bps`
2. 按市场与流动性分桶的 `liquidity_bucketed` 成本口径

但仍然没有显式：

1. 盘口冲击
2. fill probability（成交概率） / partial fill（部分成交）
3. 容量约束
4. 基于真实成交反馈校准的成本曲线

这意味着：

1. 当前回测结果已经比初稿时更接近“研究可成交收益”，但仍不是“真实可成交收益”
2. 对流动性差、波动大的标的，乐观偏差已经被部分压缩，但尚未彻底消除

### B. 还没有正式的 lookahead-bias（前视偏差） / data leakage（数据泄漏）检查工具链

虽然当前日线逻辑看起来没有明显未来函数设计，但没有专门工具去验证“研究代码是否被未来数据污染”。

行业里这件事已经有明确工具化实践，例如 Freqtrade 的 lookahead-analysis（未来函数检测）。

### C. 多重检验控制不足

我们现在已经在做：

1. 多轮候选
2. 多窗口比较
3. 人工目标函数调整

但尚未把“试了多少轮、比较了多少候选、最终选择是否会因搜索而过拟合”做正式建模。

从 Bailey / López de Prado 的框架看，这是一个真实风险，而不是学术洁癖。

### D. universe（研究股票池）与 point-in-time（时点可得）治理还不够完整

当前研究样本在不断扩样，但还没有把以下问题完全制度化：

1. research universe（研究股票池）是否完全版本化
2. 每轮回测是否严格使用 point-in-time（时点可得）可得 universe（研究股票池）
3. 是否存在 survivorship bias（幸存者偏差）

这在研究结果看起来很好时，会成为解释软肋。

### E. benchmark（基准）与风险归因不足

当前我们更多比较的是：

1. 候选 vs baseline
2. 模式之间
3. 局部指标变化

但还没系统回答：

1. 相比基准指数到底提升了什么
2. 收益来自 beta（市场暴露）、行业暴露，还是规则本身
3. 回撤改善来自少交易，还是规则质量更高

### F. 生产绩效指标仍偏启发式

当前 `mode_performance_snapshot` 的指标足以支持产品治理，但不足以支持“行业级绩效论证”。

不能把这套指标包装成比它实际能力更强的东西。

---

## 5.3 我们和行业“不是只有包装不同”

如果说“和行业做法本质一样，只是包装不同”，这句话并不准确。

### 相似之处

1. 都使用历史回测
2. 都做参数选择
3. 都重视样本外 / 多窗口验证
4. 都关注上线前的风险控制

### 关键差异

1. 机构量化的目标函数通常是：
   - alpha（超额收益）
   - 信息比率
   - 容量后净收益
   - 风险预算内最优配置
2. StockWise 当前的目标函数是：
   - 动作语义清晰
   - 模式分层稳定
   - 规则可解释
   - 用户结果链可治理

所以差异不只是包装，而是**研究目标本身不同**。

这也是为什么我们不该把自己表述为“正在用同样的方法和机构量化争夺最优 alpha（超额收益）”。

---

## 6. 我们应该如何论证“方法是对的”

## 6.1 不应该用的论证方式

以下论证都不够严谨：

1. “历史回测跑出来最好，所以方法对”
2. “行业也做回测，所以我们这套也对”
3. “最终用户看到的是模式，所以底层是否严谨不重要”
4. “只要收益更高，就说明底层方法合理”

这些论证要么偷换目标，要么忽略过拟合和现实成交问题。

## 6.2 更合适的论证方式

要证明 StockWise 当前方向成立，应该使用下面这组标准：

### A. 产品目标一致性

底层研究是否真的服务了“普通投资者操作建议”这一目标，而不是偷偷滑向“抽象 alpha（超额收益）崇拜”。

检验问题：

1. 模式之间是否有稳定分层？
2. 分层是否能翻译成用户能理解的动作语言？
3. 参数变化是否仍能保持这种语义一致性？

### B. 规则稳定性

检验问题：

1. 是否跨窗口仍然保留同方向结果？
2. 是否在不同市场阶段下不完全失真？
3. 是否依赖极少数年份或极少数标的才能成立？

### C. 现实可成交性

检验问题：

1. 加入更现实的滑点、spread（价差）、容量后，结果是否仍可接受？
2. 研究收益是否大幅依赖“理想成交假设”？

### D. 过拟合控制

检验问题：

1. 本轮搜索尝试了多少候选？
2. 最终胜出是否只是搜索次数太多的产物？
3. 若换一个时间窗口，是否仍能选出近似方向的参数？

### E. 生产传导有效性

检验问题：

1. 本地 best（最优方案）是否能改善线上 mode snapshot（模式快照） / ledger（交易台账）的结果？
2. 是否只是研究线好看，但生产口径没有改善信号？
3. 研究口径与生产口径之间的差异，是否已被清晰记录，而不是被混用？

只有这五类问题同时站得住，才能说“这套方法对我们是对的”。

---

## 7. 针对当前现状的客观判断

## 7.1 当前方法是否错误？

不是。

它不是错误方向，而是**阶段性合理但尚不完整**。

如果当前目标是：

1. 先建立可解释的规则层
2. 先建立模式产品层
3. 先让本地研究与生产治理形成闭环

那么这条路是成立的。

## 7.2 当前方法是否已经足够强，可以宣称“找到了最好 alpha（超额收益）”？

不能。

原因不是谦虚，而是方法上确实还没有达到那个结论门槛。

我们当前更适合说：

1. 已建立规则化、可解释、可回测的模式研究框架
2. 可用于持续改进稳健 / 平衡 / 进取三模式的参数
3. 可作为产品化决策建议系统的底层治理方法

但不适合说：

1. 已经找到市场上最优 alpha（超额收益）
2. 已达到机构级量化底层能力
3. 当前回测结果可直接外推为真实收益能力

## 7.3 当前最客观的定位

一句话定位：

StockWise 当前底层，是一套**面向 C 端决策产品的、可解释的规则回测与参数治理体系**。

它的严谨性已经高于“纯拍脑袋策略包装”，
但仍低于“机构级 alpha（超额收益）研究平台”。

---

## 8. 下一阶段建议

## P0：必须补

1. 增加 anti-lookahead（防未来函数）检查脚本
2. 记录每轮候选搜索次数，形成最基本的 search audit（搜索审计）
3. 把 research universe manifest（研究股票池清单）版本化并固化到回测 artifact（回测产物）
4. 将当前 `liquidity_bucketed` 成本口径继续向“生产可校准”的成本模型推进，而不是长期停留在启发式分桶
5. 明确研究回测口径与生产模式绩效口径的差异，避免对内对外混用

## P1：很重要

1. 为模式回测加入 benchmark（基准）对照
2. 将 mode snapshot（模式快照）的 drawdown（回撤）升级为真正的组合路径回撤
3. 区分 in-sample（样本内） / validation（验证期） / release window（发布窗口）
4. 把 HK 底座继续加厚，并在更厚底座上复核当前 HK best 的稳定性

## P2：进一步提高可信度

1. 在现有 3-window stability check 之外，引入更正式的 walk-forward（滚动前推验证） / rolling retrain（滚动重训练）纪律
2. 评估 Deflated Sharpe（折减夏普比率） / PBO（回测过拟合概率）一类的过拟合校正方法是否值得落地轻量版
3. 补充行业/风格暴露分析，减少“其实只是 beta（市场暴露）更强”的误判

## P3：未来战略扩展 (Strategic Vision)

从当前的规则化研究向更高维度进化：

1.  **纵向深度：风险归因与 Alpha 纯化**
    *   不仅回答“赚了多少”，还要回答“这钱是靠大盘涨（Beta）赚的，还是靠我们由于规则带来的超额（Alpha）赚的”。
2.  **横向广度：从“单票”到“组合” (Portfolio Construction)**
    *   目前是单票打分，未来扩展到“篮子”优化建议。基于相关性和波动率，告知用户如何配置不同模式下的持仓比例，以获得最优夏普比。
3.  **维度升阶：AI 代理化策略工厂 (Agentic Quant)**
    *   从人写规则 AI 解释，进化为 AI 懂规则、AI 做实验、AI 推荐回测产物，形成完全闭环的量化策略自动寻优工厂。

---

## 9. 最终判断

### 可以成立的说法

1. 我们底层确实是量化回测驱动的
2. 我们正在围绕少量核心条件优化参数组合
3. 我们的方法在方向上接近行业中常见的“研究 -> 验证 -> 上线治理”框架
4. 但我们当前的真实定位，是产品导向的规则研究系统，不是机构级 alpha（超额收益）工厂

### 不应使用的说法

1. “我们已经通过量化找到最优 alpha（超额收益）”
2. “我们和行业头部底层本质一样，只是包装不同”
3. “当前回测结果已经足以证明真实收益最优”

### 最稳妥的对外/对内统一口径

StockWise 的底层不是在做机构式大规模 alpha（超额收益）挖掘，
而是在用可解释的量化规则和历史回测，持续校准适合普通投资者的操作模式。

这条路线当前是成立的，但其正确性应以“模式建议的稳定性、可解释性、现实可成交性与生产传导效果”来证明，而不是以“是否找到了行业最强 alpha（超额收益）”来证明。

同时必须明确：

- `生产传导效果` 不等于 `研究回测收益曲线的线上逐笔复现`
- `mode snapshot / ledger` 当前是生产观察口径，不是严格意义上的 live shadow PnL

---

## 10. 名词解释

1. `alpha`：通常指相对基准的超额收益，不等同于“总收益更高”。
2. `benchmark`：用来对照策略表现的基准，例如指数或参考组合。
3. `beta`：策略或组合对整体市场波动的暴露程度。
4. `walk-forward`：按时间向前滚动做训练、验证和观察，避免只在单一历史区间里优化。当前 StockWise 已实现的是 3-window stability check，不等于完整 walk-forward。
5. `rolling retrain`：随着时间推进，按固定节奏重新训练或重新校准参数。
6. `in-sample / validation / release window`：分别指样本内、验证期、正式发布评估窗口。
7. `point-in-time data`：只使用当时真实可获得的数据，避免把事后才知道的信息带回历史。
8. `survivorship bias`：只看存活到今天的标的，忽略已经退市或被淘汰样本带来的偏差。
9. `paper trading`：不真金白银下单，只按真实市场节奏模拟交易。
10. `shadow trading`：生产环境里并行记录一套策略结果，但不真正影响用户或资金。
11. `live monitoring`：策略上线后持续监控产数、风险、绩效和异常。
12. `slippage`：理想成交价和真实成交价之间的偏差。
13. `spread` 或 `bid-ask spread`：买一价和卖一价之间的差距，是天然交易摩擦。
14. `market impact`：下单行为本身对市场价格产生的冲击。
15. `fill / partial fill`：订单是否成交，以及是否只成交了一部分。
16. `backtest overfitting`：通过反复试参数或试策略，把历史偶然性误当成真实规律。
17. `Deflated Sharpe Ratio`：在多次尝试、多策略比较背景下，对夏普比率做折减校正的方法。
18. `PBO`：Probability of Backtest Overfitting，回测过拟合概率。
19. `lookahead-bias / data leakage`：回测中错误使用了未来信息或不该提前知道的数据。
20. `anti-lookahead`：专门用于检查和防止未来函数污染的约束或工具。
21. `hyperopt`：超参数搜索，用系统化方式寻找更合适的参数组合。
22. `Pareto front`：多目标优化里，一组互不完全支配的折中解集合。
23. `artifact / release artifact`：研究或发布流程产出的结构化结果文件，例如参数包、候选排序、研究绩效摘要。
24. `search audit`：对一次参数搜索试了多少候选、怎么筛选、最终怎么选中的审计记录。
25. `mode snapshot / ledger`：前者指模式绩效快照，后者指模式交易台账。

---

## 11. 参考资料

### 学术 / 研究

1. Bailey, Borwein, López de Prado, Zhu. *The Probability of Backtest Overfitting*（回测过拟合的概率）  
   https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2326253
2. Bailey, López de Prado. *The Deflated Sharpe Ratio*（折减夏普比率）  
   https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf
3. Carr, López de Prado. *Determining Optimal Trading Rules without Backtesting*（不依赖回测确定最优交易规则）  
   https://arxiv.org/abs/1408.1159

### 机构 / 行业资料

4. AQR, transaction cost related research hub（交易成本研究专题）  
   https://www.aqr.com/insights/research/white-papers/transactions-costs-practical-application
5. BlackRock systematic investing overview（系统化投资概览）  
   https://www.blackrock.com/us/individual/investment-ideas/systematic-investing
6. MSCI factor investing resource center（因子投资资源中心）  
   https://www.msci.com/data-and-analytics/factor-investing

### 零售量化 / 开发者平台

7. QuantConnect walk-forward optimization docs（滚动前推优化文档）  
   https://www.quantconnect.com/docs/v2/writing-algorithms/optimization/walk-forward-optimization
8. QuantConnect slippage / reality modeling docs（滑点 / 现实成交建模文档）  
   https://www.quantconnect.com/docs/v2/writing-algorithms/reality-modeling/slippage/supported-models
9. Freqtrade hyperopt docs（超参数搜索文档）  
   https://www.freqtrade.io/en/stable/hyperopt/
10. Freqtrade lookahead-analysis docs（未来函数检测文档）  
    https://www.freqtrade.io/en/stable/lookahead-analysis/
11. Backtrader slippage docs（滑点文档）  
    https://www.backtrader.com/docu/slippage/slippage/
12. Composer backtest basics（回测基础说明）  
    https://help.composer.trade/article/67-backtest-basics

### 本仓库对应实现

13. `backend/scripts/run_min_tradeability_loop.py`
14. `backend/scripts/run_tradeability_weekly_calibration.py`
15. `backend/scripts/build_mode_params_release.py`
16. `backend/analysis/mode_pipeline.py`
