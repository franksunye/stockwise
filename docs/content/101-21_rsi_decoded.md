---
title: "101-21: RSI 指标新解"
subtitle: "别再傻傻地看超买超卖了"
date: "2026-02-04"
category: "The Method"
image: "/images/learn/rsi_divergence.png"
image_prompt: "A minimalist line chart showing price making a higher peak, while a glowing neon line below (RSI) makes a lower peak. A red warning triangle floats between them. Dark background, cyber-financial aesthetic."
---

# RSI 指标新解：别再傻傻地看"超买"了

> *"如果你只因为 RSI 大于 70 就卖出，那你会在牛市里亏得底裤都不剩。"*

相对强弱指数 (RSI) 是这一行里最流行，但也最被误解的指标。
随便一本教科书都会告诉你：
*   RSI > 70：超买 (Overbought)，卖出！
*   RSI < 30：超卖 (Oversold)，买入！

**这是错的。** 或者说，这是极其片面的。
在强劲的单边行情（比如主升浪）中，RSI 可以在 80 以上钝化（Hover）好几个星期。如果你在它刚到 70 时就做空，或者卖飞了，那你就是在给市场送钱。

---

## 1. RSI 的本质：油门踏板

把股价想象成一辆正在爬坡的车。
RSI 就是**油门深浅**的读数。

*   **RSI = 50**：油门踩了一半，速度适中。
*   **RSI = 80**：地板油，引擎轰鸣，速度极快。

**关键在于**：当你把油门踩到底（RSI > 80）时，车子会立刻停下来吗？
当然不会！车子会以**最快**的速度继续冲刺！这叫**惯性 (Momentum)**。

所以，RSI 进入"超买区"，往往意味着趋势**最强劲**的时候。这时候逆势做空，就像站在一辆全速冲刺的法拉利面前试图挡住它——找死。

---

## 2. 真正该看什么？背离 (Divergence)

既然不要看数值，那看什么？
**看"不一样"的地方。**

当车速越来越快（股价创新高），但你的油门却开始松了（RSI 不创新高），这就出问题了。这叫 **"顶背离" (Bearish Divergence)**。

*   **场景**：
    *   股价：突破前高，涨到了 $105。🎉
    *   RSI：上次高点是 85，这次高点只有 75。📉

这意味着：虽然车还在往前走，但引擎已经没劲了。多头部队已经是强弩之末，全靠惯性在飘。
**这时候，才是真正的危险信号。**

反之亦然。当股价跌破新低，但 RSI 底部抬高时（底背离），说明空头砸不动了。

---

## 3. StockWise 的 AI 怎么用 RSI？

我们的 AI 并不关心 RSI 是 70 还是 30。它关心的是 **"RSI 处于哪个区间" (Regime)** 和 **"结构" (Structure)**。

### 🤖 AI 决策逻辑：

1.  **趋势过滤器**：
    *   如果 RSI 长期维持在 50 以上，AI 会判定为 **Bullish Market**。此时所有的"超买"信号都会被降权（忽略）。
    *   只有当 RSI 跌破 50 中轴并反抽不过时，AI 才会认为趋势坏了。

2.  **背离猎手 (Divergence Hunter)**：
    *   AI 会扫描过去 20 个交易日的峰值。
    *   如果发现 `Price_New_High` 但 `RSI_Lower_High`，AI 的置信度 (Confidence) 会瞬间从 0.8 降到 0.4，并发出警告：**"动能衰竭风险"**。

### 给你的建议：

下次看到 RSI 到 80 时，别慌着卖。
盯着它。只有当它**掉头向下**，并且**跌破之前的低点**（Swing Low），或者出现了明显的**背离**时，那才是派对结束的铃声。

**记住：RSI 是动能的温度计，不是红绿灯。**

---
*下一篇：[101-22] 均线系统 (MA)：均线不是线，是成本。*
