# 2026Q2 10W+ 图片作战稿

适用范围：

- 当前 4 周 `101` 发布队列 20 篇
- 公众号首发
- 可复用到小红书、头条号、朋友圈卡片

目标：

- 图片不再只是装饰，而是点击入口、阅读节奏器和转发放大器
- 从“Silent Math 纯概念图”升级到“读者视角优先”的混合视觉系统
- 让图片服务 `10w+`：先留人，再解释，再建立品牌

## 一、图片总原则

1. 先帮点击，再帮理解。
2. 一张图只传一个意思，不贪多。
3. 普通投资者优先看“我是不是这样”，再看“这个概念是什么”。
4. `101` 图片要更像“认知钩子”，不是科技海报。
5. 宏观、地缘、产业类，优先真实纪实感；方法论、心智、AI 类，优先隐喻概念图。

## 二、每篇建议图片数

- `1` 张封面主图
- `2` 张正文节奏图
- `1` 张再分发卡图

默认每篇 `4` 张。

例外：

- 强热点文章可加到 `5` 张
- 纯方法论桥梁文可压到 `3` 张

## 三、图型定义

- `Concept`
  适合：AI、纪律、风险、方法论、系统边界
  特征：隐喻强、构图简洁、情绪冷、认知感强

- `Editorial`
  适合：地缘、油价、电力、消费、宏观
  特征：纪实感、新闻感、真实世界张力

- `Hybrid`
  适合：既要热点同频，又要品牌统一的文章
  特征：现实元素 + 抽象隐喻混搭

## 四、统一风格前缀

所有图片提示词默认共用这一段风格 DNA，再接单篇内容描述：

```text
Premium editorial finance style, realistic not cartoonish, dark high-contrast atmosphere, emotionally restrained but tense, Chinese investor context, single strong visual metaphor, clean composition, premium materials, no text, no watermark, no cheap sci-fi look, no generic corporate stock image feel.
```

使用规则：

1. 先写这段统一风格前缀
2. 再补单篇 `cover` 主画面内容
3. `body / cards` 不要当成新的独立 prompt，而要写成参考图派生指令
4. 不要每篇都重新发明风格

这样可以保证：

- 图片越多，品牌越统一
- 不会一张像财经媒体，一张像科技海报，一张又像 AI 卡通图
- `cover / body / cards` 更容易保持同一视觉世界

## 五、提示工程规则

这里最重要的一条：

- `cover` 是文生图 prompt
- `body / cards` 不是新的独立 prompt，而是“参考我给的 cover 图片”的派生指令

也就是说，真正执行时：

1. 先生成 `cover`
2. 选定一张最合适的 `cover`
3. 再把这张 `cover` 当参考图去做 `body`
4. 最后从同一张 `cover` 派生 `card`

推荐语气：

```text
Use the provided cover image as the visual reference.
Keep the same subject, palette, material language, emotional tone, and visual world.
Change only...
```
## 六、逐篇定义

### 1. 101-68 General LLM Illusion

- 文件：[101-68_general_llm_illusion.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-68_general_llm_illusion.md)
- 图型：`Hybrid`
- 建议图片数：`5`
- 封面方向：一只“龙虾/机械爪”握着方向盘，前方是剧烈波动的市场屏，视觉重点是“它看起来会开车，但刹车系统是空的”
- 正文图建议：
  - “会说人话，不等于能扛风险”
  - “AI 会搜资料，但不会替你止损”
- 封面提示词：

```text
A high-tension editorial-concept hybrid image for a Chinese finance article. A red mechanical lobster claw gripping a luxury car steering wheel in front of a blurred volatile trading screen. The dashboard has no brake indicator, suggesting danger. Cinematic, premium, sharp contrast, realistic materials, dark background, subtle Chinese finance media aesthetic, not sci-fi poster, no text, no watermark.
```

### 2. 101-12 L4 HFT Illusion

- 文件：[101-12_l4_hft_illusion.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-12_l4_hft_illusion.md)
- 图型：`Concept`
- 建议图片数：`4`
- 封面方向：散户的手指刚要点下“买入”，另一侧是一排高速机房服务器，形成速度碾压
- 封面提示词：

```text
A conceptual finance image showing a human finger about to tap a mobile buy button, contrasted against towering ultra-fast server racks and fiber lines rushing past. The human side looks fragile and late. Premium editorial lighting, dark Chinese finance tone, strong speed contrast, realistic, no text, no UI overlays.
```

### 3. 101-100 Maturity Prologue

- 文件：[101-100_maturity_prologue.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-100_maturity_prologue.md)
- 图型：`Concept`
- 建议图片数：`4`
- 封面方向：同一张战场地图上，散户拿着简陋工具，远处是机构舰队，强调“不是一个层级”
- 封面提示词：

```text
A conceptual hierarchy map of investing levels. In the foreground, a lone retail investor with simple tools; in the distance, an industrial institutional fleet of machines, terminals, and infrastructure. The scene feels like different layers of the same battlefield. Dark premium editorial style, symbolic, no text.
```

### 4. 101-40 Opportunity Cost

- 文件：[101-40_opportunity_cost.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-40_opportunity_cost.md)
- 图型：`Editorial`
- 建议图片数：`4`
- 封面方向：一个人被锁在一只下跌股票的笼子里，笼子外面远处是上涨的行情列车
- 封面提示词：

```text
An editorial-style symbolic image: a retail investor trapped behind a transparent cage shaped like a falling stock chart, while in the background a bright upward market train moves away. Emotional but clean composition, realistic, Chinese investing mood, no text.
```

### 5. 101-69 ZISO Rhythm

- 文件：[101-69_ziso_rhythm.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-69_ziso_rhythm.md)
- 图型：`Concept`
- 建议图片数：`4`
- 封面方向：白天手机通知爆炸，夜晚只剩两盏稳定的灯 `08:30 / 21:00` 的节律感
- 封面提示词：

```text
A calm conceptual image about disciplined timing. Chaotic exploding phone notifications fading into the background, while two stable glowing light points anchor the scene like rational checkpoints. Premium dark palette, finance lifestyle mood, minimal but emotionally clear, no text.
```

### 6. 101-18 Echo Chamber

- 文件：[101-18_echo_chamber.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-18_echo_chamber.md)
- 图型：`Hybrid`
- 建议图片数：`4`
- 封面方向：一个人深夜刷手机，屏幕里不断重复同一只股票的利好标题，像回音墙
- 封面提示词：

```text
A hybrid editorial image of a retail investor late at night scrolling on a phone, surrounded by repeating finance headlines about the same stock, forming an echo wall. The mood is anxious, self-reinforcing, and claustrophobic. Realistic, dark room lighting, Chinese finance context, no text.
```

### 7. 101-44 Volatility Tax

- 文件：[101-44_volatility_tax.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-44_volatility_tax.md)
- 图型：`Editorial`
- 建议图片数：`4`
- 封面方向：同一个账户被来回拉扯，像被市场连续扇耳光，强调“天天给点希望又收走”
- 封面提示词：

```text
An editorial symbolic finance image showing a small investor account being pulled back and forth by violent market swings, like repeated slaps from both directions. The feeling is exhausting rather than catastrophic. Realistic motion, high tension, Chinese stock market mood, no text.
```

### 8. 101-104 L0

- 文件：[101-104_maturity_l0_discretionary.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-104_maturity_l0_discretionary.md)
- 图型：`Concept`
- 建议图片数：`3`
- 封面方向：交易按钮上方悬着一团炽热情绪云，表示“心一热就下单”
- 封面提示词：

```text
A conceptual image of an investor's hand hovering over a buy button while a red-hot emotional cloud swirls above it. The idea is impulse-driven trading. Clean composition, premium dark finance style, emotional pressure, no text.
```

### 9. 101-42 Survivorship Bias

- 文件：[101-42_survivorship_bias.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-42_survivorship_bias.md)
- 图型：`Editorial`
- 建议图片数：`4`
- 封面方向：社交媒体里只有一张爆赚截图被高亮，周围大量灰掉的失败样本沉没
- 封面提示词：

```text
An editorial image of a social feed where one bright winning profit screenshot is highlighted while countless dim failed samples disappear into the background. Feels like selective visibility and illusion. Realistic interface-inspired composition without readable text.
```

### 10. 101-17 Tower Shield

- 文件：[101-17_tower_shield.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-17_tower_shield.md)
- 图型：`Concept`
- 建议图片数：`4`
- 封面方向：高速赛车冲向前方，而另一边是一座厚重安全屋，读者站在中间做选择
- 封面提示词：

```text
A symbolic split-scene: on one side a high-speed racing machine, on the other side a heavy safe house or shielded structure. A retail investor stands between them, forced to choose. Premium dark editorial style, highly symbolic, no text.
```

### 11. 101-13 Prediction Tax

- 文件：[101-13_prediction_tax.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-13_prediction_tax.md)
- 图型：`Hybrid`
- 建议图片数：`4`
- 封面方向：多人围着一个“明天会不会涨”的问号，像求签算命
- 封面提示词：

```text
A hybrid editorial-concept image of anxious investors surrounding a glowing question mark over a stock chart, like modern fortune-telling. The mood is desperate for certainty. Realistic Chinese retail investing atmosphere, premium dark palette, no text.
```

### 12. 101-15 Analyst vs Trader

- 文件：[101-15_analyst_vs_trader.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-15_analyst_vs_trader.md)
- 图型：`Concept`
- 建议图片数：`3`
- 封面方向：同一个人被一分为二，一半冷静做计划，一半盘中慌乱点单
- 封面提示词：

```text
A conceptual split-identity image: the same investor divided into two halves, one calmly planning at night, the other frantically trading during market hours. Strong contrast between order and panic. Dark premium finance style, no text.
```

### 13. 101-105 L1

- 文件：[101-105_maturity_l1_indicator.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-105_maturity_l1_indicator.md)
- 图型：`Concept`
- 建议图片数：`3`
- 封面方向：汽车司机只盯后视镜前进，前方道路模糊危险
- 封面提示词：

```text
A metaphorical finance image of a driver focusing only on the rear-view mirror while the road ahead blurs into danger. Used to represent lagging indicators. Premium dark editorial tone, realistic but symbolic, no text.
```

### 14. 101-14 EOD Edge

- 文件：[101-14_eod_edge.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-14_eod_edge.md)
- 图型：`Editorial`
- 建议图片数：`4`
- 封面方向：一个人被分时图牢牢吸住，另一侧盘后桌面安静整洁，形成对比
- 封面提示词：

```text
An editorial contrast image: on one side an investor glued to a flashing intraday chart, on the other side a calm post-market desk with notes and structure. The emotional difference is the key. Realistic, dark finance environment, no text.
```

### 15. 101-70 AI Guardrails

- 文件：[101-70_ai_guardrails.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-70_ai_guardrails.md)
- 图型：`Concept`
- 建议图片数：`4`
- 封面方向：一台看似聪明的 AI 机器冲向前方，但刹车线断裂
- 封面提示词：

```text
A conceptual image of an intelligent AI machine accelerating forward while its brake system is visibly broken or disconnected. The visual message is "smart but uncontrollable." Premium dark tech-finance style, realistic materials, no text.
```

### 16. 101-37 Black Swan Math

- 文件：[101-37_black_swan_math.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-37_black_swan_math.md)
- 图型：`Editorial`
- 建议图片数：`5`
- 封面方向：油价跳涨、地缘冲突新闻、市场暴跌三者叠在一张图里，但保持克制，不做廉价恐慌
- 封面提示词：

```text
A serious editorial macro-finance image blending geopolitical tension, rising oil price signals, and a sharp market selloff. It should feel credible and sober, not sensational. Real-world atmosphere, dramatic but controlled, no text, no propaganda look.
```

### 17. 101-32 Stateless Execution

- 文件：[101-32_stateless_execution.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-32_stateless_execution.md)
- 图型：`Concept`
- 建议图片数：`3`
- 封面方向：一条发光成本线像锁链一样绑住投资者
- 封面提示词：

```text
A conceptual finance image of a glowing cost-basis line turning into a chain wrapped around a retail investor. The line itself becomes the trap. Premium dark symbolic style, no text.
```

### 18. 101-106 Systematic Rules L2

- 文件：[101-106_systematic_rules_l2.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-106_systematic_rules_l2.md)
- 图型：`Concept`
- 建议图片数：`3`
- 封面方向：精密机器正在被校准，而不是展示“无敌系统”
- 封面提示词：

```text
A conceptual image of a precise financial machine being recalibrated by hand, emphasizing maintenance and correction rather than perfection. It should feel engineered, disciplined, and realistic. Dark premium tone, no text.
```

### 19. 101-59 MFE Truth

- 文件：[101-59_mfe_truth.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-59_mfe_truth.md)
- 图型：`Concept`
- 建议图片数：`3`
- 封面方向：一支偏离目标的箭，误打误撞落在金币旁，强调“赚了不代表打得准”
- 封面提示词：

```text
A conceptual image of an arrow missing the intended target but accidentally landing beside gold coins, representing lucky profit instead of skill. Clean, premium, dark editorial finance style, no text.
```

### 20. 101-71 Frozen Universe

- 文件：[101-71_frozen_universe.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/101_academy/101-71_frozen_universe.md)
- 图型：`Concept`
- 建议图片数：`3`
- 封面方向：海量股票代码像噪音飘散，只有少数标的被稳定圈定
- 封面提示词：

```text
A conceptual image of countless floating stock symbols dissolving into noise, while a small focused cluster remains sharply framed and calm. The message is selective attention and disciplined scope. Dark premium finance tone, no text.
```

## 六、执行建议

1. 当前 `top5` 文章优先出图。
2. 同一篇先出 `封面主图`，再补正文节奏图。
3. 小红书和头条优先复用封面主图，再做一张大字卡图。
4. 地缘、油价、电力、宏观类，优先用真实素材或强纪实感生成，不要做廉价 AI 拼贴。
5. 方法论和心智类，允许继续保留 `Silent Math` 的高级感，但必须增加“普通读者一眼就懂”的情绪锚点。
