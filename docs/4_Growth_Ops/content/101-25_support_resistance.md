---
title: "101-25: 支撑与压力 (Support & Resistance)"
subtitle: "为什么整数关口是心理战壕？"
date: "2026-02-04"
category: "The Method"
image: "/images/learn/support_resistance.png"
image_prompt: "A war map. A fortress wall labeled '$100.00' is being bombarded by green arrows from below. The wall is cracked but holding. Behind it, defenders (bears) are reinforcing the breach."
source_docs:
  - docs/0_Strategy/05_Quant_Signal_and_Execution_Axioms.md
  - docs/0_Strategy/06_Quant_Industry_Positioning_Map.md
---

# 支撑与压力：为什么整数关口是心理战壕？

> *"你可以不信邪，但你不能不信 100 块钱这个数字对人类大脑的魔力。"*

在 K 线图上，为什么股价总是在某些价格神奇地停下来，或者反弹？
这不是魔法，这是**群体记忆 (Collective Memory)**。

支撑位 (Support) 和 压力位 (Resistance) 就是股市战场上的战壕和碉堡。

---

## 1. 什么是支撑与压力？

### 🧱 支撑位 (Support) = 地板
*   **定义**：股价跌到这里，买盘力量 > 卖盘力量，把价格托住了。
*   **成因**：
    1.  **抄底大军**：上次跌到这就涨了，大家觉得这里"便宜"。
    2.  **踏空大军**：上次在这里没买，后悔死了，这次一定要补回来。
    3.  **被套大军（如果这里是之前的顶）**：解套了，不想卖了（支撑互换）。

### 🚧 压力位 (Resistance) = 天花板
*   **定义**：股价涨到这里，卖盘力量 > 买盘力量，把价格砸下去了。
*   **成因**：
    1.  **套牢盘**：上次在这里追高买入的人，套了半年，终于回本了！赶紧卖了解放自己！
    2.  **获利盘**：底部上来的人，觉得涨得差不多了，想落袋为安。

---

## 2. 整数关口的心理战

为什么 $100, $50, $20 这些整数（Round Numbers）总是成为关键点位？

因为人类的大脑喜欢凑整。
*   你不会对自己说："我想在 $98.43 卖出"。
*   你会说："涨到 $100 我就不玩了！"

当成千上万个散户和交易员都把 Limit Order (限价单) 挂在 $100.00 时，这里就形成了一道厚厚的**挂单墙 (Order Wall)**。
要想冲破这道墙，多头必须把这成千上万的卖单全部吃掉。这需要巨量的资金（成交量配合）。

---

## 3. ZISO 的 AI 怎么画线？

你不需要自己去连线。
ZISO 的 `Quantitative Engine` 会扫描过去 250 天的 K 线，通过聚类算法自动寻找：

*   **Swing Highs/Lows**：那些最尖锐的转折点。
*   **Volume Nodes**：成交量最密集的成交区（筹码峰）。

AI 会告诉你：
> **关键阻力位：$175.50**
> *(注：此为 2025年3月的前高，且是 MA60 所在处)*

### ⚠️ 交易策略：别在压力位买入！

这是散户最常犯的错误：
看着大涨，兴奋地追进去买入。结果刚买进去，股价就在 $100 见顶回落。
因为你买在了碉堡门口。

**ZISO AI 的纪律建议**：
*   **做多**：在支撑位附近买（盈亏比极高），或者等等效突破压力位并**回踩确认**后买。
*   **做空**：在压力位附近卖，或者等跌破支撑位并**反抽不过**后卖。

记住：**Buy at Support, Sell at Resistance.** (在支撑买，在压力卖)。
这句话听起来像废话，但它是这行唯一的真理。

---
*下一篇：[101-26] 形态学：双底、头肩顶与 AI 的模式识别。*
 
