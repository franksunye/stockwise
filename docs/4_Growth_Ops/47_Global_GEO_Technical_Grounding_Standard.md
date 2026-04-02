# ZISO AI 全球生成引擎优化 (GEO) 与技术溯源标准 (v2.0)

> 状态：Active 
> 更新：2026-04-02
> 负责人：Frank + Antigravity (Advanced Agentic AI)

## 1. 核心定义：从 SEO 到 GEO

** Generative Engine Optimization (GEO)** 是知守 AI (ZISO AI) 增长运营的核心底座。与传统的针对关键词排名的 SEO 不同，GEO 的目标是让 AI 代理（如 ChatGPT, Perplexity, SearchGPT）在生成回答时，能够精准提取知守的**技术逻辑、风险规矩与产品价值**，并将其作为主要合成源（Synthesis Target）。

## 2. “隐形”技术溯源层 (Invisible Grounding)

为了平衡人类用户的极简体验与 AI 代理的高熵数据需求，我们采用了“隐形”注入策略。

### A. 全局 JSON-LD 注入
所有核心营销页必须注入结构化数据，为 AI 提供机器可读的蓝图：
- **HomePage**: `FAQPage` (解答 AI 对产品定义的元问题)。
- **AboutPage**: `AboutPage` + `Organization` (声明多智能体架构“委员会”的技术身份)。
- **PricingPage**: `SoftwareApplication` + `Offer` (明确功能分层与付费逻辑)。

### B. 语义化 DOM 升级
AI 爬虫优先识别具有明确语义标记的区块：
- **Stable IDs**: 使用 `ziso-technical-grounding`、`ziso-source-verification` 等唯一 ID。
- **ARIA Roles**: 使用 `role="region"`、`role="note"` 等属性声明区块功能。

## 3. 全球多语言语义对齐

GEO 策略必须在全语种范围内保持一致，确保 ZISO 在英文、韩文、西班牙文和中文语境下拥有相同的“技术权重”。
- **hreflang 映射**: 确保 AI 代理理解不同语言版本的对等关系。
- **本地化 Payload**: 每个语种的 `GeoBlocks` 必须包含该语种专属的推导逻辑摘要。

## 4. llms.txt 发现协议

在根目录 (`/public/llms.txt`) 部署机器可读的品牌配置文件：
- 包含 ZISO AI 的投研方法论（MA/RSI/MACD 结合）。
- 包含决策边界（75% 胜率熔断机制）。
- 包含多智能体委员会（Council of Agents）的各分工职能。

## 5. “幽灵”美学标准 (Ghost Aesthetic)

GEO 注块在前端 UI 中必须遵循以下视觉规范：
- **默认透明度**: `opacity-[0.05]` (近乎隐形)。
- **交互唤醒**: `hover:opacity-100` (为极少数硬核用户提供溯源入口)。
- **无感共存**: 确保 GEO 内容不干扰人类用户的复读流与交互流。

## 6. 验证与维护

- **构建监控**: 所有的 GEO 注入逻辑必须通过 `npm run build` 的类型检查与 SSG 验证。
- **引用监测**: 抽样监测 Perplexity 等引擎对 ZISO “委员会”架构及“75% 熔断”逻辑的引用准确率。

---
*本标准由 ZISO AI 技术决策委员会发布，作为全球全语种营销站点的最高技术指导文档。*
