# 功能规格说明书：量化/AI 双层界面表现 (Spec 40)

> **设计准则**: 严格继承项目现有的 `Silent Math` 视觉语言，复用已有的 Tailwind tokens 和暗黑玻璃态美学，不平地起高楼。对历史数据必须提供完美向下兼容，确保“时光机”模式不崩溃。

## 0. 现状审查与设计约束 (Status Quo & Constraints)
当前 (`AICouncil.tsx`) 采用的是“议会投票制” UI：顶部的 Consensus Header 汇集了下方多个 AI 成员的信号以计算共振（如：`倾向做多`，`做空共振`）。
**现有资产复用要求**：
1.  **颜色资产**：继续使用体系内的 `emerald-500/20` (多)、`rose-500/20` (空)、`amber-500/20` (侧)，以及基础的玻璃态 `bg-white/5 border-white/10`。
2.  **字体资产**：层级标签复用 `text-[10px] uppercase tracking-widest`，长文稿复用 `text-xs text-slate-300 leading-relaxed font-medium`。
3.  **架构资产**：重构只能涉及 DOM 渲染层的变动，**绝对禁止**修改和破坏现有的 `SWR Map Cache` 和 `Zero UI Flash`（零闪烁加载）机制。

---

## 1. 核心目标 (The Goal)
在不破坏现有高质量 UI 体验的前提下，通过**微妙的兵法级文案修订 (Semantic Text Changes)** 与 **团队服务模式的转换 (Team Service Narrative)**，将旧的“单个AI孤立喊单”体系，升级为“小组协作服务（顾深+程矩 / 林序+程矩）”的心智模型。用极简的文字进化，匹配底层双层量化引擎的威力。

---

## 2. UI 重构蓝图 (Refactoring Blueprint)

### 2.1 语义演进：首页强宣发
- **动作**：`StockDashboardCard.tsx` 中的司令部 `H2` 呈现纯文字级别的替换。
- **映射**：
    - `Long` -> **`战机触发`**
    - `Short` -> **`纪律防守`**
    - `Side` -> **`重点盯防`**
    - `Null` -> **`查无战机`**
- **原则**：只改字，不加戏。原有的 `COLORS.up/down/hold` 的绿/红/黄配色以及极简体验原样保留。

### 2.2 工作组织演进：从单打独斗到“小组服务”
- **定位**：`AICouncil.tsx` 与 `TacticalBriefDrawer.tsx` 不再是散装的 AI 名单，而是正式呈现为“执行团队的小组服务”。
- **表现**：
    - **体现协同**：在策略内参和投研决议中，文案及角色名需侧面体现这是“程矩(量化)提供触发红线，顾深/林序(AI)提供推演”的团队包裹服务。
    - **无痛过渡**：依然沿用目前的卡片流和抽屉展开模式，只在数据组装上确保输出的是“小组打配合”的报告，而不是个人盲猜的报告。

---

## 4. 全局体验改造矩阵 (UX Modification Matrix)

为了在开发阶段能够逐页面核对，并将视觉效果具象化，特制定此表：

| 组件文件 (Component)          | 改造区域 (Target Area) | 现状 (As-Is)                                     | 目标 (To-Be)                                                         | 视觉特效规范 (Visuals & Tailwind)            | 旧数据回退逻辑 (Fallback) |
| :---------------------------- | :--------------------- | :----------------------------------------------- | :------------------------------------------------------------------- | :------------------------------------------- | :------------------------ |
| **`StockDashboardCard.tsx`**  | 顶层核心结论 (`H2`)    | 显示 `建议做多` / `建议避险` 等字样              | 语义变更为量化风格文字：`战机触发` / `重点盯防` / `纪律防守`         | 保持现有颜色与排版视觉，不增加干扰。         | 无缝兼容旧数据。          |
| **`StockDashboardCard.tsx`**  | 中部 AI 摘要卡片       | 文案显示 `要点速递`                              | 保持不变。                                                           | 保持原有的全部玻璃态逻辑，不作任何 UI 修改。 | 完全兼容旧版摘要展示。    |
| **`AICouncil.tsx`**           | 顶部共识区 (`Header`)  | `x席 投研决议` 与 类似 `倾向做多` 的投票结果展示 | 保持原样，借用现有心智展示最终团队共识。                             | 保持目前极致的极简深色模式 UI。              | 对旧数据完全无痛。        |
| **`AICouncil.tsx`**           | 下方成员卡片列表       | 独立工作的成员报告展示                           | 展示为“小组服务”协同推演（如顾深+程矩）。                            | 保持现有高亮逻辑（`isPrimary`）。            | 对旧数据完全无痛。        |
| **`TacticalBriefDrawer.tsx`** | 战术抽屉 (Drawer)      | 一人的长篇独立分析                               | 文案结构与署名上体现为“小组服务结果”，例如程矩出点位、林序解释逻辑。 | 原有 markdown 渲染层保持不变。               | -                         |

---

## 5. 前后端契约与容错 (Client-Server Contract)
由于该挂载在 `Feed` 上的组件还会被用于查看半年甚至一年前的历史数据，必须考虑**向后兼容 (Backward Compatibility)**。

*   **API 与 DB 调整**：确保 `/api/predictions?mode=full` 及数据库 `ai_predictions_v2` 在返回时，附加 `layer1_status`。而针对前端的 `AIPrediction` TypeScript Interface 也需增加对应字段。
*   **平滑回退 (Graceful Fallback)**：
    *   在渲染前检查 `const displaySignal = prediction?.layer1_status || prediction?.signal;`。
    *   如果为旧数据结构（无独立量化信号），代码必须能原封不动地回退执行现有的“统计算票 logic (longCount, shortCount)” 和“建议做多”这种基于选票的翻译。绝不能让旧数据的页面崩溃。

---

## 5. 验收标准 (Done)
- [ ] 确保前端架构（`StockDashboardCard`, `AICouncil`）在不修改 UI 的前提下，平滑兼容包含或不包含 `layer1_status` 的新老 API 数据。
- [ ] 量化层的重构主要聚焦在 `backend/engine` 中，对最终输出给前端的 `predictions` 的包装，而非打碎重做前台。

