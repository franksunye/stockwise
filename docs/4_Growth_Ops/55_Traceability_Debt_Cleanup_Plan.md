# 专项行动：Docs-as-Code 内容溯源技术债清理计划 (Traceability Debt Cleanup)

根据 `/content-audit` 首次运行暴露出的全局溯源健康状况，我们需要一次“外科手术式”的专项清理行动。一旦完成，StockWise 的外部内容体系将达到 100% 的底层逻辑渗透率。

本专项计划分为三个核心战役，按紧急与影响程度排序：

---

## 战役一：消除“逻辑过期”红区 (The Outdated Red-Zone)

矩阵显示有 40+ 篇 101 系列文章因为底层 `06_Quant_Industry_Positioning_Map.md` 的更新而飙红。这里大部分是**“时间戳误杀”**（因为我们最近刚对 06 执行了重排版或目录位移），但必须严谨排查。

### 执行动作 (Action Items)
1. **抽样复核**：快速抽检 `101-01` 至 `101-10`，确认最新的 `06_Quant_Industry_Positioning_Map.md` 文件中是否有颠覆性的底层逻辑改变（比如废弃了左侧防御体系等）。
2. **批量时间戳刷新 (Touch)**：如果确认 06 的改动属于非破坏性更新（如错别字、新增非冲突段落或纯位置移动），我们将运行一段批量脚本，对所有标红的 `101-*.md` 文件执行 `touch` 命令刷新其最后修改时间。
3. **消除红光**：重新运行 `/content-audit`，将红区警报数量降至 0。

---

## 战役二：认祖归宗 - “孤儿内容”挂靠 (The Orphaned Orange-Zone)

矩阵显示有近 50 篇无源头文章，集中在 `Support_Ops/content/*`（如 `ai-pulse-resonance.md` 等）与早期的 `2026-03-02_*.md` 脑洞文章中。它们目前处于没有任何底层代码或产品白皮书背书的“裸奔状态”。

### 执行动作 (Action Items)
1. **分类盘点源头**：我们将遍历 `Support_Ops` 下的这些客服条目，人工为其寻找最匹配的 `1_Engineering/...` 或 `3_Product/...` 协议。
    *   例如：`ios-tuning.md` 应该挂靠在 `1_Engineering/26_Global_First_ISR...md` 上。
    *   例如：`four-states-semantics.md` 应该挂靠在 `3_Product/Specs/40_Quant_AI_Dual_Layer_UX.md` 上。
2. **自动化/半自动化注入**：写一个 Python 映射脚本，将上述匹配结果作为 `source_docs` 补充进这些 Markdown 的 Frontmatter 中。
3. **销毁无效残骸**：对于实在找不到内部支撑、纯系早期“口嗨”且不再符合当前严肃量化风格的历史文章（如极个别的单纯热点蹭文），直接建议 `git rm` 归档封存。

---

## 战役三：金矿开采 - “闲置 IP”资产转化 (The Unutilized Blue-Zone)

这是最具战略价值的战役。我们发现 `1_Engineering` 和 `2_Intelligence` 中有多达 50 篇如《可靠性协议》、《双轨决策架构》等长篇硬核大作未被开发。它们是未来吸引专业用户、树立“量化霸权”人设的终极弹药。

### 执行动作 (Action Items)
我们将把这些蓝区文件打包成 3 个新的“营销主题季 (Marketing Campaigns)”：
1. **“冷酷的工程管线” 季 (Engineering the Coldness)**
   *   提取源：`11_Reliability_Protocol.md`、`28_Price_Sync_Zero_Stale_Protocol_20260316.md` 等。
   *   内容方向：向散户展示 ZISO 是为了保障“哪怕极端行情下也绝不停摆，强制执行网格”付出了何等夸张的工程代价。狠狠打击市面上“一遇大跌就宕机”的劣质券商。
2. **“解剖双轨大脑” 季 (Dual-Track AI Mind)**
   *   提取源：`19_Dual_Track_Decision_Architecture_Proposal.md`、`27C_Dual_Lane_Operations_Manual.md`。
   *   内容方向：通过解释我们为什么把预测模块和防守模块在底层代码上物理切断，让非技术用户直观感受 ZISO 防护网的变态级稳定性。
3. **“无情的产品底线” 季 (Product Boundaries)**
   *   提取源：`30_Notification_Strategy_Design.md`。
   *   内容方向：解释我们为什么反其道而行之，“剥夺”用户的盘中提示权，将焦点收敛至 08:30 / 21:00，通过“做减法”的通知策略帮散户戒断盯盘毒瘾。

---

## 指挥官决策要求 (Next Steps)

如果您批准此路线图，我建议我们遵循 **“先排雷、后挖矿”** 的节奏：
1. **立刻优先执行【战役一】与【战役二】**：清除所有不合规的红橙色警告，让 Matrix 回归 100% 绿色的健康溯源状态。
2. **最后进入【战役三】**：在溯源图谱彻底干净后，随时依据最新的商业节点（如拉新、PR）启动新一轮的爆款制造。

请问是否准许我立刻开始执行【战役一：红区时间戳复核与批量刷新】和【战役二：Support孤儿文案的智能挂靠】程序的代码编写？
