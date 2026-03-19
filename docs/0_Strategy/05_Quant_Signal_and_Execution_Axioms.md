# 05 量化信号验证与执行公理 (Quant Signal & Execution Axioms)

**日期**: 2026-03-18  
**状态**: Active / Level-2 Research  
**用途**: 统一 StockWise 对“预测准确性”的底层定义，解决“涨了又跌回位算不算对”的哲学争议。

---

## 1. 核心公理：进场信号与交易管理的分离

在 StockWise 的体系中，预测（Prediction）本质上是提供一个 **“进场信号 (Entry Signal)”**，而不是承诺一个 **“完美的终点收益”**。

### 公理 1：信号质量 (Signal Quality) vs. 交易管理 (Trade Management)
*   **信号质量 (Entry Timing)**：考察在发出建议后，市场是否如预期般出现了显著的盈利窗口。这是 AI 模型（形态识别）的功劳。
*   **交易管理 (Exit Discipline)**：考察在信号进入盈利区后，如何退出（止盈/止损）以保住利润。这是产品层逻辑或用户个人纪律的事情。

> [!IMPORTANT]
> **结论**：验证器（Validator）评估的是“信号质量”，而不是用户的“持仓管理”。

---

## 2. 核心指标：MFE (Maximum Favorable Excursion)

为了客观论证“信号是否抓得准”，StockWise 引入量化行业标准 **MFE（最大有利变动）** 作为验证引擎的第一驱动力。

### 定义
MFE 指的是自进场建议发出后，在设定的观察窗口（T+3）内，价格向原定预测方向运行的 **最大幅度**。

### 判定逻辑
*   如果 **MFE >= 阈值 (+2%)**：判定为 `Validated` (已验证)。
*   **依据**：市场确实在建议后给出了足够的脱离成本区的获利机会。如果之后价格跌落，证明“机会曾出现过”，AI 的形态识别是有效的。
*   **反证法**：如果不使用 MFE 而使用“窗口终点价”，那么一个抓住了 +10% 涨幅但用户未在最高点卖出的信号会被误判为“Incorrect”，这将导致 AI 模型向错误的方向过度优化。

---

## 3. 为什么“中途达标即算对”是严谨的？

### 3.1 捕捉“确定性机会”
量化研究倾向于捕捉 **“高胜率的爆发瞬间”**。一旦爆发（Triggered），信号的使命就已完成。后续的波动受更多不可控因素（如大盘环境变化、突发新闻）影响，不应反向否定入场点。

### 3.2 防止模型过拟合 (Anti-Overfitting)
如果要求 T+3 结尾必须盈利，AI 模型会试图去学习那些“涨了以后不回调”的极端样本。而在真实的股票市场中，大多数有效的爆发形态都伴随着回头确认。强行适配 T+3 结尾会导致模型变得过于保守（漏掉机会）或过于敏感（追高）。

---

## 4. 验证分层建议

为了更客观地记录表现，验证结果应保留两层：

1.  **语义验证 (Semantic Verdict)**：基于 MFE 判定建议动作（入场/防守）是否合理。
2.  **结果验证 (Outcome Verdict)**：记录最终该信号在 T+3 的持仓状态（Strong/Neutral/Weak/Adverse）。

**菲利华 (300395) 案例解析**：
*   语义验证：`Validated`（因为 MFE 达 4.17%）
*   结果验证：`Adverse`（因为窗口结束时累计为负）
*   **最终结论**：信号“对”但行情“走坏”，AI 的入场点选择无误。

---

## 4. 衍生公理：投资模式 (Investment Mode) 的职责

既然“验证”只负责信号，那么“持仓”由谁负责？在 StockWise 体系中，这是 **投资模式 (Investment Mode)** 的核心战场。

### 公理 4：信号负责“发牌”，模式负责“下注与收割”
*   **信号层 (Pattern Recognition)**：只负责从海量数据中识别出具有 MFE 潜力的爆发点。
*   **模式层 (Trade Management / Investment Mode)**：
    *   **稳健 (Steady)**：倾向于在 MFE 刚刚达标时（如 T+1）即锁定利润，或使用极其敏感的移动止损。
    *   **平衡 (Balanced)**：在 MFE 确认后，给价格留出更多波动空间（T+3），追求更高的盈亏比。
    *   **进取 (Aggressive)**：忍受更大的回撤，试图通过长窗口博取超额收益。

### 结论
一个“验证通过 (Correct)”的信号：
1.  在 **进取模式** 下可能最终因为持仓过久跌回止损而亏损。
2.  在 **稳健模式** 下可能已经盈利落袋。
**信号的对错是客观的 (MFE)，而交易的好坏是主观的 (Investment Mode)。**

---

## 5. 衍生公理：关键位 (Key Levels) 是信号与执行的桥梁

信号如果只给方向（Long/Short）而不给点位，是不完整的。在 StockWise 中，信号必须提供关键位作为执行锚点。

### 公理 5：关键位定义了“战术空间”
*   **支撑位 (Support)**：形态的“底线”。价格在此之上，信号活性保持；有效跌破此位，信号失效（Stop Loss）。
*   **压力位 (Pressure)**：形态的“天花板”。价格接近此位，盈利预期达成，是不同模式执行“减仓/止盈”参考点。
*   **止损位 (Stop)**：形态识别的“证伪点”。

### 结论
**信号负责提供“地图（支撑/压力）”，投资模式负责按照地图“行军（买入/卖出/持仓）”。** 
验证器在回测时，除了考核 MFE，也应参考信号给出的关键位是否起到了真实的支撑/阻力作用，这进一步决定了信号的“质量分”。

---

## 6. 衍生公理：信号是无状态的，执行是有状态的

最后，我们必须回答如何处理“持仓状态”与“入场成本”的问题。

### 公理 6：信号 (Signal) 是单向的，执行 (Action) 是环向的
*   **信号 (Stateless Signal)**：AI 只需要回答当前形态是否满足 `TriggeredLong` 或 `RiskOff`。它不关心用户手里有没有票。
*   **执行 (Stateful Execution)**：由 **投资模式层** 结合用户的“持仓上下文 (Position Context)”进行决策映射。

| 信号 (Signal) | 持仓上下文 | 最终动作 (Action) |
| :--- | :--- | :--- |
| `TriggeredLong` | 无持仓 | **开仓买入 (Open)** |
| `TriggeredLong` | 已有持仓 (浮盈) | **继续持有 / 加仓 (Hold/Pyramid)** |
| `RiskOff` | 已有持仓 (浮亏) | **止损离场 (Close)** |
| `RiskOff` | 无持仓 | **忽略 (Ignore)** |

### 结论
在量化理论中，我们通过 **状态机 (State Machine)** 来处理这个问题。StockWise 的 **Layer-2 (AI Tactics)** 已经针对不同持仓状态给出了分场景建议（如 `If holding` / `If not holding`）。这保证了系统既能保持形态识别的客观性，又能提供具备交易现实性的动作指导。

---

## 7. 行业权威依据与标准参考 (Industry Standards)

StockWise 的信号验证与执行分离方法，深度对齐了量化投资界的经典理论与现代机构实践：

### 7.1 John Sweeney 的 MFE/MAE 理论
*   **来源**：由 John Sweeney 在其著作 *《Maximum Adverse Excursion》* 中提出。
*   **核心贡献**：确立了 **Maximum Favorable Excursion (MFE)** 作为衡量“入场效率 (Entry Efficiency)”的唯一客观标准，将入场择时（信号层）与持场管理（执行层）从评估逻辑上彻底解耦。

### 7.2 Van Tharp 的“概率位”与“R 倍数”模型
*   **来源**：**Van Tharp** 博士在 *《Trade Your Way to Financial Freedom》* （通向财务自由之路）中详细阐述。
*   **核心贡献**：指出盈利的 90% 取决于 **“Position Sizing（头寸规模）”** 和 **“Exits（退出）”**，而 **“Setup（信号入场）”** 只占极小比例。这正是 StockWise 将“信号”与“投资模式（持仓策略）”分离的理论根基。

### 7.3 Alexander Elder 的“战术管理”
*   **来源**：**Alexander Elder** 博士（《以交易为生》作者）。
*   **核心贡献**：他强调 **“Trading Management”** 是一门独立的学科，要求交易者必须根据当前账户状态（Stateful Context）对同一行情做出不同决策，这是我们“投资模式”分层的实践模版。

### 7.4 机构级 FSM (有限状态机) 背景
*   **工程标准**：全球领先的量化执行引擎（如 **QuantConnect/Lean** 或机构 **FIX 协议** 柜台）均采用 **状态机 (Finite State Machines)** 来管理订单。信号被定义为“无状态的刺激 (Stimulus)”，而执行器则根据持仓数据库查询结果决定“刺激”应转化为哪种“状态转移（买/卖/跳过）”。

### 7.5 现代量化架构的解耦标准 (如 QuantConnect)
*   **LEAN 引擎模型**：
    *   **Alpha Model**：只负责产生“洞察 (Insight/Signal)”，对应 StockWise Layer-1。
    *   **Portfolio Construction Model**：负责决定“目标仓位 (Stateful Context)”。
    *   **Execution Model**：负责“具体价位执行 (Tactics)”。

---

## 8. 相关参考链接

*   [28Q 量化回测方法审计与行业对照](./28Q_Quant_Backtesting_Methodology.md) - 详见第 4.6 节“研究口径与生产口径”。
*   [四态语义验证规则](../5_Support_Ops/content/four-state-validation-rules.md) - 详见第 7 节的具体判定阈值。
*   **外部推荐阅读**：
    1. John Sweeney, *Maximum Adverse Excursion* (1997).
    2. Van Tharp, *Trade Your Way to Financial Freedom*.
    3. Alexander Elder, *Come Into My Trading Room*.
