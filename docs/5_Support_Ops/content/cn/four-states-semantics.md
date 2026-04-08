---
title: "动作语义：进场、观察、防守、暂无信号"
category: "量化逻辑与纪律"
lastUpdated: "2026-03-09"
source_docs:
  - docs/3_Product/Specs/40_Quant_AI_Dual_Layer_UX.md
funnel_stage: "BOFU"
date: "2026-03-19"
publish:
  wechat:
    status: "none"
---

我们将复杂的量化状态机 (Layer-1) 输出，转化为了四个极简的交易动作指令：

- **建议看多** (TriggeredLong)：标的走势已触发系统最优狙击标准，此时操作具有较强的数学支持。
- **建议观察** (Watch)：标的正处于震荡或等待突破的形态中，暂未满足进场条件，不盲目出手。
- **建议防守** (RiskOff)：盘面已出现资金出逃或趋势破坏迹象，优先回收仓位，严格控制风险。
- **暂无信号** (NoSetup)：标的无明显波动或处于持续弱势通道，不建议进行任何操作，场外休息。

这一切的设计都是为了让你从“猜涨跌”的内耗中解脱出来，进入“按预案执行”的专业交易状态。
