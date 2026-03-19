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
2. 两张 `body` 同世界延展
3. 一张或多张 `card` 传播派生图

要点：

- `cover` 先做，负责定世界
- `body` 不重开世界，只做近景、局部、动作或同主题延展
- `cards` 不重新发明画面，优先从 `cover` 竖版派生

## 二、执行顺序

1. 读取文章 frontmatter
2. 只生成 `cover`
3. 人工选定 1 张最合适的 `cover`
4. 把这张 `cover` 当作参考图生成 `body_1`、`body_2`
5. 再从同一张 `cover` 派生 `card_1`
6. 如果 `cover` 不对，回到第 2 步，不要先做 `body/cards`

## 三、frontmatter 语义

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

## 四、给模型的两类输入

### 1. `cover` 输入

这是纯文生图。

建议拼接顺序：

1. `visual_style_prefix`
2. `concept_core`
3. `reader_hook`
4. `timely_anchor`
5. `image_prompts.cover`
6. `image_specs.cover`

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

## 五、程序化拼接建议

如果后面写脚本，推荐拆成两个任务类型：

- `cover_task`
  - 输入：frontmatter + cover prompt
  - 输出：`images.cover`

- `derivative_task`
  - 输入：frontmatter + 已选定的 `images.cover` + derivative guidance
  - 输出：`images.body[n]` / `images.cards[n]`

这样程序里不需要理解“文章要讲什么”，只要理解：

- 先 cover
- 后 derivative

## 六、团队执行时的判断标准

每次出图前都检查 3 个问题：

1. `cover` 有没有把这篇文章的唯一母题讲清楚？
2. `body/cards` 是不是明显来自同一个视觉世界？
3. 如果把 4 张图排在一起，看起来是不是一篇文章，而不是四个外包稿？

## 七、默认推荐

- 主母版优先用更擅长“语义准确”的模型
- 如果某模型更会讲故事但不够精致，先用它定 `cover`
- 再用参考图派生来补一致性和质感

当前默认理解：

- `cover`：文生图
- `body`：参考图派生
- `cards`：从 `cover` 派生的竖版传播图
