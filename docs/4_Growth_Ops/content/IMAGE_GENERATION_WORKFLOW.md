---
title: "AI 图像生成工作流"
content_id: "ops-image-flow"
content_source: "growth"
content_type: "guide"
source_docs:
  - docs/4_Growth_Ops/46_Content_Operations_System_Blueprint.md
workflow:
  stage: "published"
  last_action_at: "2026-04-03"
---

# 图片生成工作流

适用范围：

- `docs/4_Growth_Ops/content/*`
- 公众号主场图文
- 可复用到小红书、头条号、朋友圈卡图

目标：

- 把图片生成从“每张都重新想 prompt”变成稳定可复用的工作流
- 保证 `cover / body / cards` 属于同一视觉世界
- 让 frontmatter 可以直接服务人工出图或程序拼接上下文

## 一、核心原则

一篇文章不是 4 张独立图片，而是：

1. 一张 `cover` 母版
2. 一张优先复用 `cover` 的 `body`
3. 一张按需派生的 `body`
3. 一张或多张 `card` 传播派生图

要点：

- `cover` 先做，负责定世界
- `body` 第一优先级不是“新做”，而是“能不能直接复用 `cover`”
- 只有复用不够时，`body` 才做近景、局部、动作或同主题延展
- `cards` 不重新发明画面，优先从 `cover` 竖版派生

## 二、执行顺序

1. 读取文章 frontmatter
2. 只生成 `cover`
3. 人工选定 1 张最合适的 `cover`
4. 判断 `body_1` 是否直接复用 `cover` 或 `cover` 裁切版
5. 只有在需要新的阅读节奏时，才把这张 `cover` 当参考图生成 `body_2`
6. 再从同一张 `cover` 派生 `card_1`
7. 如果 `cover` 不对，回到第 2 步，不要先做 `body/cards`

## 三、默认决策顺序

每篇文章都按这个顺序判断：

1. `cover` 能不能直接作为头图和正文第一张图
2. 如果可以，`body_1 = reuse_cover`
3. 如果正文中段还需要换气，再补 `body_2 = derive_from_cover`
4. 如果文章本身很短，甚至可以没有额外 `body`

推荐默认策略：

- `cover`: 必做
- `body_1`: 优先复用 `cover`
- `body_2`: 按需派生
- `cards`: 从 `cover` 派生
## 四、frontmatter 语义

- `image`
  兼容字段，默认等于 `images.cover`
- `images.cover / body / cards`
  各角色图片的目标文件路径
- `image_prompts.cover`
  文生图母版 prompt
- `derivative_guidance.body`
  参考图派生指令
- `derivative_guidance.cards`
  参考图派生指令
- `visual_strategy.body_asset_policy`
  控制正文图优先复用还是优先派生
## 五、给模型的两类输入

### 1. `cover` 输入

这是纯文生图。

建议拼接顺序：

1. `visual_style_prefix`
2. `concept_core`
3. `reader_hook`
4. `timely_anchor`
5. `image_prompts.cover`
6. `image_specs.cover`

注意：

- `visual_style_prefix` 只负责风格
- `image_prompts.cover` 只负责这篇图的场景语义
- 不要在 `image_prompts.cover` 里重复整段风格前缀

示例：

```text
[Style Prefix]
Premium editorial finance style, realistic not cartoonish, dark high-contrast atmosphere, emotionally restrained but tense, Chinese investor context, single strong visual metaphor, clean composition, premium materials, no text, no watermark, no cheap sci-fi look, no generic corporate stock image feel.

[Article Core]
Concept core: 会干活的 AI 没有刹车
Reader hook: AI Agent 看起来很会干活，但最重要的刹车和风控是空的。
Timely anchor: OpenClaw/AI Agent/大模型炒股

[Task]
Create the primary cover image for a WeChat finance article. This is the mother frame for all derivative images.

[Visual Goal]
A red mechanical lobster claw gripping a steering wheel...

[Format]
Horizontal composition, 1200x675.

[Constraints]
No text, no watermark, no readable UI text, no brand logos.
```

### 2. `body/cards` 输入

这不是重新写一张新图，而是“参考我给你的这张 cover 图片”。

示例：

```text
Use the provided cover image as the visual reference.

Keep:
- the same main subject
- the same material language
- the same color palette
- the same emotional tone
- the same visual world

Change only:
- create a closer supporting scene that emphasizes the investor's anxiety

Do not introduce:
- new characters
- a new visual style
- readable text
- unrelated background elements
```
如果 `body_1` 直接复用 `cover`，这一步可以跳过。

## 六、程序化拼接建议

如果后面写脚本，推荐拆成两个任务类型：

- `cover_task`
  - 输入：frontmatter + cover prompt
  - 输出：`images.cover`

- `derivative_task`
  - 输入：frontmatter + 已选定的 `images.cover` + derivative guidance
  - 输出：`images.body[n]` / `images.cards[n]`

这样程序里不需要理解“文章要讲什么”，只要理解：

- 先 cover
- 再判断 reuse 还是 derivative
## 七、团队执行时的判断标准

每次出图前都检查 3 个问题：

1. `cover` 有没有把这篇文章的唯一母题讲清楚？
2. `body/cards` 是不是明显来自同一个视觉世界？
3. 如果把 4 张图排在一起，看起来是不是一篇文章，而不是四个外包稿？
4. 正文第一张图是不是其实可以直接复用 `cover`，而不是为了凑数新做一张？

## 八、默认推荐

- 主母版优先用更擅长“语义准确”的模型
- 如果某模型更会讲故事但不够精致，先用它定 `cover`
- 再用参考图派生来补一致性和质感

当前默认理解：

- `cover`：文生图
- `body`：参考图派生
- `cards`：从 `cover` 派生的竖版传播图

## 九、工具入口

如果使用仓库内自动化工具，请直接看：

- [GRSAI_IMAGE_TOOL.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/GRSAI_IMAGE_TOOL.md)

该文档包含：

- API Key 放置方式
- `101-68` 全流程命令
- `--force` 单图重生
- `--asset-file` 切换其他文章
- 常见报错排查
