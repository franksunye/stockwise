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
在 UI 层面上彻底终结系统内的“AI 议会投票制”，重构为 **“量化先决雷达 (Layer-1) + AI 释义参谋 (Layer-2)”** 的主从体系。消除用户面对众口难调的 AI 时的茫然，赋予量化结论最高视觉权重与压迫感。

---

## 2. UI 重构蓝图 (Refactoring Blueprint)

### 2.1 顶部：Layer-1 量化雷达屏 (The Quant Radar)
- **定位**：原地将当前的 Consensus Header 升级为“量化雷达大屏”。
- **数据源绑定**：响应后台传入的全局字段（如 `layer1_status`），它不再是下方 AI 的“计票结果”，而是一张不可违背的“法院判决书”。
- **视觉映射 (UI Mappings)**：
    - `TriggeredLong` (战机确认)：卡片背景置换为强烈的 `bg-emerald-500/10 border-emerald-500/30`。在组件最右侧，引入带有 `animate-ping` 的脉冲指示灯，营造“猎物出现立刻开火”的临场感。
    - `RiskOff` (纪律防守)：背景置换为 `bg-rose-500/10 border-rose-500/30`。文案采用极具红线意味的警告，例如 "红线跌破 · 立刻防守"，取代原来的 "共振" 说辞。
    - `Watch` (重点盯防)：使用警醒的 `bg-amber-500/10`。
    - `NoSetup` (查无战机)：回退回现有的 `bg-white/5` 默认玻璃态。
- **透明度微交互**：允许用户点击这个强导向的雷达屏，向下展开一个不抢眼的解释层（`text-[10px] text-slate-500`），纯粹输出量化算子：`Engine: [Vol-Contraction / MA20 Breakout]`。

### 2.2 下方：Layer-2 战术参谋团 (The Tactical Council)
- **定位**：改造目前的“成员卡片列表”。
- **核心手术：剥夺明文决策权**
    - 隐藏原版每个模型卡片右上角的胶囊指示器（原：`bg-emerald-500/20 text-emerald-400` 的 `做多/做空` 标签）。
    - 既然大方向已由量化雷达圈定，AI 就不配再发方向性质的指令，它们的职责转向 **“定性解释与风险推演”**。
- **重心转移**：
    - 因为没有了右上角的胶囊标签，UI 的负空间可以让给 `ai_reasoning`（推理文本段），我们可以适当放宽 `line-clamp-2` 限制，鼓励更深度的展示（比如 `line-clamp-3`）。
    - 保留现有的 `isPrimary` 背景高亮逻辑（`bg-indigo-500/10`），维持不同职级员工的汇报主次顺序。

---

## 3. 首屏枢纽重构 (The Dashboard Core)

`StockDashboardCard.tsx` 是用户第一眼看到的战斗屏。必须移除其中旧版 AI 直接下达方向指令的视觉遗留。

### 3.1 顶层定调：量化状态接管主视觉
- **动作**：接管目前核心的 `<h2>` （现在的文案是：`建议做多 / 建议避险 / 建议观望`）。
- **文案与颜色映射 (The H2 Replacement)**：
    - 旧：`建议做多` -> 新：**`战机触发`** (TriggeredLong) 配合 `COLORS.up` (Emerald)。
    - 旧：`建议避险` -> 新：**`纪律防守`** (RiskOff) 配合 `COLORS.down` (Rose)。
    - 旧：`建议观望` -> 新：**`重点盯防`** (Watch) 配合 `COLORS.hold` (Amber)。
    - `NoSetup` 则显示为“查无战机” (Slate)。
- **视觉增强**：在 `TriggeredLong` 和 `RiskOff` 这种具有绝对偏向性的阶段，触发卡片整体容器的 `warning-pulse` 类，让整个界面具有压迫感。

### 3.2 参谋卡片层 (The Center Card)
- **动作**：保持点击展开 `TacticalBriefDrawer` 的能力不变。
- **UI 强调**：既然顶层 H2 已经确定了“买/卖/停”，该区块的核心展示应该收敛到 `tacticalData.summary` 和 `support_price`，并用类似“AI 评估确认”之类的文案，体现 AI 作为“副手”的核验作用。

---

## 4. 前后端契约与容错 (Client-Server Contract)
由于该挂载在 `Feed` 上的组件还会被用于查看半年甚至一年前的历史数据，必须考虑**向后兼容 (Backward Compatibility)**。

*   **API 与 DB 调整**：确保 `/api/predictions?mode=full` 及数据库 `ai_predictions_v2` 在返回时，附加 `layer1_status`。而针对前端的 `AIPrediction` TypeScript Interface 也需增加对应字段。
*   **平滑回退 (Graceful Fallback)**：
    *   在渲染前检查 `const displaySignal = prediction?.layer1_status || prediction?.signal;`。
    *   如果为旧数据结构（无独立量化信号），代码必须能原封不动地回退执行现有的“统计算票 logic (longCount, shortCount)” 和“建议做多”这种基于选票的翻译。绝不能让旧数据的页面崩溃。

---

## 5. 验收标准 (Done)
- [ ] `StockDashboardCard.tsx` 与 `AICouncil.tsx` 可无缝兼容携带 Layer-1 的新账本数据与旧的纯 AI 数据。
- [ ] 顶部雷达 / 首屏 H2 在 `TriggeredLong/RiskOff` 触发下，精准复用现有的 Tailwind 环保色板（Emerald/Rose），且带有 `animate-ping` 或 `warning-pulse` 呼吸动效。
- [ ] 成员卡片右上角的“方向标签”在新模式下已被剥除，文案空间被放大，但原有的 `isPrimary` 主位视觉（Indigo）得到保留。
- [ ] 改造过程 `isMounted` 与 `SWR Cache` 防丧尸泄露机制完好无损。

