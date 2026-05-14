---
title: "Homepage SEO/GEO Aggressive Expansion Plan"
doc_id: "growth-homepage-seo-geo-aggressive-expansion-20260514"
doc_domain: "growth_ops"
doc_status: "active"
owner: "cmo"
last_reviewed_at: "2026-05-14"
summary: "把主站首页从 11 个基线关键词扩展为分层关键词池，并定义两周观测窗口内的主站内容支撑矩阵。"
source_docs:
  - "docs/4_Growth_Ops/51_Homepage_SEO_Keyword_Baseline_20260513.md"
  - "docs/4_Growth_Ops/40_Annual_Content_Strategy_2026.md"
  - "frontend/src/content/seo-home.ts"
  - "docs/4_Growth_Ops/content/en/101_academy/ai-stock-analysis-can-and-cannot-do.md"
  - "docs/4_Growth_Ops/content/en/101_academy/post-close-stock-research-routine.md"
---

# Homepage SEO/GEO Aggressive Expansion Plan

## 1. 结论

主站也需要和仓位预算工具页一样的闭环，但边界不同：**首页不是一个单一工具页，不能只围绕一个 calculator 词簇扩展。**

本轮建议采用：

1. **约 50 个英文首页关键词信号词**：写入 `frontend/src/content/seo-home.ts` 的 `keywords` 与 JSON-LD；但 title / description 继续稳定围绕 `AI stock analysis` + `stock research`，不改成关键词堆砌。
2. **4 个主站主题簇**：AI 股票分析、股票研究 App / 工具、风险与决策支持、盘后复盘 / 自选股工作流。仓位预算属于风险与执行簇的支撑工具，不是主站总盘。
3. **两周内容支撑先做到 12-16 篇总量**：当前英文 Learn 已有 4 篇直接支撑主站 / 仓位预算。主站下一步优先新增 8 篇高意图文章，而不是一次性扩到 20 篇。
4. **14 天观测窗口**：第 7 天看技术收录与异常；第 14 天看 GSC/Bing query、国家、CTR、文章入口到首页 / app 的路径，以及 GEO 抽样是否把 ZISO 描述为研究和决策支持工具。

## 2. 当前基线

`51_Homepage_SEO_Keyword_Baseline_20260513.md` 已确认首页主入口词：

| 层级 | 关键词 | 当前动作 |
| --- | --- | --- |
| P0 | `AI stock analysis` | title / description / keywords / JSON-LD 主词 |
| P0 | `stock research` | 首页 broad category phrase |
| P1 | `stock analysis app` | 次级产品词 |
| P1 | `AI stock research` | GEO / semantic phrase |
| P2 | `stock market analysis` | 只进支撑文案，不抢主 title |
| 边界 | `stock prediction` | 不作为首页承诺，只保留为 `stock prediction research` |

本轮不推翻这个基线，只扩展同一语义场。

## 3. Google Trends 实测结论

研究口径：Chrome 登录态打开 Google Trends，地区 **United States**，时间 **Past 12 months**，类型 **Web Search**。每组最多 5 个词，Trends 数字是组内归一化平均值，只用于判断相对优先级，不等同绝对搜索量。

### 3.1 首页核心需求词

Trends URL: https://trends.google.com/trends/explore?geo=US&q=AI%20stock%20analysis,stock%20research,stock%20analysis%20app,AI%20stock%20research,stock%20prediction&hl=en-US

| 关键词 | Trends 平均值 | 结论 |
| --- | ---: | --- |
| `stock research` | 37 | 继续作为首页 broad category 主词 |
| `stock prediction` | 23 | 有量但污染强；只保留为边界词 `stock prediction research` |
| `AI stock analysis` | 8 | 继续作为 AI 差异化主词，但不是唯一高量入口 |
| `AI stock research` | 7 | 作为 GEO / semantic phrase 保留 |
| `stock analysis app` | 3 | 有产品形态信号，但弱于 `stock research app` |

相关查询提示：

- `AI stock analysis` Rising related queries 出现 `ai news today`、`stock market news today`、`stock market news`，说明 AI 词容易被新闻意图稀释。
- `stock prediction` Rising related queries 出现 `figma stock price prediction`、`crcl stock`、`dvlt stock` 等 ticker-specific 预测意图，验证其不适合作首页承诺。

### 3.2 App / Tool 词组

Trends URL: https://trends.google.com/trends/explore?geo=US&q=stock%20research%20app,AI%20stock%20research%20tool,stock%20analysis%20tool,AI%20stock%20analysis%20tool,stock%20market%20research%20tool&hl=en-US

| 关键词 | Trends 平均值 | 结论 |
| --- | ---: | --- |
| `stock research app` | 42 | 上调为 P0；首页 title 已含 `Stock Research App`，保持 |
| `stock analysis tool` | 21 | 上调为 P1；适合内容标题与 FAQ |
| `AI stock analysis tool` | 6 | 保留为 AI 语义长尾 |
| `AI stock research tool` | 5 | 保留，但不抢主词 |
| `stock market research tool` | 2 | 降级为辅助词 |

相关查询提示：

- `AI stock research tool`、`AI stock analysis tool`、`stock market research tool` 的 Related queries 数据不足，说明这些是合理语义词，但短期不应独立建太多内容页。

### 3.3 风险 / 自选股 / 简报词组

Trends URL: https://trends.google.com/trends/explore?geo=US&q=daily%20market%20briefing,stock%20watchlist%20app,stock%20alerts%20app,stock%20risk%20analysis,trade%20planning%20app&hl=en-US

| 关键词 | Trends 平均值 | 结论 |
| --- | ---: | --- |
| `stock risk analysis` | 38 | 上调为 P0/P1 支撑簇；比简报和提醒词更强 |
| `stock alerts app` | 4 | 保留为功能长尾 |
| `trade planning app` | 2 | 保留为 BOFU / 执行计划长尾 |
| `daily market briefing` | 0 | 降级；作为产品叙事和内容文案，不作为短期 SEO 主词 |
| `stock watchlist app` | 0 | 降级；但 Related query 有 `best stock watchlist app`，可作为后续内容题 |

相关查询提示：

- `stock watchlist app` Top related query 出现 `best stock watchlist app`（100），可用于后续对比/选择型内容，不建议直接塞进首页 title。
- `stock alerts app` Rising related query 出现 `best app for stock alerts`（+50%），可作为 Support / BOFU 文章标题。
- `stock risk analysis` Rising related queries 仍有 `stock market news today`、`meta stock price` 等新闻 / ticker 污染，内容需要明确“risk analysis before buying”，避免变成新闻页。

### 3.4 受众 / 决策支持词组

Trends URL: https://trends.google.com/trends/explore?geo=US&q=retail%20investor%20tools,self%20directed%20investor%20tools,investment%20research%20assistant,AI%20investing%20assistant,stock%20decision%20support&hl=en-US

| 关键词 | Trends 平均值 | 结论 |
| --- | ---: | --- |
| `stock decision support` | 41 | 上调为 P0/P1；非常贴合 ZISO 的非荐股定位 |
| `investment research assistant` | 18 | 保留为主站辅助词 |
| `AI investing assistant` | 13 | 保留为 AI 产品词 |
| `retail investor tools` | 5 | 保留为受众语义，不独立做 P0 |
| `self directed investor tools` | 0 | 降级，只作为文案描述 |

关键结论：

1. 首页主词应从“AI stock analysis 单点”扩展成 **`stock research app` + `stock decision support` + `stock risk analysis` + `AI stock analysis`** 的组合。
2. `stock prediction` 有量但 ticker 污染严重，继续不得进入 title / H1 主承诺。
3. `daily market briefing`、`stock watchlist app`、`self directed investor tools` 不能作为本轮 P0；可保留在 feature copy、FAQ 或后续长尾内容里。

## 4. 外部搜索形态

2026-05-14 抽样 SERP 显示，AI 股票研究类竞品普遍用以下语义组织首页：

| 观察 | 对 ZISO 的含义 |
| --- | --- |
| `AI stock analysis` / `AI stock research` 页面通常直接强调 ticker research、AI-generated report、risk score、plain-English explanation | 首页需要继续打 AI 股票分析和股票研究，不要回到内部技术名 |
| 竞品常用 `retail investors`、`self-directed investors`、`everyday investors` 描述受众 | ZISO 首页可强化 serious retail investors / self-directed investors |
| 多数页面混合 `prediction`、`stock picks`、`signals` | ZISO 不能把 prediction/picks/signals 放到 title 里，否则会吸引错误预期 |
| 高意图页面常把 `risk analysis`、`portfolio risk`、`watchlist`、`market briefing` 与 AI research 绑定 | 主站内容矩阵应把风险、盘后简报、自选股工作流放到同一个主站簇 |
| 新 AI stock app 在 Reddit / indie 场景里常被用户追问“是否只是包装 ChatGPT / 是否可信 / 是否替我买卖” | GEO/FAQ 内容必须主动解释边界、证据链和非荐股定位 |

参考抽样来源：

- IndexAlpha: https://indexalpha.ai/
- StockFox: https://www.stockfox.pro/
- Kabra: https://www.kabra.io/
- Trsvest: https://www.trsvest.com/
- Peakwise: https://peakwise.ai/
- eZorro: https://ezorro.app/
- AlphaCrew: https://www.alphacrew.ai/

## 5. 主站关键词矩阵

### 5.1 P0 / P1 首页级关键词

| 簇 | 关键词 | 用途 |
| --- | --- | --- |
| AI 股票分析 | `AI stock analysis`, `AI stock analysis app`, `AI stock analysis tool`, `AI stock market analysis`, `explainable AI stock analysis`, `AI stock reasoning`, `AI stock reports` | 首页 metadata、JSON-LD、FAQ、主站锚文本 |
| 股票研究 / 工具 | `stock research`, `stock research app`, `stock analysis tool`, `AI stock research`, `AI stock research app`, `AI stock research tool`, `stock market research app`, `equity research tool`, `AI equity research` | 首页和 Learn 主簇；`stock research app` 上调为 P0 |
| 受众 / 使用场景 | `investment research assistant`, `AI investing assistant`, `retail investor research tool`, `retail investor tools`, `self directed investor tools`, `stock research for retail investors`, `stock analysis for retail investors` | GEO、FAQ、About、内容标题 |
| 风险与决策支持 | `stock risk analysis`, `stock risk management`, `stock risk assessment`, `stock decision support`, `investment decision support`, `trading discipline`, `trade planning app`, `next session trading plan` | 与仓位预算、交易管理、盘后计划相互内链；`stock decision support` / `stock risk analysis` 上调 |
| 盘后复盘 | `post-close market research`, `post market stock analysis`, `after hours stock research`, `market close stock research`, `daily stock research`, `daily market briefing`, `stock market briefing app`, `AI market briefing` | 内容矩阵和首页 feature 语义；`daily market briefing` 降级为叙事词 |
| 自选股 / 提醒 | `watchlist analysis`, `stock watchlist app`, `best stock watchlist app`, `stock watchlist alerts`, `stock alerts app`, `best app for stock alerts` | 功能页、Support、BOFU 文章；watchlist 词不抢首页 |
| 市场覆盖 | `US stock analysis`, `Hong Kong stock analysis`, `China A-share analysis`, `global stock research` | 多市场 GEO / FAQ，不单独承诺全资产覆盖 |

### 5.2 受控词与排除词

| 词 | 处理 |
| --- | --- |
| `stock prediction` | 只保留 `stock prediction research`，用于解释“研究预测边界”，不做首页 promise |
| `AI stock picker` | 暂不作为首页目标词，容易引导到荐股 / picks 心智 |
| `best stocks to buy` | 不进首页关键词，除非做明确的教育型反向文章 |
| `stock signals` | 不进首页 title；仅在解释“不是喊单信号”时使用 |
| `trading bot` / `auto trading` | 排除，ZISO 不做自动交易执行 |
| `forex` / `crypto` / `options` | 排除首页关键词，除非对应产品能力上线 |

### 5.3 中文 / KO / ES GEO 辅助词

| 语言 | 关键词方向 | 动作边界 |
| --- | --- | --- |
| CN | `AI 股票分析`, `股票分析工具`, `盘后复盘`, `AI 投研助手`, `股票投研工具`, `自选股分析`, `股票风险管理`, `投资决策辅助` | 进入 `/cn` metadata / JSON-LD；不改英文 canonical 主词 |
| KO | `AI stock analysis`, `stock research`, `AI 주식 분석`, `주식 리서치 앱`, `시장 마감 후 분석`, `개인 투자자 리서치` | 保持英文主词 + 韩文解释 |
| ES | `AI stock analysis`, `stock research`, `analisis de acciones con IA`, `app de investigacion bursatil`, `asistente de inversion con IA` | 保留英文主词泄漏，西语词做 GEO 解释 |

## 6. 内容支撑矩阵

首页比仓位预算更宽，因此两周内建议做到 **12-16 篇总量**。当前已有 4 篇直接相关内容；下一步先新增 8 篇主站高意图内容。若 D14 数据显示某个簇已经有 impressions，再继续扩到 20 篇。

### 6.1 已发布支撑内容

| 文章 | 覆盖词 | 角色 |
| --- | --- | --- |
| `ai-stock-analysis-can-and-cannot-do.md` | `AI stock analysis`, `AI stock research`, `AI stock analysis app` | 主站核心边界文章 |
| `post-close-stock-research-routine.md` | `post-close market research`, `stock research`, `daily stock research` | 盘后复盘工作流 |
| `what-is-position-size-calculator.md` | `position size calculator`, `stock risk management` | 风险工具桥接 |
| `calculate-stock-position-size-before-trade.md` | `stock position size calculator`, `trade planning app` | 交易计划桥接 |

### 6.2 下一轮优先新增 8 篇

| 优先级 | 建议文件 | 目标词 | 漏斗 | 角色 |
| --- | --- | --- | --- | --- |
| P0 | `best-stock-research-app-for-retail-investors.md` | `stock research app`, `retail investor research tool` | MOFU | bridge |
| P0 | `stock-decision-support-vs-stock-prediction.md` | `stock decision support`, `stock prediction` boundary | MOFU | bridge |
| P0 | `stock-risk-analysis-before-buying.md` | `stock risk analysis`, `stock risk assessment` | MOFU | conversion |
| P0 | `stock-analysis-tool-vs-ai-stock-picker.md` | `stock analysis tool`, `AI stock picker` boundary | MOFU | bridge |
| P1 | `explainable-ai-stock-analysis-reasoning-trace.md` | `explainable AI stock analysis`, `AI stock reasoning` | MOFU | bridge |
| P1 | `post-market-stock-analysis-next-session-plan.md` | `post market stock analysis`, `next session trading plan` | BOFU | conversion |
| P1 | `ai-investing-assistant-not-trading-bot.md` | `AI investing assistant`, `stock decision support` | BOFU | boundary |
| P1 | `best-stock-watchlist-app-with-risk-alerts.md` | `best stock watchlist app`, `best app for stock alerts` | BOFU | conversion |

### 6.3 暂缓主题

| 主题 | 暂缓原因 |
| --- | --- |
| Best stocks to buy with AI | 容易变成荐股 / picks 语义，不适合当前合规边界 |
| AI stock signals | 信号词有量，但会削弱“研究 + 决策支持”定位 |
| Auto trading bot | 产品不做自动执行 |
| Crypto / Forex AI analysis | 当前主站定位是股票，不扩错配资产 |
| Options AI analysis | 风险结构不同，需单独能力与免责声明 |
| AI portfolio optimizer | 方向重要，但需要等 Paper Portfolio / portfolio risk 能力更完整 |
| Daily market briefing 独立 SEO 页 | Trends 平均值为 0，短期只作为产品叙事和站内文案 |
| Self-directed investor tools 独立 SEO 页 | Trends 平均值为 0，短期只作为受众描述 |

## 7. 执行顺序

| Day | 动作 | 输出 |
| --- | --- | --- |
| D0 | 扩展 `seo-home.ts` keywords，保持 title / description 主假设 | 页面级信号扩容 |
| D0-D2 | 复核首页 JSON-LD 与 sitemap 技术检查 | 确保首页和 localized home 可抓取 |
| D1-D5 | 新增 P0 4 篇主站支撑内容 | stock research app / stock decision support / stock risk analysis / stock analysis tool |
| D5-D9 | 新增 P1 4 篇主站支撑内容 | explainable AI / next-session plan / not trading bot / watchlist alerts |
| D7 | 技术 Check | sitemap、metadata、JSON-LD、索引异常 |
| D14 | 数据 Check | GSC/Bing query、CTR、国家、GEO 抽样 |

## 8. 成功判据

| 层级 | 判据 |
| --- | --- |
| 技术 | `/`、`/cn`、`/ko`、`/es` metadata / JSON-LD / sitemap 无异常 |
| 搜索 | 首页或支撑内容出现至少 8 个非品牌 query impression |
| 长尾 | 至少出现 `stock research app`、`stock decision support`、`stock risk analysis`、`AI stock analysis`、`stock analysis tool` 中的 2 个簇 |
| GEO | AI 搜索能正确描述 ZISO 为 AI stock analysis / stock research / decision-support workflow，不描述成荐股或自动交易机器人 |
| 转化 | Learn 支撑内容能向首页、pricing、app 入口贡献可追踪点击 |

## 9. Act 规则

1. 若 `AI stock analysis` 有展示但 CTR 低：优先改 description，不改主词。
2. 若 `stock prediction` 或 `stock picks` 带来展示：不要直接追词，先补边界 FAQ 或反向教育文章。
3. 若 `stock research app` 有展示：补强首页和文章内的 app/workflow 语言，这是本轮实测最高的产品词。
4. 若 `stock decision support` 或 `stock risk analysis` 起量：优先补风险 / 决策支持文章，不急着改首页 title。
5. 若 GEO 抽样把 ZISO 误述成“buy/sell signals”或“trading bot”：优先修 FAQ / JSON-LD featureList / boundary copy。
