---
title: "Position Budget SEO/GEO Aggressive Expansion Plan"
doc_id: "growth-position-budget-seo-geo-aggressive-expansion-20260513"
doc_domain: "growth_ops"
doc_status: "active"
owner: "cmo"
last_reviewed_at: "2026-05-13"
summary: "把仓位预算插件的 SEO/GEO 从 5 个验证词扩展为分层关键词组合，并定义 14 天观测窗口内的 12 篇内容支撑矩阵。"
source_docs:
  - "docs/3_Product/Specs/trade_management/57_Position_Budget_Plugin_P0_Spec_20260511.md"
  - "frontend/src/content/seo-position-budget.ts"
  - "docs/4_Growth_Ops/content/en/101_academy/what-is-position-size-calculator.md"
  - "docs/4_Growth_Ops/content/en/101_academy/calculate-stock-position-size-before-trade.md"
---

# Position Budget SEO/GEO Aggressive Expansion Plan

## 1. 结论

本轮不建议把可见页面 title / description 同时塞进 20-50 个词。两周窗口太短，页面主假设必须稳定：**`position size calculator` 仍是主入口词，`stock position size calculator` 是股票场景长尾，其他词进入 keywords、JSON-LD、FAQ 与内容矩阵。**

建议本轮采用：

1. **50 个左右页面关键词信号词**：写入 `frontend/src/content/seo-position-budget.ts` 的 `keywords` 与 JSON-LD；更宽的候选词保留在本文矩阵和后续内容标题中。本轮 Chrome / Google Trends 复核后，页面实际保留 **54 个去重词**，删除 `lotaje` 等外汇 lot 词。
2. **12 篇支撑内容**：先做 4 篇已发布文章 + 8 篇新增高意图文章，而不是一次性做 20 篇。两周内更重要的是让 Search Console 出现可判断的 query 分布。
3. **14 天观测窗口**：第 7 天只看索引与异常，第 14 天看 GSC/Bing 的 query、国家、CTR 与 GEO 抽样。

## 2. Google Trends 研究结论

研究口径：Chrome 登录态打开 Google Trends，地区按组切换，时间为 **Past 12 months / Web Search**，每组最多 5 个词。Trends 数字是组内归一化平均值，只用于判断相对优先级，不等同绝对搜索量。

### 2.1 US 核心工具词

| 关键词 | Trends 平均值 | 结论 |
| --- | ---: | --- |
| `position size calculator` | 46 | 继续作为 title / H1 / description 主词 |
| `stop loss calculator` | 14 | 有信号，但宽泛且会污染，需要带 stock / position size 上下文 |
| `trading risk calculator` | 6 | 保留为二级工具词 |
| `risk reward ratio calculator` | 1 | 只做 R:R 支撑，不抢主词 |
| `stock position size calculator` | 0 | Trends 量级低，但在 `position size calculator` 相关查询中为 Rising +50%，适合作长尾和站内内容 |

Trends URL: https://trends.google.com/trends/explore?geo=US&q=position%20size%20calculator,stock%20position%20size%20calculator,trading%20risk%20calculator,stop%20loss%20calculator,risk%20reward%20ratio%20calculator

### 2.2 US 扩展词复核

| 关键词 | Trends 平均值 | 结论 |
| --- | ---: | --- |
| `risk per share` | 39 | 本轮上调为 P0 内容词，直接解释 position size 公式 |
| `risk per trade` | 24 | 本轮上调为 P0 内容词，适合做独立文章 |
| `share size calculator` | 23 | 本轮上调为高优先级页面 / FAQ 词 |
| `position sizing calculator` | 4 | 保留为同义词 |
| `risk per trade calculator` | 3 | 保留为文章标题词 |
| `ATR stop loss calculator` | 2 | 保留为 P1 支撑词，不承诺当前工具自动算 ATR 止损 |
| `shares to buy calculator` | 2 | 保留为问题式长尾 |
| `expected loss calculator` | 2 | 保留为 BOFU 风险预算词 |
| `1% risk calculator` | 0 | 降级；不要把 1% 规则当作主流量入口 |
| `1% rule trading` / `2% rule trading` | 0 | 降级为教育内容，不写成页面主信号 |

### 2.3 Related Queries

`position size calculator` 的 Rising related queries：

| 相关查询 | Trends 标记 | 动作 |
| --- | --- | --- |
| `mt5 position size calculator` | Breakout | 排除，不做 MT5/外汇承诺 |
| `my fx book position size calculator` | +500% | 排除，偏外汇工具替代词 |
| `xauusd position size calculator` | +70% | 排除，偏黄金/合约 |
| `stock position size calculator` | +50% | 采纳，作为股票长尾词 |

### 2.4 KR / ES / MX GEO

| 地区 | 关键词组结果 | 结论 |
| --- | --- | --- |
| KR | `position size calculator` 平均 2；韩语直译组均为 0 | 保持英文主词 + 韩文解释，不新增韩语页面 |
| ES | `calculadora trading` 平均 4；`calculadora lotaje` 平均 3；其余为 0 | `calculadora trading` 可保留；`lotaje` 虽有量但偏 Forex，页面 metadata 删除 |
| MX | `calculadora lotaje` 平均 2；`calculadora de riesgo trading` 平均 2；其余为 0 | 保留 `calculadora de riesgo trading`，不追 `lotaje` |
| US 污染检查 | `lot size calculator` 平均 42，`position size calculator` 平均 34，`forex position size calculator` 平均 2 | lot/lotaje 词强但错配，排除出页面关键词 |

## 3. 外部搜索形态

2026-05-13 抽样 SERP 显示，竞品页面基本围绕以下输入和语义组织：

| 观察 | 对 ZISO 的含义 |
| --- | --- |
| `position size calculator` 页面通常直接解释 account risk、entry、stop loss、shares/units | 主词必须继续放在 title、H1、description 前段 |
| 股票专用页会强调 `shares to buy`、`risk per share`、`stop-loss level`、`risk-reward ratio` | ZISO 应吃股票专用长尾，而不是泛 Forex lot size |
| 很多工具页把 `risk/reward calculator`、`stop loss calculator`、`ATR stop loss` 作为相邻工具 | 内容矩阵要覆盖相邻问题词，把工具页作为核心转化页 |
| Reddit/社区问题集中在“我到底该买多少股”“1% 风险怎么落到数量”“TradingView 有没有类似工具” | FAQ 和文章标题要使用问题式标题，不只写概念解释 |
| 西语 `lotaje` 流量偏 Forex，韩语直译弱 | `ko/es` 只做 GEO 解释和辅助词；`lotaje` 从页面关键词删除，不新增伪 locale URL |

参考抽样来源：

- Calcipedia Position Size Calculator: https://www.calcipedia.org/calculators/position-size-calculator/
- Stock Titan Stock Position Size Calculator: https://www.stocktitan.net/tools/position-size
- The Arca Labs Stock Position Size Calculator: https://thearcalabs.com/en/stock/position-size/
- Chart Guys Position Sizing article: https://www.chartguys.com/articles/position-sizing
- CrossTrade 1% Rule article: https://crosstrade.io/learn/risk-management/one-percent-rule
- TradeLyser ATR Stop Loss Calculator: https://www.tradelyser.com/tools/atr-stop-loss-calculator

## 4. 关键词矩阵

### 4.1 P0 / P1 页面级关键词

这些是页面和内容共用的候选池；其中最高相关的一组进入 `seo-position-budget.ts` 的 metadata / JSON-LD，其余进入 FAQ、文章标题和站内锚文本。不全部进入 title。

| 簇 | 关键词 | 用途 |
| --- | --- | --- |
| 核心工具 | `position size calculator`, `stock position size calculator`, `trading position size calculator`, `position sizing calculator`, `stock position sizing calculator` | 主页面、JSON-LD、站内锚文本 |
| 股票数量 | `share size calculator`, `shares to buy calculator`, `how many shares to buy calculator`, `stock shares calculator`, `stock trading calculator` | FAQ、How-to 文章、工具页说明；`share size calculator` 已上调为高优先级 |
| 风险预算 | `risk per share`, `risk per trade`, `risk per trade calculator`, `trade risk calculator`, `trading risk calculator`, `trading risk management calculator`, `risk management calculator`, `stock risk calculator` | 风险教育文章、工具页 featureList；`risk per share` / `risk per trade` 优先级高于 1% rule |
| 止损 | `stop loss calculator`, `stock stop loss calculator`, `stop loss position size calculator`, `stop loss share calculator`, `entry stop target calculator` | 止损专题与 FAQ |
| 盈亏比 / R | `risk reward calculator`, `risk reward ratio calculator`, `risk to reward ratio calculator`, `R-multiple calculator`, `R:R calculator`, `R multiple trading` | R 纪律内容、工具结果区说明 |
| 1% / 2% 规则 | `1% risk calculator`, `2% risk calculator`, `1% rule trading`, `2% rule trading` | Trends 显示弱，降级为教育内容，不作为页面主信号 |
| 波动率 | `ATR position sizing`, `ATR stop loss calculator`, `volatility based position sizing` | P1 内容，不承诺工具已自动生成 ATR 止损 |
| 预算 / 计划 | `risk budget calculator`, `account risk calculator`, `expected loss calculator`, `maximum loss calculator`, `trade management calculator`, `pre trade checklist`, `free position size calculator`, `position budget` | ZISO 差异化与 BOFU 转化 |

### 4.2 中文 / GEO 辅助词

| 语言 | 关键词 | 动作边界 |
| --- | --- | --- |
| CN | `仓位预算`, `头寸计算`, `头寸计算器`, `单笔风险控制`, `1%风险规则`, `止损仓位`, `止损计算器`, `盈亏比计算器`, `R倍数`, `港股仓位`, `美股仓位`, `A股仓位` | 用于 JSON-LD / keywords / 中文解释，不改变英文主页面定位 |
| KO | `position size calculator`, `포지션 사이즈 계산기`, `주식 포지션 계산기`, `손절 계산기`, `위험 보상 비율 계산기` | 保持英文主词 + 韩文解释 |
| ES | `position size calculator`, `calculadora trading`, `calculadora de trading`, `calculadora de riesgo trading` | `lotaje` 观察到 Trends 信号，但因 Forex/lot 语义错配，排除出页面关键词 |

## 5. 内容支撑矩阵

两周冲刺建议做到 **12 篇**，不是 20 篇。原因：当前站点已有 4 篇英文支撑内容，新增 8 篇足以覆盖主要长尾；一次上 20 篇容易稀释质量，也难以在 14 天内判断是哪一簇起效。

### 5.1 已发布内容

| 文章 | 覆盖词 |
| --- | --- |
| `what-is-position-size-calculator.md` | `position size calculator`, `position sizing calculator` |
| `calculate-stock-position-size-before-trade.md` | `stock position size calculator`, `how many shares to buy calculator` |
| `post-close-stock-research-routine.md` | `pre trade checklist`, `trade management calculator` |
| `ai-stock-analysis-can-and-cannot-do.md` | `AI stock analysis` 到风险预算工具的桥接 |

### 5.2 新增 8 篇已落地内容

| 优先级 | 文件 | 目标词 | 漏斗 | 角色 |
| --- | --- | --- | --- | --- |
| P0 | `en/101_academy/how-many-shares-should-i-buy-risk-per-trade.md` | `how many shares to buy calculator`, `risk per trade` | MOFU | conversion |
| P0 | `en/101_academy/risk-per-share-vs-risk-per-trade.md` | `risk per share`, `risk per trade` | MOFU | conversion |
| P0 | `en/101_academy/risk-per-trade-calculator-share-count.md` | `risk per trade calculator`, `share size calculator` | MOFU | conversion |
| P0 | `en/101_academy/stop-loss-position-size-calculator.md` | `stop loss position size calculator`, `stock stop loss calculator` | MOFU | conversion |
| P0 | `en/101_academy/risk-reward-ratio-vs-position-size.md` | `risk reward ratio calculator`, `position sizing calculator` | MOFU | bridge |
| P1 | `en/101_academy/atr-position-sizing-wider-stop-fewer-shares.md` | `ATR position sizing`, `ATR stop loss calculator` | MOFU | bridge |
| P1 | `en/101_academy/expected-loss-calculator-before-trade.md` | `expected loss calculator`, `maximum loss calculator` | MOFU | conversion |
| P1 | `en/101_academy/pre-trade-checklist-entry-stop-target-position-size.md` | `pre trade checklist`, `entry stop target calculator` | BOFU | conversion |

### 5.3 暂不建议新增的 8 篇

以下主题可以进入下轮，但不建议塞进本次 14 天窗口：

| 主题 | 暂缓原因 |
| --- | --- |
| Forex lot size calculator | 与股票工具定位不一致，容易引入不匹配流量 |
| Crypto position size calculator | 当前工具虽可手输 symbol，但产品叙事未承诺 crypto |
| Options position size calculator | 期权风险结构不同，不能用同一公式承诺 |
| Futures contract size calculator | 合约乘数 / 保证金口径不同 |
| Margin calculator | 与仓位预算相邻，但不是 P0 能力 |
| Portfolio heat calculator | 很有价值，但属于 P1/P2 组合风险能力 |
| TradingView position sizing indicator | 可做竞品/替代方案词，但需要更谨慎的比较页 |
| Kelly criterion position sizing | 已有中文 101，可后续做英文扩展，不抢本次工具词窗口 |
| The 1% rule in stock trading | Google Trends 本轮显示弱；保留为教育内容，不抢两周窗口 |

## 6. 页面与内容执行顺序

| Day | 动作 | 输出 |
| --- | --- | --- |
| D0 | 扩展 `seo-position-budget.ts` keywords；保留 title / description 主假设 | 页面级信号扩容，不改变主词 |
| D0-D2 | 新增 P0 4 篇文章 | 覆盖股票数量、1% 风险、止损仓位、R:R 相邻词 |
| D3-D5 | 新增 P1 4 篇文章 | 覆盖 ATR、expected loss、pre-trade checklist |
| D7 | 技术 Check | `check:position-budget-seo` + sitemap + 索引异常 |
| D14 | 数据 Check | GSC/Bing query、CTR、国家、GEO 抽样 |

## 7. 成功判据

| 层级 | 判据 |
| --- | --- |
| 技术 | `/tools/position-budget` 仍为唯一 canonical；metadata / JSON-LD / sitemap 检查通过 |
| 搜索 | GSC 对该 URL 或支撑内容出现至少 5 个非品牌 query impression |
| 长尾 | 至少出现 `stock position size calculator`、`share size calculator`、`risk per share`、`risk per trade`、`stop loss`、`risk reward` 相关 query 中的 2 簇 |
| GEO | AI 搜索抽样能正确描述工具为风险预算 / 仓位计算工具，不承诺收益 |
| 转化 | 工具页从 Learn 支撑内容获得可追踪入口点击，哪怕量小也要能归因 |

## 8. Act 规则

1. 若 `position size calculator` 有展示但 CTR 低：优先改 description，不改主词。
2. 若 `stock position size calculator` 有展示：补强股票专用 FAQ 与 shares 语言。
3. 若 `stop loss calculator` 带来非交易污染：降级该词，只保留 `stock stop loss calculator` 和 `stop loss position size calculator`。
4. 若西语需要扩展：先观察 `calculadora trading` / `calculadora de riesgo trading`；`lotaje` 不回到 metadata，除非未来产品明确支持 Forex lot sizing。
5. 若支撑文章先起量：把对应文章作为内链入口，不急着让工具页吃所有词。
