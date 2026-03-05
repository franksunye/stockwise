# 统一研究报告：量化 + AI 的可交易化框架（融合版）

**文档状态**: Draft  
**日期**: 2026-03-05  
**作者**: Codex  
**关联文档**: `25_Side_Trap_and_Opportunity_Capture_Framework.md`, `27_Acceptance_Criteria_v1.md`

---

## 0. 研究目标（统一口径）

我们不是要“更守纪律”，而是要让系统在风险可控前提下**敢于交易、且能持续交易**：

1. 如何捕捉上涨（短期/中期/长期）  
2. 如何规避下跌（止损/止盈，短期/中期/长期）

---

## 1. 外部研究结论：LLM 与量化的边界

### 1.1 LLM 在金融中的不足是客观存在的

1. 幻觉与金融场景不匹配问题明确存在。  
2. 财务数值推理仍是难点，不同模型性能差异极大。  
3. 金融任务跨语言、跨任务泛化仍不稳定。  

支持证据（文献）：

- **Deficiency of LLMs in Finance (2023)**：明确提出金融任务中的 hallucination 问题。  
- **FinanceReasoning (ACL 2025)**：在更难的金融数值推理任务上，即使强模型也并非满分，说明“能说”不等于“能算对”。  
- **KnowledgeMath/FinanceMath**：最佳模型准确率与人类专家有显著差距，显示知识密集 + 表格推理仍是瓶颈。  
- **FinBen (NeurIPS 2024 D&B)**：覆盖风险管理、预测、决策等任务后，结论是模型优势与局限并存，且基准本身也有数据规模/泛化限制。

### 1.2 LLM 不是没价值，而是价值点要放对位置

在“文本信息解析（新闻、公告语义）”上，LLM 有可用信号价值；  
在“严格数值推理/执行纪律”上，不能裸奔，必须由量化约束。  

支持证据：

- **Lopez-Lira & Tang (2024 版本稿)**：基于新闻文本，复杂模型比基础模型更有预测力；但这并不代表可直接替代量化执行层。

### 1.3 纯量化也有陷阱：因子有效不等于策略可交易

1. 趋势/动量长期有效有大量证据，但会有 crash 与回撤。  
2. 风险管理（波动率管理、止损）在特定条件下有效，但不当使用会被交易成本反噬。  
3. 回测很容易被数据挖掘污染。  

支持证据：

- **Time Series Momentum (JFE 2012)**：跨资产存在时间序列动量迹象。  
- **A Century of Evidence (JPM 2017)**：长样本趋势跟随显示长期一致性，但并非无回撤。  
- **Momentum Crashes (NBER 2014)**：动量存在可预见的崩塌状态（高波动 + 市场反弹）。  
- **Volatility-Managed Portfolios (NBER/JF)**：波动率管理可提升风险收益比。  
- **Stop-Loss Rules (JFinM 2014, 2017)**：止损不是总有效，过紧止损在现实交易成本下会劣化。  
- **Data-Snooping (Lo & MacKinlay)** 与 **Deflated Sharpe Ratio (Bailey & López de Prado)**：强调多重试验后的虚假优效风险。

### 1.4 研究共识：最佳路径是“混合分工”，不是“二选一”

可执行分工应是：

1. 量化引擎：负责触发、风控、仓位和退出（硬约束）  
2. LLM：负责文本增量信息、情境解释、战术表达（软增益）  

---

## 2. 落地回答（短/中/长期）

以下方案全部可先基于现有日线字段启动：`change_percent, volume, ma5/10/20/60, rsi, macd_hist, boll, high/low/close`。

### 2.1 捕捉上涨（Entry）

#### A. 短期（1-10 交易日）

目标：抓“异动启动”和“二段延续”。

执行框架（融合后的主模板）：

1. **Setup 筛选**：动量 + 结构 + 量能共振。  
2. **Trigger 触发**：突破触发或回踩确认触发（二选一）。  
3. **无触发不交易**：Setup 不是入场指令。  

为什么：短线失败往往不是方向错，而是时点错与赔率差。

可执行量化定义（仅用现有字段）：

1. `VCP-like` 收缩：近 5 日平均振幅收缩（可用 `(high-low)/close` 代理）  
2. 放量突破：`volume > 1.5 * avg(volume,5)`  
3. 结构确认：`close > ma10` 且 `close > ma20`  
4. 动量确认：`change_percent > 5` 或 `macd_hist` 连续修复  

说明：这里保留了 Gemini 文档中有效的“VCP + 量价突破”思想，但移除了盘中主动买盘等当前不可得字段。

#### B. 中期（1-3 个月）

目标：抓趋势延续而非单日脉冲。

执行框架：

1. 趋势过滤：`ma20 > ma60` 且 `close >= ma20`。  
2. 动能确认：`macd_hist` 修复/扩张，`rsi` 处于可持续区间。  
3. 分批建仓：回踩确认加仓，避免一次性梭哈。

为什么：中期收益来自“持续暴露于趋势”，不是猜顶底。

#### C. 长期（3 个月以上）

目标：抓大级别行情，控制大回撤。

执行框架（现阶段可执行版）：

1. 市场状态过滤（风险开关）先于个股信号。  
2. 低频再平衡 + 波动率目标控制。  
3. 允许慢触发、重仓位纪律，不追求高换手。

说明：`MA120/MA250`、估值与股息等字段暂不纳入主规则，放入“后续扩展”。

为什么：长期收益核心是持有质量与回撤控制，不是交易频次。

---

### 2.2 规避下跌（Exit）

#### A. 短期

1. 失效止损：触发条件被破坏即出。  
2. 跟踪止盈：冲高后按结构上移止盈，不用“盈利回吐到亏损”。  
3. 禁止极紧止损：避免被噪声反复洗出（文献已证明过紧 stop 可能劣化表现）。

#### B. 中期

1. 趋势反转止盈：均线关系破坏 + 动能背离共同触发。  
2. 波动率上升降杠杆：不是全平仓，而是减风险暴露。  
3. 保护利润优先于追最后一段。

#### C. 长期

1. 组合级 drawdown 限额触发风控。  
2. 波动率目标与风险预算约束（仓位是第一风控）。  
3. 在系统性风险阶段，先保生存再谈收益。

---

## 3. 系统化建议：从“信号分类”改为“交易状态机”

当前问题是把复杂市场压成 `Long/Side/Short` 三分类，导致“有机会但未触发”和“无机会”都被混成 `Side`。

建议状态机：

1. `NoSetup`：无优势，继续等待  
2. `Watch`：有机会，但未触发  
3. `TriggeredLong`：触发入场  
4. `Exit/RiskOff`：退出或防守

这样用户会收到**可执行状态**，而不是“情绪标签”。

---

## 4. 建议的模型架构（量化主决策，LLM 做增量）

1. **Layer-1 Quant（硬门）**：  
   产出 `setup_score / trigger / stop / take_profit / position_size`。

2. **Layer-2 LLM（软门）**：  
   只在 Quant 给出 `Watch` 或 `TriggeredLong` 时介入，做：
   - 新闻与公告语义打分  
   - 反方论证  
   - 战术解释文案  

3. **Layer-3 Risk Overlay（组合层）**：  
   波动率目标、回撤预算、连败降杠杆。

---

## 5. 研究与上线方法（避免“改了很多，效果不明”）

1. 先修评估闭环（标签与验证逻辑）。  
2. 滚动时间窗验证（Walk-forward），禁止全样本一次性调参。  
3. 报告必须同时给：
   - 收益（CAGR）  
   - 风险（MDD, 波动率）  
   - 交易效率（胜率、盈亏比、换手、成本后收益）  
4. 对每次策略变更做 DSR/PBO 风格检验，抑制回测幻觉。

---

## 6. 融合结论（取其精华，去其糟粕）

本次融合原则：

1. 保留 Gemini 的交易直觉因子：`VCP-like 收缩`、`放量突破`、`分周期 Entry/Exit`。  
2. 剔除当前不可实现或不可回测字段：盘口主动买盘、估值/股息、未入库长周期字段。  
3. 所有保留内容必须转成“可计算阈值 + 可验证指标 + 可回测流程”。

---

## 7. 对“纪律与交易机会”的平衡结论

你的观点是对的：**只有纪律、没有触发机制，系统会“永远正确但永远不交易”。**  

正确目标是：

1. 用纪律保证“不该做的不做”。  
2. 用状态机与触发器保证“该做的时候做”。  
3. 用仓位与退出机制保证“做错了能活，做对了能放大”。

---

## 8. 参考文献与来源（本次独立研究）

1. FinBen (NeurIPS 2024 Datasets & Benchmarks): https://proceedings.neurips.cc/paper_files/paper/2024/file/adb1d9fa8be4576d28703b396b82ba1b-Paper-Datasets_and_Benchmarks_Track.pdf  
2. FinanceReasoning (ACL 2025): https://aclanthology.org/2025.acl-long.766.pdf  
3. Deficiency of LLMs in Finance (arXiv 2311.15548): https://arxiv.org/abs/2311.15548  
4. Survey of FinLLMs (arXiv 2402.02315): https://arxiv.org/abs/2402.02315  
5. KnowledgeMath / FinanceMath (arXiv 2311.09797): https://ar5iv.org/pdf/2311.09797  
6. Can ChatGPT Forecast Stock Price Movements? (UF working paper version 2024): https://anderson.ucla.edu/sites/default/files/document/2024-04/4.19.24%20Alejandro%20Lopez%20Lira%20ChatGPT_V3.pdf  
7. Time Series Momentum (JFE 2012): https://pages.stern.nyu.edu/~lpederse/papers/TimeSeriesMomentum.pdf  
8. A Century of Evidence on Trend-Following Investing (JPM 2017 PDF): https://www.aqr.com/-/media/AQR/Documents/Insights/Journal-Article/AQR-JPM-Fall-2017.pdf  
9. Momentum Crashes (NBER w20439): https://www.nber.org/papers/w20439.pdf  
10. Volatility Managed Portfolios (NBER w22208): https://www.nber.org/papers/w22208  
11. When do stop-loss rules stop losses? (JFinM 2014): https://www.sciencedirect.com/science/article/pii/S138641811300030X  
12. Stop-loss with serial correlation/regime switching/costs (JFinM 2017): https://www.sciencedirect.com/science/article/pii/S1386418117300472  
13. Data-Snooping Biases (NBER w3001): https://www.nber.org/papers/w3001  
14. Deflated Sharpe Ratio (Bailey & López de Prado): https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf  
15. Jegadeesh & Titman 1993: https://www.bauer.uh.edu/rsusmel/phd/jegadeesh-titman93.pdf  
16. Lehmann 1990 (QJE abstract page): https://academic.oup.com/qje/article/105/1/1/1928416  
17. Time series momentum: Is it there? (JFE 2020): https://www.sciencedirect.com/science/article/pii/S0304405X19301953

---

## 9. 最新研究补充（2025-2026，新增）

以下为相对更新且与“可交易化”直接相关的成果（重点保留可工程化启示）：

### 9.1 金融 LLM/Agent 基准从“问答”升级到“流程与执行”

1. **Finance Agent Benchmark (2025-05, arXiv:2508.00828)**  
   537 个专家题、9 类任务，带工具（Google Search + EDGAR）评估；最佳模型也仅约 `46.8%` 准确率，且有显著调用成本。  
   启示：我们的系统不能把“LLM能回答问题”直接等价为“可稳定交易执行”。  

2. **FinGAIA (2025-07, arXiv:2507.17186)**  
   407 个端到端金融任务（证券/基金/银行/保险等），最佳 agent 仍显著落后金融专家。  
   启示：多工具、多步骤场景下，流程一致性与术语/流程理解仍是主要短板。  

3. **FinSearchComp (2025-09, arXiv:2509.13160)**  
   首个开放的“金融搜索+推理”端到端基准，三类贴近分析师工作流任务、635 题、70 名金融专家参与标注。  
   启示：金融 AI 的瓶颈正在从“静态知识”转向“时效检索 + 推理链完整性”。  

### 9.2 可信与合规成为主战场（不再只是准确率）

1. **FINTRUST (EMNLP 2025 Main)**  
   15,680 样本，覆盖 Truthfulness/Safety/Fairness/Robustness/Privacy/Transparency/Knowledge Discovery 七维信任评估。  
   关键发现：即便领先模型，在受托责任与冲突披露等任务仍存在明显不足。  
   启示：风控与合规输出必须独立于“方向预测分数”，单独做硬约束。

2. **CNFinBench (v4, 2026-02, arXiv:2512.09506)**  
   引入 29 个子任务与 HICS 指标（多轮安全退化评估）；报告显示从单模块到全链路会出现明显性能下滑。  
   启示：我们需要对 `Watch -> TriggeredLong -> Exit` 做链路级评估，而不是单点准确率。

### 9.3 评测设计本身被重新定义：防“看穿未来”与防“执行不稳定”

1. **Look-Ahead-Bench (2026-01, arXiv:2601.13770)**  
   专门评估金融 LLM 的 look-ahead bias（时点信息泄漏）与 alpha decay。  
   启示：我们的回测必须强化 point-in-time 数据纪律，避免任何未来信息穿透。

2. **AlphaForgeBench (2026-02, arXiv:2602.18481)**  
   指出 LLM 直接输出交易动作存在高方差和序列不稳定，提出“让 LLM 产出可执行 alpha 因子/策略，再由确定性执行层交易”。  
   启示：这与我们“量化硬门 + LLM软门”的架构方向一致，应继续强化“LLM 不直接下单”原则。

3. **FIRE (2026-02, arXiv:2602.22273)**  
   同时评估金融理论能力与业务场景能力（含 3,000 场景题），强调“考试分数不等于业务可用性”。  
   启示：我们的验证指标需从单一命中率扩展到“可执行性 + 稳定性 + 风险后收益”。

### 9.4 对 StockWise 的新增落地要求（基于最新研究）

在原有路线基础上新增四条硬要求：

1. **PiT 数据门禁**：回测与推理时强制 point-in-time 快照，记录可审计的数据可见性边界。  
2. **链路级评估**：分别统计 `Setup 识别率`、`Trigger 触发率`、`Exit 执行率`、`全链路胜率/盈亏比`。  
3. **稳定性评估**：同一输入多次推理，监控 action variance；超过阈值则降级为 `Watch` 而非 `TriggeredLong`。  
4. **成本敏感指标**：新增“每次有效触发成本”“成本后期望收益”，避免高调用成本吞噬 alpha。

### 9.5 更新结论（相对旧版研究的变化）

最新文献强化了三个事实：

1. **LLM 在金融里“能解释”不代表“能执行”**，尤其是多轮与工具链场景。  
2. **最关键风险已从单步准确率转向链路稳定性与时间泄漏**。  
3. **正确架构是：LLM 负责研究与因子表达，量化执行层负责确定性触发与风控。**

这与本报告主结论一致，但现在证据更强、方向更明确：  
StockWise 下一阶段应优先建设“可审计、可复现、可成本核算”的交易决策流水线。

---

## 10. 新增参考（2025-2026）

1. Finance Agent Benchmark (arXiv 2508.00828): https://arxiv.org/abs/2508.00828  
2. BizFinBench (arXiv 2505.19457): https://arxiv.org/abs/2505.19457  
3. XFinBench (ACL Findings 2025): https://aclanthology.org/2025.findings-acl.457/  
4. FINTRUST (EMNLP 2025): https://aclanthology.org/2025.emnlp-main.512.pdf  
5. FinGAIA (arXiv 2507.17186): https://arxiv.org/abs/2507.17186  
6. FinSearchComp (arXiv 2509.13160): https://arxiv.org/abs/2509.13160  
7. FinMaster (arXiv 2505.13533): https://arxiv.org/abs/2505.13533  
8. FinMTEB (arXiv 2502.10990): https://arxiv.org/abs/2502.10990  
9. CNFinBench (arXiv 2512.09506): https://arxiv.org/abs/2512.09506  
10. Look-Ahead-Bench (arXiv 2601.13770): https://arxiv.org/abs/2601.13770  
11. AlphaForgeBench (arXiv 2602.18481): https://arxiv.org/abs/2602.18481  
12. FIRE (arXiv 2602.22273): https://arxiv.org/abs/2602.22273  
13. TIME-MOE (ICLR 2025): https://proceedings.iclr.cc/paper_files/paper/2025/file/558d48c1f08675daa636e09bfe94a89e-Paper-Conference.pdf  
14. Specialized Foundation Models Struggle to Beat Supervised Baselines (ICLR 2025): https://proceedings.iclr.cc/paper_files/paper/2025/file/ffa1301939cc707d6e986e6c4124340b-Paper-Conference.pdf  
15. Towards Neural Scaling Laws for Time Series Foundation Models (ICLR 2025): https://proceedings.iclr.cc/paper_files/paper/2025/file/d04e47d0fdca09e898885c66b67b1e95-Paper-Conference.pdf
