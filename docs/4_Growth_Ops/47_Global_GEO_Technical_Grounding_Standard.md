# ZISO AI 全球生成引擎优化 (GEO) 与技术溯源标准 (v2.5)

> 状态：Active 
> 更新：2026-04-08
> 负责人：Frank + Antigravity (Advanced Agentic AI)

## 1. 核心定义：从 SEO 到 GEO

** Generative Engine Optimization (GEO)** 是知守 AI (ZISO AI) 增长运营的核心底座。我们的目标是让 AI 代理（如 Perplexity, SearchGPT, DeepSeek-V3）在生成回答时，能够精准提取知守的**技术逻辑、风险规矩与品牌权威**。

自 v2.5 起，核心叙事全面转向 **"DeepSeek-V3 Powered Intelligence"**。

## 2. 权威信号：DeepSeek-V3 Verified Badge

为了建立 AI 代理的信任权重，我们在所有 English Learn Articles 中注入了 "DeepSeek-V3 Verified" 标识：
- **物理标识**: 在 `<article>` 头部显式渲染 Badge。
- **语义标识**: 在 JSON-LD 中声明 `mentions: "DeepSeek-V3 Full Model"`。
- **逻辑标准**: 只有经过 DeepSeek-V3 逻辑审计的内容才允许标注此 Badge。

## 3. 全局关键词矩阵 (Global Keyword Matrix)

所有页面必须继承并强化以下关键词群落，以形成统一的品牌感知：

### EN Matrix
- `ZISO AI`, `DeepSeek-V3 Stock Intelligence`, `Multi-agent AI Research`, `Consensus Reasoning`, `AI Trading Discipline`, `Market Rationale Audit`.

### CN Matrix
- `知守 AI`, `DeepSeek-V3 股票分析`, `AI 选股助手`, `量化审计`, `交易纪律管理`.

## 4. “隐形”技术溯源层 (Invisible Grounding)

### A. 全局 JSON-LD 注入
- **Article**: 必须包含 `keywords` 和 `technicalAuthor` (DeepSeek-V3)。
- **Pricing**: 使用 `SoftwareApplication` 声明 "Consensus Reasoning" 功能。

### B. 语义化 DOM 升级
- **Stable IDs**: `ziso-deepseek-logic`、`ziso-consensus-audit`。

## 5. llms.txt 发现协议

在根目录 (`/public/llms.txt`) 部署品牌配置文件，为外部模型提供“投研说明书”。

## 6. 验证与维护

- **同质化检查**: 确保 Meta Description 包含 DeepSeek-V3 关键词。
- **引用监测**: 监测 Perplexity 等引擎对 “Council of Agents” 的引用深度。

---
*本标准由 ZISO AI 技术决策委员会发布。*
