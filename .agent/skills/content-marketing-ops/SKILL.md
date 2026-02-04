---
name: content-marketing-ops
description: StockWise 内容营销与视觉设计标准作业程序 (SOP)。包含写作风格指南、"Silent Math" 视觉设计规范、以及文章发布流程。
---

# Content Marketing Ops - StockWise 101

此技能封装了 StockWise 品牌内容创作的核心哲学与执行标准。适用于所有 **StockWise Academy (Learn)** 板块的内容生产。

## 1. 核心哲学 (Philosophy)

StockWise 不仅仅是一个工具，它是一个 **"理性的避难所" (Rational Sanctuary)**。
我们的敌人是：噪音、情绪、甚至是被神话的"股神"。
我们的武器是：数学、概率、以及 AI 的冷酷理性。

*   **Be a Teacher, not a Guru**: 我们不教人暴富，我们教人如何在市场中**生存**。
*   **Anti-Hype**: 拒绝一切金融圈的陈词滥调（火箭、金币、牛市来了）。
*   **Evergreen**: 生产 10 年后依然有价值的内容（人性不变，数学不变）。

---

## 2. 写作风格指南 (Tone of Voice)

### 🚫 禁止 (Anti-Patterns)
*   **AI 味/翻译腔**: "总而言之"、"这不仅...而且..."、"综上所述"。
*   **教科书式定义**: "RSI 是由威尔德于 1978 年提出的..." (用户不关心)。
*   **喊口号**: "让我们一起迎接财富自由！"

### ✅ 提倡 (Best Practices)
*   **对话感**: 像在酒吧里和一个老朋友聊交易。多用"你"、"我"。
*   **短句与断言**: 观点要犀利。不要两头堵。
*   **比喻**: 用物理学（惯性、重力、摩擦力）来解释金融学。
    *   *例: "均线不是线，是成本。" / "背离就是车还在跑，但油没了。"*
*   **硬核干货**: 每一篇文章必须包含至少一个可操作的战术 (Actionable Tactic)。

---

## 3. 视觉设计规范 (Visual Identity: "Silent Math")

StockWise 的视觉语言被称为 **"Silent Math" (沉默的数学)**。
它结合了 **Swiss Style (瑞士国际主义风格)** 的严谨与 **Cyberpunk/Dark Mode** 的科技感。

### 色板 (Color Palette)
*   **Canvas**: `#050508` (Deep Void / Almost Black) - *永恒的背景*
*   **Primary**: `#6366f1` (Indigo-500) - *AI / 理性 / 结构*
*   **Rose**: `#f43f5e` (Rose-500) - *风险 / 亏损 / 警告*
*   **Emerald**: `#10b981` (Emerald-500) - *利润 / 安全 / 视觉*

### 图片生成 Prompt 模版
使用以下结构来生成符合品牌调性的 DALL-E 3 / Midjourney / Gemini 图片：

```markdown
**[Concept]**: A conceptual 3D illustration of [TOPIC].
**[Style]**: Swiss Design, Geometric, Minimalist, Clean, Dark Mode (#050508).
**[Subject]**: [Describe the central geometry - e.g., a floating cube, a split sphere].
**[Action]**: [Describe the interaction - e.g., balancing, colliding, filtering].
**[Materials]**: Matte finish, soft global illumination, high contrast. Steps away from realism, more symbolic.
**[Colors]**: Strictly use Indigo (#6366f1), Rose Red (#f43f5e), and Emerald Green (#10b981) accents on a dark background.
**[Constraints]**: NO text. NO blur. NO complex backgrounds. Center composition.
```

---

## 4. 技术执行流程 (Workflow)

### Step 1: Create Markdown
在 `docs/content/` 目录下创建 `.md` 文件。文件名格式：`101-{XX}_{slug}.md`。

**Frontmatter 规范**:
```yaml
---
title: "101-XX: 中文主标题"
subtitle: "一句话中文副标题 (直击痛点)"
date: "YYYY-MM-DD"
category: "The Mind" | "The Method" | "The Money" | "The Machine"
image: "/images/learn/{slug}.png"
image_prompt: "这里保留当时生成图片的 prompt，作为资产备份"
---
```

### Step 2: Generate Image
使用上文的 Prompt 模版生成图片。

### Step 3: Deploy Asset
1.  下载生成的图片。
2.  重命名为 `{slug}.png`。
3.  放入 `frontend/public/images/learn/` 目录。
4.  提交 Git。

---

## 5. 常用指令 (Commands)

*   **汉化检查**: 确保 Title/Subtitle 是地道的中文。
*   **分类映射**:
    *   The Mind -> 心法篇
    *   The Method -> 术法篇
    *   The Money -> 资金篇
    *   The Machine -> 工具篇
