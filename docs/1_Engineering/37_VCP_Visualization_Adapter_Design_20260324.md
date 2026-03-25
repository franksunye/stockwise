---
title: "37 VCP Visualization Adapter Design 20260324"
doc_id: "engineering-vcp-visualization-adapter-design-20260324"
doc_domain: "engineering"
doc_status: "draft"
owner: "founder"
last_reviewed_at: "2026-03-24"
summary: "定义 VCP 可视化适配层的字段契约、几何算法口径、API 形态与 POC 重构拆分，用于将 Layer-1 四状态解释图真正建立在真实股票数据之上。"
---

# 37 VCP Visualization Adapter Design 20260324

更新时间：2026-03-24  
状态：Draft  
定位：`Spec 50` 的工程落地配套文档

关联文档：

- [`50_VCP_Visualization_Transparency_Spec.md`](/Users/yesun/Code/stockwise/docs/3_Product/Specs/50_VCP_Visualization_Transparency_Spec.md)
- [`15_Layer1_Indicator_and_Param_Governance.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/15_Layer1_Indicator_and_Param_Governance.md)
- [`22_ai_predictions_v2_Data_Dictionary.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/22_ai_predictions_v2_Data_Dictionary.md)
- [`30_Stock_Data_Layers_And_API_Boundaries_20260316.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/30_Stock_Data_Layers_And_API_Boundaries_20260316.md)
- [`layer1_state.py`](/Users/yesun/Code/stockwise/backend/engine/layer1_state.py)
- [`index.html`](/Users/yesun/Code/stockwise/poc/shen-ce-vcp/index.html)

## 1. 目标

本设计文档只解决一个问题：

> 如何把当前 Layer-1 的四状态结果，转换成前端可稳定消费、可审计、可画图的 VCP 可视化 payload。

它不负责：

- 重写交易规则
- 改写四状态语义
- 决定最终页面长什么样

它负责：

1. 明确适配层应该存在
2. 明确适配层输出什么字段
3. 明确 swing / hull / pivot / risk line 的算法口径
4. 明确 POC 如何从概念图升级为数据驱动图

## 2. Why an Adapter Layer Must Exist

当前 `layer1_payload` 已经足够支持调试，但不适合直接前台消费，原因有三：

1. 字段命名偏规则审计，不偏可视化语义
2. payload 缺少几何骨架字段
3. 前端如果直接读取内部调试字段，会和规则实现强耦合

因此建议新增一层：

- `layer1_visualization_adapter`

推荐职责：

1. 输入 `daily_history`
2. 输入 `Layer1Snapshot`
3. 输出 `Layer1VisualizationPayload`

## 3. Placement

推荐放置位置：

- `backend/engine/layer1_visualization.py`

推荐暴露函数：

```python
def build_layer1_visualization_payload(
    symbol: str,
    daily_history: Sequence[Dict[str, Any]],
    snapshot: Layer1Snapshot,
) -> Dict[str, Any]:
    ...
```

后续如需拆分，可拆为：

- `detect_visual_swings`
- `build_contractions`
- `fit_visual_hulls`
- `derive_pivot_and_risk_line`
- `serialize_visualization_payload`

## 4. Input Contract

适配层输入最小要求：

### 4.1 `daily_history`

至少包含：

- `date`
- `open`
- `high`
- `low`
- `close`
- `volume`

最低历史长度建议：

- `>= 40 bars`

原因：

- 当前 Layer-1 判定最低只要求 21 bars
- 但可视化要看收缩结构，21 bars 往往不足以讲清“前因”

### 4.2 `snapshot`

至少读取：

- `setup_state`
- `opportunity_score`
- `trigger_rule_hit`
- `risk_off_hit`
- `strategy_version`
- `payload`

尤其是 `payload` 中的：

- `amp5`
- `amp20`
- `prev_vol5`
- `cond_vcp_like`
- `cond_breakout`
- `cond_breakout_soft`
- `cond_strong_close`
- `cond_momentum`
- `cond_momentum_recovery`
- `watch`
- `trigger`
- `risk_off`

## 5. Output Contract

推荐前台使用如下统一结构：

```ts
type Layer1VisualizationPayload = {
  symbol: string;
  asOfDate: string;
  setupState: 'NoSetup' | 'Watch' | 'TriggeredLong' | 'RiskOff';
  opportunityScore: number;
  strategyVersion: string;
  bars: VisualBar[];
  volumeBars: VisualVolumeBar[];
  swings: VisualSwing[];
  contractions: VisualContraction[];
  upperHull: VisualPoint[];
  lowerHull: VisualPoint[];
  pivot: VisualPivot | null;
  breakoutBar: VisualBreakoutBar | null;
  riskLine: VisualRiskLine | null;
  annotations: VisualAnnotation[];
  explanation: {
    reasonCodes: string[];
    metrics: Record<string, number | string | boolean>;
  };
};
```

### 5.1 Required Fields

- `symbol`
- `asOfDate`
- `setupState`
- `bars`
- `volumeBars`
- `reasonCodes`

### 5.2 Nice-to-Have Fields

- `swings`
- `contractions`
- `upperHull`
- `lowerHull`
- `pivot`
- `breakoutBar`
- `riskLine`
- `annotations`

## 6. Geometry Definitions

### 6.1 Swing Definition

建议先使用保守、可解释的 swing 定义，而不是复杂 ZigZag：

- `swingHigh`：
  - `high[i]` 高于前后各 `n` 根 bar 的高点
- `swingLow`：
  - `low[i]` 低于前后各 `n` 根 bar 的低点

建议默认：

- `n = 2`

说明：

- 该口径足够简单，便于调试和解释
- 后续若噪音过多，可升级到 ATR 过滤版 ZigZag

推荐输出结构：

```json
{
  "date": "2026-03-10",
  "index": 28,
  "kind": "high",
  "price": 182.4
}
```

### 6.2 Contraction Definition

一段收缩 `contraction` 的目标不是完美复刻教科书，而是为可视化建立稳定骨架。

建议定义为：

- 一组相邻 swing high / swing low 形成的摆动区间
- 且该区间满足：
  - 后一段振幅不大于前一段振幅的某比例
  - 或至少在视觉上呈收敛趋势

建议输出：

```json
{
  "seq": 1,
  "startIndex": 10,
  "endIndex": 18,
  "startDate": "2026-02-10",
  "endDate": "2026-02-18",
  "swingHigh": 182.4,
  "swingLow": 168.2,
  "amplitudePct": 8.45,
  "volumeAvg": 1250000
}
```

### 6.3 Upper / Lower Hull Definition

建议不要直接把每一段收缩画成机械三角形，而是：

1. 取收缩区间内的 swing highs 构建 `upperHullAnchors`
2. 取收缩区间内的 swing lows 构建 `lowerHullAnchors`
3. 对锚点进行轻微平滑
4. 输出前台可直接绘制的点列

注意：

- 平滑只能做视觉柔化，不能改变 pivot 所在位置
- hull 点的数量应与真实 swings 接近，禁止凭空制造“更优雅”的节奏

### 6.4 Pivot Definition

建议当前版本将 `pivot` 定义为：

- 收缩后段最后一个有效阻力点
- 或最近一次关键 swing high
- 若 `TriggeredLong`，则 pivot 应与 breakout 参考位一致

推荐字段：

```json
{
  "date": "2026-03-22",
  "index": 34,
  "price": 179.8,
  "source": "last_swing_high"
}
```

### 6.5 Breakout Bar Definition

若 `snapshot.payload.trigger == true`，则输出 `breakoutBar`。

推荐定义：

- 默认采用最后一根 bar
- 未来如需更鲁棒，可回溯最近 `k` 根 bar 找第一次满足 trigger 的 bar

推荐字段：

```json
{
  "date": "2026-03-24",
  "index": 36,
  "price": 181.6,
  "close": 181.6,
  "high": 182.1,
  "volume": 2480000,
  "volumeRatioVsPrev5": 1.42
}
```

### 6.6 Risk Line Definition

`RiskOff` 的关键不是跌，而是“哪条结构被破坏了”。

建议当前版本采用以下优先级：

1. 最近一段收缩的结构低点
2. 最近有效 swing low
3. `ma20` 或当前 `risk_off_ma`

推荐输出：

```json
{
  "price": 174.3,
  "source": "last_contraction_low",
  "violated": true
}
```

## 7. State-to-Visual Rules

### 7.1 `NoSetup`

- `contractions` 可以为空
- 不强制绘制 hull
- 允许只展示价格与量能，并附“未形成结构”

### 7.2 `Watch`

- 必须尽量输出：
  - `contractions`
  - `upperHull`
  - `lowerHull`
  - `pivot`
- 不输出强触发视觉
- 成交量应表现出明显枯竭

### 7.3 `TriggeredLong`

- 必须输出：
  - `pivot`
  - `breakoutBar`
  - `upperHull`
  - `lowerHull`
- 应强调：
  - breakout volume ratio
  - strong close
  - trigger source

### 7.4 `RiskOff`

- 必须输出：
  - `riskLine`
- 若历史结构存在，也可保留 hull，但失效线需更醒目

## 8. Reason Codes

前端不应自己解释 `cond_*`，而应消费 adapter 提供的 `reasonCodes`。

建议初版 reason codes：

- `vcp_like`
- `base_trend_ok`
- `volume_dry_up`
- `breakout_soft`
- `breakout_confirmed`
- `strong_close`
- `momentum_ok`
- `momentum_recovery`
- `pivot_ready`
- `risk_line_violated`
- `no_clean_structure`

建议映射原则：

- reason code 是面向可解释层的中间语义
- 不是对原始 `cond_*` 的一比一裸露

## 9. API Shape

### 9.1 Short-Term

最小风险方案：

- 先不改主生产 API
- 仅为 POC 或内部 demo 提供一条临时接口

建议：

- `GET /api/visualization/vcp?symbol=...&date=...`

返回：

- `Layer1VisualizationPayload`

### 9.2 Mid-Term

若验证通过，再考虑：

- 将 visualization payload 挂到单票详情接口
- 或作为 `predictions` 的附加增强字段

当前不建议：

- 直接把 visualization payload 塞进 `ai_predictions_v2`

原因：

- 它是演绎型展示字段，不是核心决策真源
- 容易导致存储膨胀和版本迁移负担

## 10. Rendering Recommendations

### 10.1 Charting Library

当前 POC 使用 `lightweight-charts` 是合理的。

建议演进方式：

1. 继续使用 `lightweight-charts` 画 K 线与 volume
2. 使用 custom series / pane primitives 或同步 overlay 层画 hull / pivot / annotations

### 10.2 Coordinate Rule

任何结构线、状态标记、触发标签都必须通过：

- `time -> x`
- `price -> y`

映射生成

禁止继续使用固定 SVG 百分比坐标来表达真实结构。

### 10.3 Overlay Rule

允许存在艺术化 overlay，但必须：

1. 来自真实锚点
2. 随 resize 自动重算
3. 不与 candle / volume 的真实位置脱钩

## 11. POC Refactor Breakdown

### Task 1. Replace Mock Data with Real Data

当前问题：

- `poc/shen-ce-vcp/index.html` 使用随机 K 线

目标：

- 换成一只真实股票、一段固定窗口的真实历史数据

### Task 2. Add Volume Pane

当前问题：

- 没有独立 volume pane

目标：

- 让“缩量收缩 / 放量突破”可视化

### Task 3. Build Overlay from Payload

当前问题：

- 包络线与标记是固定 SVG 装饰

目标：

- 改成消费 `Layer1VisualizationPayload`

### Task 4. State Annotation Rewrite

当前问题：

- 标记文案更像口号

目标：

- 标签必须解释当前状态成立原因

建议示例：

- `Watch`: “幅度收窄 + 量能枯竭，接近 pivot”
- `TriggeredLong`: “突破 pivot，量比 1.42x，强收盘确认”
- `RiskOff`: “跌破结构低点 / 风控均线，结构失效”

### Task 5. Separate Design Polish from Logic Work

执行顺序必须为：

1. 真实数据
2. 真实结构
3. 真实状态锚点
4. 最后才是艺术化 polish

## 12. First Demo Candidate Selection

首个 demo 标的建议满足：

1. 有清晰日线收缩
2. 突破前后量能明显
3. 收缩段不要过于复杂
4. 最好包含完整的 `Watch -> TriggeredLong` 或 `Watch -> RiskOff`

不建议首个案例选：

- 极端妖股
- 一字板 / 长时间停牌标的
- 波动过于噪声化的边缘样本

## 13. Validation Checklist

适配层完成后，至少验证：

1. `setupState` 与现有 Layer-1 snapshot 一致
2. `pivot` 位于真实结构右侧关键阻力处
3. `riskLine` 来源可解释
4. `upperHull/lowerHull` 不漂移
5. resize 后 overlay 仍与 K 线对齐
6. `NoSetup` 不会被强行画成优雅 VCP
7. `TriggeredLong` 必须有 breakout 证据

## 14. Non-Goals for V1

V1 不做：

- 教科书级 VCP 自动打分系统
- 全市场扫描级几何模式识别服务
- 多时间框架联合 VCP 可视化
- 过度复杂的机器学习曲线拟合
- 把每个内部规则阈值直接曝光给终端用户

## 15. Recommended Next Implementation Order

建议下一步开发顺序：

1. 先选 demo 股票与时间窗
2. 落 `Layer1VisualizationPayload` 的 Python 结构
3. 在本地脚本中生成 JSON
4. 用该 JSON 驱动 POC
5. 通过截图和肉眼验收结构表达
6. 再决定是否接 API 和产品页面

这条顺序的目的是：

- 先证明“图能不能真的解释算法”
- 再投入产品集成成本
