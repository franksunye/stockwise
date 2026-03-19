---
title: "101-32: 删掉你的持仓成本线"
subtitle: "市场根本不在乎你亏了多少"
date: "2026-04-03"
category: "The Method"
funnel_stage: "MOFU"
rhythm: "Hub"
image: "/images/learn/101-32_stateless_execution.png"
image_prompt: "A conceptual 3D illustration of a floating monolith severing a fragile red thread. Swiss Design, Geometric, Minimalist. Dark Mode background (#050508). Action: Clean, emotionless detachment. Accent colors: Indigo (#6366f1) for the monolith, Rose Red (#f43f5e) for the severed thread. NO text."
publish:
  wechat:
    status: draft
    url: ""
  xhs:
    status: draft
    url: ""
  twitter:
    status: draft
  toutiao:
    status: draft
source_docs:
  - docs/0_Strategy/05_Quant_Signal_and_Execution_Axioms.md
  - docs/0_Strategy/06_Quant_Industry_Positioning_Map.md
---

# 删掉你的“持仓成本线”：无记忆的信号 (Stateless)

> “你买入的价格，是这个世界上最无关紧要的数据。”

当你打开交易软件，第一眼看的是什么？是这支股票的 K 线图，还是上面那根刺眼的“持仓成本线”？

如果你每天都在盯着自己到底“亏了 20%”还是“赚了 5%”，并以此来决定今天是买是卖，那么你已经败了。因为你给原本客观的指标，加上了极其主观的“情绪记忆”。

散户最喜欢说两句话：
“已经跌了 30% 了，总该反弹了吧？等回本我就卖。”
“已经赚了点，落袋为安吧，免得利润跑了。”

这两句话，是量化交易界最大的反面教材。

市场是一个包含了无数资金宏大博弈的汪洋大海。大盘根本不在乎你张三昨天是在什么价位买的，它也不会因为你“亏了 30%”就心生怜悯给你来个反弹。你的成本价，在千万亿的资金流动面前，连个原子都不是。

真正的专业信号必须是**无状态的（Stateless）**。这就好比温度计，它只如实反映当前是 30 度还是零下 10 度，它绝不会因为昨天你的水烧开了，就修改今天的刻度。

这就是为什么 ZISO 的核心系统架构被暴戾地一分为二：
**信号中心 (The Signal)** 只负责冰冷地扫描全市场的多空能量，它瞎了眼也看不到你账户里是一万还是一百万。
**投资模式 (The Execution)** 则严格根据你的总资金情况，机械地执行仓位和网格动作。

下一次看盘时，试着在软件里隐藏甚至删掉你的持仓均价。当你不再因“解套”而狂热，你才能看清真正的反转。
 
