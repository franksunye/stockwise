---
title: "38 VCP First Demo Case 02171 20260324"
doc_id: "engineering-vcp-first-demo-case-02171-20260324"
doc_domain: "engineering"
doc_status: "draft"
owner: "founder"
last_reviewed_at: "2026-03-24"
summary: "定义首个 Shen Ce VCP 可视化 demo 案例，使用线上真实数据中的科济药业-B（02171）窗口，覆盖 NoSetup / Watch / TriggeredLong / RiskOff 四状态。"
---

# 38 VCP First Demo Case 02171 20260324

更新时间：2026-03-24  
状态：Draft  
定位：首个可执行 demo 案例说明

关联文档：

- [`50_VCP_Visualization_Transparency_Spec.md`](/Users/yesun/Code/stockwise/docs/3_Product/Specs/50_VCP_Visualization_Transparency_Spec.md)
- [`37_VCP_Visualization_Adapter_Design_20260324.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/37_VCP_Visualization_Adapter_Design_20260324.md)
- [`index.html`](/Users/yesun/Code/stockwise/poc/shen-ce-vcp/index.html)

## 1. 结论

首个 VCP 可视化 demo 案例，选择：

- `02171`
- `科济药业-B`
- 时间窗：`2026-03-06` 到 `2026-03-24`

选择理由：

1. 线上真实数据完备
2. 线上真实 Layer-1 信号已覆盖四状态
3. 窗口长度短，便于在第一版 POC 中讲清结构变化
4. 比 `00700` 更完整，比 `300502` 更适合做“全信号教学样本”

## 2. Data Evidence

线上去重后的四状态记录如下：

- `2026-03-06`: `RiskOff`
- `2026-03-09`: `NoSetup`
- `2026-03-10`: `NoSetup`
- `2026-03-11`: `NoSetup`
- `2026-03-12`: `NoSetup`
- `2026-03-13`: `NoSetup`
- `2026-03-16`: `NoSetup`
- `2026-03-17`: `NoSetup`
- `2026-03-18`: `TriggeredLong`
- `2026-03-19`: `Watch`
- `2026-03-20`: `RiskOff`
- `2026-03-23`: `RiskOff`

这个案例的价值不在于“完美教科书顺序”，而在于：

- 同一只股票、同一段真实窗口里，四状态都真实出现过
- 可以让我们做出第一版完整解释系统

## 3. Product Interpretation

### 3.1 为什么 `02171` 适合当第一版

对第一版 POC 来说，我们最需要的是：

1. 让用户看懂 4 个状态分别长什么样
2. 让结构、量能、标签和日期一一对应
3. 不被过于复杂的走势噪音拖垮

`02171` 的 3 月窗口满足这个条件：

- `03-06` 是破坏态
- `03-09 ~ 03-17` 是结构未清晰前的杂乱与过渡
- `03-18` 有明确触发
- `03-19` 出现回落观察态
- `03-20` 再次转入防守

### 3.2 一个重要提醒

这不是一个“线性教科书海报”案例，而是一个“真实系统状态切片”案例。

因此第一版 POC 不建议只做成一张静态“完美三角收敛后突破”的图，而应做成：

- **同一标的，四帧切片**

这是第一版最稳、最真实、最能解释系统的方式。

## 4. Demo Form

### 4.1 推荐形式

第一版 POC 推荐使用：

- `1 只股票`
- `1 个时间窗`
- `4 个状态切片`

而不是：

- `1 张图硬塞 4 个状态标签`

### 4.2 四帧结构

建议右侧切成四个状态帧，或做一个带切换按钮的单图切片：

1. `RiskOff`
2. `NoSetup`
3. `TriggeredLong`
4. `Watch`

推荐默认排序按“教学逻辑”而非严格自然时间：

1. `NoSetup`
2. `Watch`
3. `TriggeredLong`
4. `RiskOff`

但每帧必须清楚标出真实日期。

## 5. Exact Frame Selection

### Frame A: `NoSetup`

- 日期：`2026-03-17`
- 收盘：`15.96`
- 成交量：`4,723,015`
- MA10：`14.39`
- MA20：`14.52`

选择理由：

- 比 `03-09 ~ 03-13` 更接近触发前夕
- 用户更容易理解“还没形成清晰触发，但值得盯住”
- 同时仍属于线上真实 `NoSetup`

这一帧要表达：

- 价格还未构成明确可进攻结构
- 不应该强行画出“已完成收敛”的优雅包络
- 系统此时的态度是克制，不是兴奋

### Frame B: `TriggeredLong`

- 日期：`2026-03-18`
- 开盘：`15.89`
- 最高：`16.78`
- 最低：`15.80`
- 收盘：`16.62`
- 成交量：`5,268,680`
- MA10：`14.91`
- MA20：`14.59`
- Layer-1：`TriggeredLong`

选择理由：

- 这是该窗口最明确的触发日
- 有真实 trigger hit
- 可以作为突破、触发位、强收盘、量能确认的演示中心

这一帧要表达：

- 哪个价位是 pivot
- 哪根 bar 是 breakout bar
- 量能相对前几日是否扩张
- 为什么系统不是 `Watch` 而是 `TriggeredLong`

### Frame C: `Watch`

- 日期：`2026-03-19`
- 收盘：`15.70`
- 成交量：`5,131,000`
- MA10：`15.28`
- MA20：`14.60`
- Layer-1：`Watch`

选择理由：

- 这是线上唯一明确 `Watch` 的日期
- 非常适合演示“触发后仍可能进入观察态”

这一帧要表达：

- 结构尚未完全失效
- 但进攻优势已弱化
- 系统退回观察，不继续盲目追击

### Frame D: `RiskOff`

- 日期：`2026-03-20`
- 收盘：`15.20`
- 成交量：`4,478,000`
- MA10：`15.71`
- MA20：`14.58`
- Layer-1：`RiskOff`

选择理由：

- 紧邻 `Watch` 之后
- 最适合演示“结构退化 -> 进入防守”

这一帧要表达：

- 失效线在哪里
- 是跌破了哪一层结构
- 为什么系统从 `Watch` 切成 `RiskOff`

## 6. First POC Layout Recommendation

### 6.1 左侧信息区

左侧继续保留你现在 POC 的叙事区，但要从“概念文案”升级成“案例文案”：

- 股票名：`科济药业-B`
- 代码：`02171`
- 数据日期窗：`2026-03-06 ~ 2026-03-24`
- 当前帧状态
- 该状态的 1 句话解释
- 2 到 4 个关键依据

建议结构：

1. 顶部 Badge
2. 大标题
3. 当前状态一句话总结
4. 关键依据列表
5. 四状态导航

### 6.2 右侧图区

第一版只保留最关键元素：

1. 真实 K 线
2. 真实 volume pane
3. upper hull
4. lower hull
5. pivot
6. breakout bar
7. risk line
8. 当前帧的状态标签

## 7. Must-Have Elements for POC V1

以下元素为 V1 必做：

- 真实 `02171` 数据
- 日期切片切换
- 单独的 volume pane
- 数据驱动的结构线
- breakout 高亮
- risk line 高亮
- 左右两侧语义联动
- 当前帧日期与价格标注

## 8. Nice-to-Have Elements for POC V1.5

以下元素可以在 V1 后补：

- 动态切换动画
- 更优雅的包络平滑
- 收缩段编号 `C1 / C2 / C3`
- reason code 可视化 chips
- 价格标签吸附
- hover tooltip

## 9. Elements That Must Be Removed from Current POC

以下元素不应继续保留为最终逻辑表达：

- 随机生成的 K 线
- 固定百分比定位的装饰路径
- 与真实价格无关的 `Watch / Triggered / RiskOff` 标签坐标
- 没有 volume 的“伪 VCP 图”

## 10. Right-Side Drawing Rules for This Case

### 10.1 Hull

- hull 只围绕当前帧前后相关的结构窗
- `NoSetup` 帧可弱化或取消 hull
- `TriggeredLong` 与 `Watch` 帧必须展示 hull

### 10.2 Pivot

- `TriggeredLong` 帧必须展示 pivot
- `Watch` 帧可展示 pivot，但样式应弱于触发态

### 10.3 Risk Line

- `RiskOff` 帧必须展示 risk line
- `TriggeredLong` 帧可预埋 risk line，作为风控提示

### 10.4 Volume

- volume 必须成为右图的一部分，而不是隐藏数据
- `TriggeredLong` 帧重点显示放量
- `NoSetup` 帧重点显示量能未构成清晰优势

## 11. Suggested Interaction Model

第一版建议用最简单的交互：

- 左侧四状态列表
- 点击切换右侧图的状态帧

默认打开：

- `TriggeredLong`

原因：

- 最有戏剧性
- 最容易让用户理解“系统不是只会说概念，它能明确指出触发”

## 12. Exact Copy Direction for V1

第一版文案建议从“概念式”改为“案例式”。

### `NoSetup`

- 标题：`Structure Not Ready`
- 中文解释：`波动仍在整理，但系统尚未确认这是可进攻结构。`

### `Watch`

- 标题：`Watch The Pivot`
- 中文解释：`价格回到观察区，结构仍可跟踪，但突破优势已减弱。`

### `TriggeredLong`

- 标题：`Trigger Confirmed`
- 中文解释：`价格突破关键位，右侧动能与收盘质量达标。`

### `RiskOff`

- 标题：`Structure Violated`
- 中文解释：`结构优势消失，系统转入防守，不再鼓励进攻。`

## 13. Execution Order

首个 `02171` demo 的实施顺序建议如下：

1. 固定 `02171` 数据 JSON
2. 固定四帧日期
3. 用真实数据替换当前 POC 的 mock K 线
4. 加 volume pane
5. 加状态切换
6. 加 pivot / risk line / breakout
7. 最后再修包络线优雅度

## 14. Acceptance Criteria

此案例完成后，应满足：

1. 用户能清楚看出这是 `02171` 的真实数据
2. 四状态都能在同一案例中被展示
3. 每个状态都有对应日期
4. 右图的关键线条都锚定真实价格
5. 左侧文案与右侧状态一致
6. 当前 POC 中“漂亮但无锚点”的图形被替换掉

## 15. Next Optional Case

在 `02171` 完成之后，第二个推荐案例为：

- `300502` 新易盛

定位：

- 不作为“全信号样本”
- 作为“高戏剧性 TriggeredLong / RiskOff 样本”

这样可以形成：

- `02171`：教学型全信号案例
- `300502`：品牌型强冲击案例
