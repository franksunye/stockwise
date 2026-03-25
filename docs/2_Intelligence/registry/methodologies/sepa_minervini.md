---
id: methodology_sepa_minervini
name: SEPA & VCP
type: methodology
status: baseline
fit_for_stockwise: high
recommended_home: research_baseline
archetype: trend_breakout
---

# SEPA & VCP (Minervini Methodology)

## 1. SEPA 核心构成 (Specific Entry Point Analysis)

- **S - Selection (Stage 2)**：只在二阶段上涨趋势中操作。
- **E - Earnings**：基本面爆发，寻找加速增长的 EPS、营收和毛利。
- **P - Price**：价格走势需符合“趋势模板”，相对强度（RS）通常 > 70/80。
- **A - Action / Announcement**：在最紧缩的价格行为处（Pivot）或利好催化剂出现时行动。

## 2. VCP 结构要求 (Volatility Contraction Pattern)

- **波动冷缩**：价格经历多轮回撤（T1, T2, T3...），回撤幅度应递减（如 25% -> 12% -> 6% -> 3%）。
- **成交量枯竭**：在每一个收缩阶段的最右侧，成交量应萎缩至历史极低位，暗示卖压干涸。
- **Pivot (枢轴位)**：收缩平台上的一个明确突破点，是交易者的“开火点”。

## 3. 买入准则 (Specific Entry Point)

- **Pocket Pivot**：在形态内部，价格伴随巨大成交量上涨，且不破坏现有形态。
- **Low Risk Entry**：止损点距离入场点极近（通常 2-5%），提供极高的盈亏比。

## 4. 在 ZISO 的映射

- **Layer-1 状态**：`Watch` 阶段对应 VCP 的收缩观察；`TriggeredLong` 对应枢轴位突破。
- **超参数控制**：系统通过 `T_count`、`V_contraction_ratio` 等参数自动化判定形态。
