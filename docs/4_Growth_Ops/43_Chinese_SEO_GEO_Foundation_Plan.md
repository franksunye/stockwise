# 知守 AI (ZISO AI) 中文 SEO/GEO 执行文档

> [!IMPORTANT]
> **全球化升级公告 (2026-04-02)**:  
> 本文档中的中文专项策略已整合并升级为 **[知守 AI 全球生成引擎优化 (GEO) 与技术溯源标准 (v2.0)](./47_Global_GEO_Technical_Grounding_Standard.md)**。  
> 
> 全球站点（EN, KO, ES, CN）统一遵循最新的技术底座、语义化 ID 和 JSON-LD 注入规范。

> 状态：Combined into Global Standard (v2.0)

## 1. 目标

- 用 4 周完成中文站 SEO + GEO 基础建设。
- 建立可复用模块，后续改策略时“一处改、全站生效”。
- 两周发布观察期后开始数据统计与迭代。

## 2. 本期 KPI（60-90 天）

- 自然搜索点击量：+30%（60 天）。
- 收录页面数：+40%（60 天）。
- 核心词平均排名：提升 10-20 位（90 天）。
- AI 引用准确率：>= 80%（抽样口径）。

## 3. 已确认策略

1. 搜索优先级：`Bing > Google 中文 > 百度`
2. 首批词群：`AI 复盘 / 解读 / 分析 / 预测`
3. 首批样板：`20 页`
4. 语气策略：`降低攻击性，保留专业判断`
5. 模板要求：`来源块必带（name/url/date/scope）`
6. 节奏：`4 周冲刺`

## 4. 执行框架

### A. 技术底座
- metadata/canonical/robots/sitemap 标准化。
- 动态页可索引化（learn/support）。
- JSON-LD（Article/FAQ）统一生成。

### B. 内容模板
- TL;DR
- Key Facts（带日期）
- 来源块（带 claimScope）
- 边界声明
- 相关推荐内链（同类 + 跨类）

### C. 运营节奏
- Week 1-2：建设与补齐。
- Week 3：两周后统计，做首轮复盘。
- Week 4：基于数据做放大和淘汰。

## 5. 当前进度（摘要）

- 模块化底座：已完成。
- 20 页样板改造：核心页已落地。
- 薄内容补强：14/14 已完成。
- 构建验证：持续通过（仅历史 warning）。

## 6. 执行进展（2026 Q1）

### 2026-03-05

#### 动作
- 建立 SEO/GEO 模块化底座（`seo.ts`、`geo.ts`、`GeoBlocks.tsx`）。
- 建立品牌内容中心（`brand-core.zh-CN.ts`）。
- 补齐 `robots.ts`、`sitemap.ts`。
- 公共页 metadata 标准化，learn/support 详情页补结构化与来源块。

#### 结果
- `npm run build` 通过。
- 支持“中心化改文案、全站同步”。

#### 下一步
- 输出样板页地图、来源标准、风险报告。

### 2026-03-05（续）

#### 动作
- 产出 20 页样板与 Week 3 模板文档。
- 完成薄内容补强（14/14）：统一增加 `Key Facts + 证据口径`。
- 增加 support 页面同类/跨类内链。

#### 结果
- `npm run build` 持续通过。
- 20 页样板链路与薄内容清单已闭环。

#### 下一步
- 发布上线后观察 2 周，不改结构。
- 两周后启动 Week 3 数据统计并填报实数。

## 7. 下一步（等待发布满 2 周后启动）

1. 填 Week 3 周报实数（收录/点击/排名/内链/GEO 抽样）。
2. 按 P0/P1 修复清单做首轮调优。
3. 放大有效词群，暂停低效词群。

## 8. 风险与原则

- 风险：两周内频繁改结构会污染统计基线。
- 原则：观察期只修 bug，不改 SEO/GEO 结构。

## 9. 附录（归档索引）

详细专项文档已归档到：`docs/4_Growth_Ops/archive/seo-geo/`

- `SEO_GEO_Keyword_Map_zh.md`
- `SEO_GEO_Source_Block_Standard.md`
- `SEO_GEO_Index_Risk_Report_2026-03-05.md`
- `SEO_GEO_20_Page_Retrofit_Plan.md`
- `SEO_GEO_Weekly_Report_Week3.md`
- `SEO_GEO_Page_Fix_List_Week3.md`
- `SEO_GEO_AI_Citation_Sampling_Week3.md`

### 2026-04-08

#### 动作
- **全球关键词矩阵 (Global Keyword Matrix)**：在 `brand-core` 完成 EN/CN 联动注入。
- **DeepSeek-V3 品牌重塑**：全站元数据（page.tsx）完成对 DeepSeek-V3 的技术背书更新。
- **由于 SEO 样板升级**：为 English Articles 注入 "DeepSeek-V3 Verified" 权威标识。

#### 结果
- 完成从“通用分析词”向“硬核技术词”的语义平移。
- 全球 50+ 页面实现关键词实时同步。

#### 下一步
- 观察 DeepSeek-V3 相关搜索流量变动。
- 更新 llms.txt 对外置信口径。
