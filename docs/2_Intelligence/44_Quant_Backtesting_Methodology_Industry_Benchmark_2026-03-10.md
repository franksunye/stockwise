# 44 量化回测方法行业对照研究

日期：2026-03-10  
状态：Current Research  
作者：Codex

## 1. 研究目的

回答一个容易被混淆、但必须单独拆开的核心问题：

1. StockWise 当前底层是否属于“量化回测驱动”的方法体系？
2. 这种方法与行业内机构量化、零售量化软件的常见做法相比，处在什么位置？
3. 我们当前方法是否足以支持“给普通投资者提供模式化操作建议”这一产品目标？
4. 如果要论证这条路线是对的，应该用什么标准，而不该用什么标准？

本文件的目标不是为当前做法背书，而是做一次客观定位。

---

## 2. 先给结论

### 2.1 简结论

StockWise 当前底层，确实属于量化回测驱动的规则优化体系。

但它**不是**机构级“寻找最强 alpha”的研究栈，也**不能**被表述为“已经接近行业最优量化方法”。

更准确的定位是：

1. 它是一套**规则化、可解释、日线级、产品导向**的量化研究框架。
2. 它在方法论上，和行业的常见流程有相似之处：
   - 历史回测
   - 参数校准
   - walk-forward / 多窗口观察
   - 生产观察与灰度切换
3. 但它在研究深度上，当前更接近：
   - 零售量化平台中偏严谨的一类
   - 或内部研究工具化的第一阶段
4. 它与机构量化的主要差距，不在“有没有回测”，而在：
   - 成本与成交建模
   - 容量与冲击分析
   - 多重检验 / 过拟合控制
   - universe / survivorship / point-in-time 数据治理
   - benchmark 与风险归因

### 2.2 更重要的结论

如果 StockWise 的产品目标仍然是“把复杂策略转成普通投资者可执行的模式与动作建议”，那么当前方向**可以成立**，但论证标准不能是：

- “我们是否找到了市场里最好的 alpha”

而应该是：

- “我们是否建立了一套足够稳健、可解释、可治理的规则回测方法，用来持续产出可信的模式建议”

这两个命题不是一回事。

---

## 3. 行业内的常见做法

## 3.1 机构量化的大行业做法

机构量化内部流派很多，但对“方法是否严谨”的共识点相当稳定，通常包括：

1. 明确区分研究样本、验证样本、上线样本
2. 不把单次回测净值最好看当成主要证据
3. 将交易成本、冲击、滑点、容量、借券约束等纳入现实性建模
4. 对多重检验、数据挖掘偏差、过拟合做显式控制
5. 尽量使用 point-in-time 数据、可复现 universe、统一 benchmark 与风险归因
6. 在生产上继续做 paper trading / shadow trading / live monitoring

### 外部依据

1. Bailey / López de Prado 等关于 backtest overfitting 的研究，核心论点是：在重复搜索与选择策略的过程中，历史最优结果极易是伪发现，必须显式处理多重检验与过拟合问题。  
2. Bailey 关于 Deflated Sharpe Ratio 的工作，本质上也是在提醒：单个 Sharpe 或单次回测结果不足以证明策略可靠。  
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
2. 提供参数优化、回测、walk-forward、paper trading 等能力
3. 在默认体验中，很少把容量、冲击、点时点数据、组合级风控建模做到机构级完整度

### 代表性产品的常见特点

1. QuantConnect
   - 提供 walk-forward optimization、slippage / fee / fill 等 reality modeling 模块
   - 说明零售/开发者平台也在向严谨研究靠拢
   - 但仍要求使用者自己定义合理目标函数与约束
2. Freqtrade
   - 提供 hyperopt、lookahead-analysis 等功能
   - 说明零售社区已经把“避免未来函数污染”单独工具化
3. Backtrader
   - 支持 commission、slippage、sizers、observers 等现实化组件
   - 但严谨程度很大程度取决于用户自己怎么配置
4. Composer
   - 前端产品表达更接近消费者
   - 回测体验强调简单和易理解，但研究现实度相对更轻，体现了零售产品的典型折中

### 对 StockWise 的启发

零售软件里较成熟的一类，一般至少会具备：

1. 参数优化
2. 基础成本建模
3. walk-forward 或 paper trading
4. anti-lookahead 工具或明确提醒

因此，只要我们自称“量化回测方法”，就不能只做到参数搜索和历史收益统计；至少要逐步补齐这些中位线能力。

---

## 4. StockWise 当前的真实做法

以下判断只基于当前仓库和本地数据库现状，不做理想化推断。

## 4.1 研究输入

截至 2026-03-10，本地 SQLite 底座为：

1. `daily_prices`: 288,647 行
2. 覆盖标的：579
3. 时间范围：2022-12-27 至 2026-03-09
4. 其中：
   - CN：464 个标的，235,482 行
   - HK：112 个标的，52,886 行
5. `quant_tradeability_signals`: 544,758 行
   - 覆盖 `tradeability_v1 / tradeability_v2`
   - 时间范围：2024-01-30 至 2026-03-06

结论：

1. 对 CN 来说，本地研究底座已经足够支撑中等强度的规则回测与参数筛选
2. 对 HK 来说，能做研究，但厚度明显弱于 CN
3. 对“模式绩效快照”来说，生产样本仍偏薄，不适合作为本次定参主依据

## 4.2 规则引擎与回测主循环

当前最核心的本地回测脚手架是：

- `backend/scripts/run_min_tradeability_loop.py`

它的特征非常明确：

1. 只使用日线数据
2. 核心条件是少量显式规则：
   - 收缩/盘整（VCP-like）
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
   - 简化的日度 MTM

### 代码证据

1. 信号条件定义：`backend/scripts/run_min_tradeability_loop.py`
2. 次日开盘进场：`entry_price = next day open else close`
3. 退出条件：止损 / 风险 MA / 持有期超时
4. 资金曲线：支持 fee 与持仓上限，但没有显式 bid-ask / market impact 模型

## 4.3 参数校准方式

当前参数校准主脚本：

- `backend/scripts/run_tradeability_weekly_calibration.py`

它的主要方法是：

1. 围绕预设步长做单参数、小步长搜索
2. 使用 3-window 聚合指标
3. 用启发式 guardrails 约束：
   - expectancy 必须为正
   - risk_off 不显著恶化
   - drawdown 不显著恶化
   - coverage 不回退

这是一个明显偏工程治理、而不是偏学术优化的框架。

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
3. 用 mode-specific objective weights 排序
4. 生成 release artifact
5. 再由发布脚本写入生产参数配置

这说明我们已经从“单策略参数搜索”过渡到了“模式层参数治理”。

但必须客观指出：

1. 这里的目标函数仍然是人工设计的启发式加权
2. 它不是机构常见的组合层最优化，也不是多目标 Pareto 前沿分析
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
2. 它把“本地研究结论”接到了“生产模式表现”

但这里也有明显限制：

1. `mode_performance_snapshot` 的 `max_drawdown` 目前来自已闭合交易的最差单笔 `pnl_pct`，不是标准组合净值路径回撤
2. `stability_score = hit_rate - abs(max_drawdown)` 也是启发式指标，不是行业标准
3. 因此，生产效果链可以做治理参考，但不能被表述成机构级绩效分析系统

---

## 5. 与行业做法的对照

## 5.1 我们已经做对的部分

### A. 没把“参数搜索”直接等同于“上线”

这点很重要。

我们已经开始区分：

1. 本地研究
2. artifact 产出
3. promotion / rollback / audit
4. 生产效果追踪

这比很多零售量化脚本“回测好看就改线上”更成熟。

### B. 回测对象是可解释规则，而不是黑盒模型

对 C 端产品来说，这是优势。

因为用户最终需要的是：

1. 为什么现在建议观察
2. 为什么切到防守
3. 为什么稳健和平衡不一样

如果底层不可解释，这个产品价值会断裂。

### C. 我们已经在做多窗口与生产观察

虽然还不够强，但至少方向是对的：

1. 不只看单窗口
2. 不只看单次最好结果
3. 不只看研究线，还看 mode pipeline 的正式表

### D. 研究目标和产品目标是一致的

这一点和很多“从量化研究硬翻译成产品”的项目不同。

我们的规则本身就是围绕：

1. 观察
2. 出手
3. 防守

这类动作语义构建的，而不是先做抽象 alpha 打分，再强行包装给用户。

---

## 5.2 我们明显弱于行业中位线的部分

### A. 还没有显式滑点与冲击建模

当前成本模型只包含手续费，没有显式：

1. bid-ask spread
2. 盘口冲击
3. 成交概率 / 部分成交
4. 容量约束

这意味着：

1. 当前回测结果更像“研究收益”，不是“真实可成交收益”
2. 对流动性差、波动大的标的，会系统性偏乐观

### B. 还没有正式的 lookahead-bias / data leakage 检查工具链

虽然当前日线逻辑看起来没有明显未来函数设计，但没有专门工具去验证“研究代码是否被未来数据污染”。

行业里这件事已经有明确工具化实践，例如 Freqtrade 的 lookahead-analysis。

### C. 多重检验控制不足

我们现在已经在做：

1. 多轮候选
2. 多窗口比较
3. 人工目标函数调整

但尚未把“试了多少轮、比较了多少候选、最终选择是否会因搜索而过拟合”做正式建模。

从 Bailey / López de Prado 的框架看，这是一个真实风险，而不是学术洁癖。

### D. universe 与 point-in-time 治理还不够完整

当前研究样本在不断扩样，但还没有把以下问题完全制度化：

1. research universe 是否完全版本化
2. 每轮回测是否严格使用 point-in-time 可得 universe
3. 是否存在 survivorship bias

这在研究结果看起来很好时，会成为解释软肋。

### E. benchmark 与风险归因不足

当前我们更多比较的是：

1. 候选 vs baseline
2. 模式之间
3. 局部指标变化

但还没系统回答：

1. 相比基准指数到底提升了什么
2. 收益来自 beta、行业暴露，还是规则本身
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
3. 都做样本外 / 多窗口验证
4. 都关注上线前的风险控制

### 关键差异

1. 机构量化的目标函数通常是：
   - alpha
   - 信息比率
   - 容量后净收益
   - 风险预算内最优配置
2. StockWise 当前的目标函数是：
   - 动作语义清晰
   - 模式分层稳定
   - 规则可解释
   - 用户结果链可治理

所以差异不只是包装，而是**研究目标本身不同**。

这也是为什么我们不该把自己表述为“正在用同样的方法和机构量化争夺最优 alpha”。

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

底层研究是否真的服务了“普通投资者操作建议”这一目标，而不是偷偷滑向“抽象 alpha 崇拜”。

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

1. 加入更现实的滑点、spread、容量后，结果是否仍可接受？
2. 研究收益是否大幅依赖“理想成交假设”？

### D. 过拟合控制

检验问题：

1. 本轮搜索尝试了多少候选？
2. 最终胜出是否只是搜索次数太多的产物？
3. 若换一个时间窗口，是否仍能选出近似方向的参数？

### E. 生产传导有效性

检验问题：

1. 本地 best 是否能改善线上 mode snapshot / ledger 的结果？
2. 是否只是研究线好看，但生产线不传导？

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

## 7.2 当前方法是否已经足够强，可以宣称“找到了最好 alpha”？

不能。

原因不是谦虚，而是方法上确实还没有达到那个结论门槛。

我们当前更适合说：

1. 已建立规则化、可解释、可回测的模式研究框架
2. 可用于持续改进稳健 / 平衡 / 进取三模式的参数
3. 可作为产品化决策建议系统的底层治理方法

但不适合说：

1. 已经找到市场上最优 alpha
2. 已达到机构级量化底层能力
3. 当前回测结果可直接外推为真实收益能力

## 7.3 当前最客观的定位

一句话定位：

StockWise 当前底层，是一套**面向 C 端决策产品的、可解释的规则回测与参数治理体系**。

它的严谨性已经高于“纯拍脑袋策略包装”，
但仍低于“机构级 alpha 研究平台”。

---

## 8. 下一阶段建议

## P0：必须补

1. 为 `run_min_tradeability_loop.py` 增加显式滑点 / spread 开关
2. 增加 anti-lookahead 检查脚本
3. 记录每轮候选搜索次数，形成最基本的 search audit
4. 把 research universe manifest 版本化并固化到回测 artifact

## P1：很重要

1. 为模式回测加入 benchmark 对照
2. 将 mode snapshot 的 drawdown 升级为真正的组合路径回撤
3. 区分 in-sample / validation / release window
4. 把 HK 底座继续加厚

## P2：进一步提高可信度

1. 引入更正式的 walk-forward / rolling retrain 纪律
2. 评估 Deflated Sharpe / PBO 一类的过拟合校正方法是否值得落地轻量版
3. 补充行业/风格暴露分析，减少“其实只是 beta 更强”的误判

---

## 9. 最终判断

### 可以成立的说法

1. 我们底层确实是量化回测驱动的
2. 我们正在围绕少量核心条件优化参数组合
3. 我们的方法在方向上接近行业中常见的“研究 -> 验证 -> 上线治理”框架
4. 但我们当前的真实定位，是产品导向的规则研究系统，不是机构级 alpha 工厂

### 不应使用的说法

1. “我们已经通过量化找到最优 alpha”
2. “我们和行业头部底层本质一样，只是包装不同”
3. “当前回测结果已经足以证明真实收益最优”

### 最稳妥的对外/对内统一口径

StockWise 的底层不是在做机构式大规模 alpha 挖掘，
而是在用可解释的量化规则和历史回测，持续校准适合普通投资者的操作模式。

这条路线当前是成立的，但其正确性应以“模式建议的稳定性、可解释性、现实可成交性与生产传导效果”来证明，而不是以“是否找到了行业最强 alpha”来证明。

---

## 10. 参考资料

### 学术 / 研究

1. Bailey, Borwein, López de Prado, Zhu. *The Probability of Backtest Overfitting*  
   https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2326253
2. Bailey, López de Prado. *The Deflated Sharpe Ratio*  
   https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf
3. Carr, López de Prado. *Determining Optimal Trading Rules without Backtesting*  
   https://arxiv.org/abs/1408.1159

### 机构 / 行业资料

4. AQR, transaction cost related research hub  
   https://www.aqr.com/insights/research/white-papers/transactions-costs-practical-application
5. BlackRock systematic investing overview  
   https://www.blackrock.com/us/individual/investment-ideas/systematic-investing
6. MSCI factor investing resource center  
   https://www.msci.com/data-and-analytics/factor-investing

### 零售量化 / 开发者平台

7. QuantConnect walk-forward optimization docs  
   https://www.quantconnect.com/docs/v2/writing-algorithms/optimization/walk-forward-optimization
8. QuantConnect slippage / reality modeling docs  
   https://www.quantconnect.com/docs/v2/writing-algorithms/reality-modeling/slippage/supported-models
9. Freqtrade hyperopt docs  
   https://www.freqtrade.io/en/stable/hyperopt/
10. Freqtrade lookahead-analysis docs  
    https://www.freqtrade.io/en/stable/lookahead-analysis/
11. Backtrader slippage docs  
    https://www.backtrader.com/docu/slippage/slippage/
12. Composer backtest basics  
    https://help.composer.trade/article/67-backtest-basics

### 本仓库对应实现

13. `backend/scripts/run_min_tradeability_loop.py`
14. `backend/scripts/run_tradeability_weekly_calibration.py`
15. `backend/scripts/build_mode_params_release.py`
16. `backend/analysis/mode_pipeline.py`
