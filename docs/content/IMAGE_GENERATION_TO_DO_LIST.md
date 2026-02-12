# ZISO 101: 视觉资产待办清单 (Detailed Image Ops)

此清单旨在指导完成 ZISO Academy 所有文章的视觉配图补全。所有设计必须符合 **"Silent Math" (沉默的数学)** 品牌调性：**几何、极简、深色背景、Indigo(#6366f1)/Rose(#f43f5e)/Emerald(#10b981) 配色**。

---

## 🎨 视觉规范回顾 (The Standard)
- **Canvas**: `#050508` (几乎纯黑)
- **Geometry**: 3D 渲染感，磨砂或玻璃材质。
- **Action**: 强调物理性的交互（挤压、平衡、折射、过滤、碰撞）。
- **Constraints**: **绝对禁止出现文字**。绝对禁止背景模糊。居中构图。

---

## 📅 待办任务池 (Remaining 6 Images)

根据文章内容深度定制的视觉方案：

### 第三阶段：工具篇 (The Machine) - AI 与 logic

| 索引   | 文章标题    | 建议 Slug                | 视觉概念 (Concept)                                                 | DALL-E 3 详细 Prompt                                                                                                                                                                                                                                              |
| :----- | :---------- | :----------------------- | :----------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 101-65 | 置信度校准  | `confidence_calibration` | **概率分布**：一个 Indigo 的钟形曲线，只有中心区域被加亮。         | `**Concept**: Precision within probability. **Style**: Swiss Design. **Subject**: A 3D bell curve shape made of light lines. **Action**: A central narrow vertical band is highlighted in Emerald. **Colors**: Indigo/Emerald. **Constraints**: NO text.`         |
| 101-66 | Prompt 工程 | `prompt_engineering`     | **指令之光**：一道极细的光束穿过一个小孔，在墙上投射出复杂的图案。 | `**Concept**: Directional focus. **Style**: High Contrast. **Subject**: A dark wall with a tiny geometric aperture. **Action**: A intense Indigo beam shooting through the hole, expanding into a pattern. **Colors**: Indigo. **Constraints**: NO text.`         |
| 101-67 | 混合系统    | `hybrid_system`          | **共生核心**：一个由无数微小零件组成的 Indigo 大球。               | `**Concept**: Complex synthesis. **Style**: Clean 3D. **Subject**: A large sphere composed of different smaller geometric shapes (cones, cubes, toruses). **Action**: It rotates as a single unit. **Colors**: Multiple Indigo shades. **Constraints**: NO text.` |

### 第四阶段：实战案例 (The Case Study) - 识别陷阱

| 索引   | 文章标题       | 建议 Slug        | 视觉概念 (Concept)                                                             | DALL-E 3 详细 Prompt                                                                                                                                                                                                                                                            |
| :----- | :------------- | :--------------- | :----------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 101-81 | 案例：反转信号 | `case_reversal`  | **重力逆转**：一个下坠的小球在即将触底时突然产生升力向上冲。                   | `**Concept**: Abrupt change in momentum. **Style**: High Contrast. **Subject**: A trail of white particles falling. **Action**: At the bottom, they suddenly transform into a bright Indigo beam shooting upwards. **Colors**: Indigo. **Constraints**: NO text.`               |
| 101-82 | 案例：假突破   | `false_breakout` | **脆弱的顶端**：一个小球冲破了玻璃层，但随即玻璃化为 Rose 红色的碎屑将其拉回。 | `**Concept**: Deception and return. **Style**: 3D Shatter. **Subject**: A Indigo sphere breaking through a ceiling. **Action**: The ceiling fragments turn Rose Red (#f43f5e) and spiral around the sphere to drag it down. **Colors**: Indigo/Rose. **Constraints**: NO text.` |
| 101-83 | 案例：接飞刀   | `falling_knife`  | **危险的坠落**：一把锋利的 Rose 红色三角形棱柱垂直插入一个黑色的基座。         | `**Concept**: High-speed impact. **Style**: Dark Geometric. **Subject**: A sharp Rose Red (#f43f5e) prism. **Action**: It is shown frozen mid-air, pointed downwards, with motion blur streaks. **Colors**: Rose Red highlight. **Constraints**: NO text.`                      |

---

## ✅ 已完成视觉资产 (Completed)

| 索引   | 文章标题     | Slug                    | 状态 |
| :----- | :----------- | :---------------------- | :--- |
| 101-27 | 布林带       | `bollinger_bands`       | ✅    |
| 101-28 | 左/右侧交易  | `left_right_trading`    | ✅    |
| 101-29 | 缺口理论     | `gap_theory`            | ✅    |
| 101-30 | 背离         | `divergence`            | ✅    |
| 101-31 | 行业轮动     | `sector_rotation`       | ✅    |
| 101-51 | 凯利公式     | `kelly_criterion`       | ✅    |
| 101-52 | 止损的艺术   | `stop_loss_art`         | ✅    |
| 101-53 | 盈亏比       | `risk_reward_ratio`     | ✅    |
| 101-54 | 仓位管理     | `position_sizing`       | ✅    |
| 101-55 | 回撤的数学   | `drawdown_math`         | ✅    |
| 101-56 | 相关性风险   | `correlation_risk`      | ✅    |
| 101-57 | 1% 原则      | `one_percent_rule`      | ✅    |
| 101-58 | 止盈         | `profit_taking`         | ✅    |
| 101-61 | LLM vs 量化  | `llm_vs_quant`          | ✅    |
| 101-62 | 幻觉控制     | `hallucination_control` | ✅    |
| 101-63 | 上下文工程   | `context_engineering`   | ✅    |
| 101-64 | 日线 vs 盘中 | `eod_vs_intraday`       | ✅    |

---

1. **逐一读取内容**：生成前先 `view_file` 确认文章核心战术（Actionable Tactic）。
2. **生成并校验**：对比 `cmo` 规范，若出现文字或复杂背景则重做。
3. **部署**：保存为 `{slug}.png` -> 源码 `image` 字段同步。
4. **提交**：每次完成 3-5 张后进行 git commit 分期保存。
