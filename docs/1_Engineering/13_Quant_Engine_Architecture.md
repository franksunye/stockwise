# 知守 AI (ZISO AI) 量化引擎架构规划 (QuantEngine Architecture)

**文档状态**: Draft  
**日期**: 2026-03-06  
**作者**: Gemini & Frank Sun  
**关联文档**: `10_Architecture.md`, `../2_Intelligence/archive/40_Gemini_Quant_AI_Two_Layer_Refactoring_Plan.md`

---

## 1. 定位与目标

在 知守 AI (ZISO AI) 最新的系统分层中，**量化引擎（QuantEngine）被正式剥离并确立为量化模型的工程实现层**。
它负责把数据、规则、参数与状态机收敛为结构化结论，为规则侧分析师与分析模型提供统一事实底座。

本架构规划旨在为 `QuantEngine` 制定长期的演进蓝图，确保其具备**高扩展性（插件化）、抗冲突性（多策略调度）和可审计性**，以从容应对未来数百个策略因子同时运行的复杂场景。

---

## 2. 核心设计模式

为了避免将上百个策略揉碎成难以维护的“面条代码 (Spaghetti Code)”，QuantEngine 将采用 **“插件化策略 + 选举调度器 (Plugin Strategies & Ensemble Orchestrator)”** 设计模式。

*   **基类派生 (Interface-based)**：强制所有具体策略实现统一的接口规范，解耦策略开发与框架调度。
*   **信号聚合 (Ensemble Voting)**：引入最高仲裁机制，处理不同时间窗口、不同逻辑策略间的“多空打架”问题。
*   **状态机收敛 (State Machine)**：所有底层的复杂信号（如 KDJ超卖、均线金叉、巨量异动）最终必须向业务层收敛为 4 个极简的执行状态。

---

## 3. 架构拓扑 (Architecture Blueprint)

```mermaid
flowchart TD
    DATA[行情数据上下文<br/>Daily/Weekly/Monthly Prices]
    
    subgraph QuantEngine [Layer-1: 量化引擎 (Quant Engine)]
        direction TB
        
        subgraph Strategies [策略插件池 (Strategy Plugins)]
            S1(VCP 突破策略<br/>Weight: 0.4)
            S2(MACD 动能策略<br/>Weight: 0.3)
            S3(MA 趋势追踪<br/>Weight: 0.3)
            S4(ATR 止损防守<br/>Type: Veto/一票否决)
        end
        
        DATA --> S1 & S2 & S3 & S4
        
        ORCH{信号聚合调度器<br/>Ensemble Orchestrator}
        
        S1 & S2 & S3 & S4 -->|产出基础 Signal & 分数| ORCH
        
        ORCH -->|综合计票/熔断判决| STATE[输出终局状态机<br/>Final State]
    end
    
    LLM[分析模型层<br/>DeepSeek / Hunyuan]
    
    STATE -->|量化模型结论输入| LLM
```

---

## 4. 商业边界：用户分层与策略分发 (User Tiers & Strategy Distribution)

QuantEngine 的“选单式策略”架构拥有对核心商业模式（Free vs. PRO）进行分层收敛的天生能力。前端之所以能够保持 UI/UX 不变，完全是因为底层引擎在此处做了数据的差异化装配。

### 4.1 免费用户 (Free Tier)：标准经典套餐
- **服务组合**：`林序（辅助分析） + 程矩（规则分析） + 沈策（量化工程底座）`
- **策略边界**：仅运行系统锁定的**几个基础经典策略**（如：基础均线趋势、经典超买超卖）。
- **用户权限**：固定配置，无法增加、修改参数或自选新策略。保障基础的“防暴雷”与“明趋势”服务，降低算力与推演成本。

### 4.2 付费用户 (PRO Tier)：全武器库自选
- **服务组合**：`顾深（深度分析） + 程矩（规则分析） + 沈策（量化工程底座）`
- **策略边界**：解锁引擎内的**所有高级/前沿策略**（如：VCP 微观突破、资金流共振因子）。
- **用户权限**：用户可以在设置中心“勾选自己偏好的策略”，甚至微调参数（如将均线从 20 调整为 10）。引擎在合并信号时，会严格听从该用户的专属策略池与权重配比，生成高度个性化的量化雷达与 LLM 推演。

---

## 5. 关键组件规约 (Component Specification)

### 4.1 统一策略接口 (`BaseStrategy`)
所有进入武器库的策略必须继承此接口。它保障了输入输出的绝对标准化：
*   **Input**: 全局数据上下文 `context` (包含日线级、周线级数据、大盘状态等)。
*   **Output**: 必须返回标准化的评级 `Signal` (区间如 -1 到 1，代表极度看空到极度看多) 和 `confidence`。

### 4.2 信号聚合调度器 (`EnsembleOrchestrator`)
充当量化议会的“议长”，负责汇总所有被激活策略的选票，并作出唯一裁决。
*   **权重加权机制 (Weighted Voting)**：不同策略具有基础权重（如动量策略在牛市权重提升，趋势策略在震荡市权重降低）。
*   **熔断与红线指令 (Veto Power)**：特定种类的策略（如检测到暴跌破位、大盘系统性风险）拥有特权，一旦触发 `RiskOff`，直接无视其他攻击型策略的 `Long` 信号，强制系统进入防守状态。

### 4.3 标准指令状态机 (Output State Machine)
无论底层运行了 10 个还是 100 个策略，`QuantEngine` 对外（向 Layer-2 LLM 和前端）暴露的状态永远只有 4 种，以切断复杂度的外溢：
1.  **`NoSetup`**：毫无波澜，查无战机（平躺）。
2.  **`Watch`**：指标异动共振严重，处于临界点（雷达高频扫描）。
3.  **`TriggeredLong`**：多头规则满足，量价齐升，确认开火买入。
4.  **`RiskOff`**：防守红线被击穿，禁止买入或立刻无脑清仓。

---

## 6. 务实的演进路线图 (Evolution Roadmap)

过度设计是工程的大敌。我们将按照业务价值驱动的漏斗，分阶段建设整个兵器库：

### Phase 1: 骨架与“核弹”策略 (当前 v1 目标)
**目标**：打通双层解耦链路，不搞投票，只写“一招鲜”策略。
*   在 `QuantEngine` 内硬编码 **1 个最强的攻击策略**（如：VCP 收敛后的放量突破）和 **1 个最刚的防守策略**（如：跌破前低止损）。
*   重点验证 `Runner -> QuantEngine -> LLM (Prompt 注入)` 的流水线是否能顺利生产出高质量的战报。

### Phase 2: 插件化重构 (v2 目标)
**目标**：当策略数量超过 3 个且开始互相矛盾时介入。
*   抽象出 `BaseStrategy`。
*   将之前的硬编码内容拆分为子类文件（如 `strategies/breakout.py`, `strategies/moving_average.py`）。
*   开发最初版的 `EnsembleOrchestrator`（简单平均加权 + 一票否决机制）。

### Phase 3: 因子回测与动态插拔 (v3 愿景)
**目标**：实现准工业级的量化研究基建。
*   引入本地/云端回测框架，新策略上线前必须跑通历史收益率对账卡。
*   实现无宕机的策略热插拔与动态权重调节（即根据实时大盘环境，动态赋予“动量策略”或“价值策略”更高的决策权重）。

---

## 7. 技术栈生态与“不造轮子”原则 (Best Practices)

在从“自己手写计算器”到“构建完备量化雷达”的演进中，**极力避免重复造轮子**是第一工程法则。针对 2025/2026 前沿的 Python 量化开源生态，QuantEngine 的底层能力应逐步向以下最佳实践借力：

### 6.1 技术指标计算层 (Indicator Layer)
*   **当前痛点**：手写移动平均、MACD、ATR 或极值判断，容易引发 Edge Case 且计算效率低下。
*   **最佳实践引入**：全面引入 `pandas-ta` 或 `TA-Lib`。
    *   *说明*：无需再自己写繁琐的 `df['close'].rolling(20).mean()`，通过标准化库调用，确保技术指标的计算与华尔街机构精度一致。

### 6.2 高性能向量化回测与分析层 (Backtesting & Analysis)
*   **当前痛点**：Python 原生的 `for` 循环遍历 K 线极度缓慢，难以支撑多并发策略的回测对账。
*   **最佳实践引入**：引入 `VectorBT` 或 `backtesting.py`。
    *   *VectorBT*：在未来需要进行海量参数调优（Grid Search）时，凭借底层 NumPy 的编译级速度，能将执行时间从几小时缩短到几秒。
    *   *backtesting.py*：轻量级且自带精美交互图表，非常适合作为新策略（如 VCP、破位止损）的快速验证和回测可视化脚手架。

### 6.3 核心调度的边界 (Buy vs. Build)
*   **我们应该自己写什么 (Build)**：调度逻辑（`EnsembleOrchestrator`）、状态机的收敛、LLM 提示词工厂、以及结合大 A 股特殊制度的打分权重。这是 知守 AI (ZISO AI) 的核心护城河。
*   **我们绝不该写什么 (Buy/Integrate)**：K 线对齐代码、滑点与交易费率模拟计算、底层 MACD/RSI 源码公式。这些脏活累活，全权交由成熟的顶级开源库接管。
