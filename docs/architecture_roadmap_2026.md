# StockWise 架构优化与扩展路线图 (2026)

本文件概括了 StockWise 系统在面对未来复杂性提升（多源数据、多模态情报、多 LLM 竞争）时的架构演进方向。

## 1. 现状评估 (Current State)
目前系统采用基于 GitHub Actions 的 ETL 模式，AI 层（Quant Mind）与模型工厂（Model Factory）已经实现了较好的解耦，但数据接入层（Ingestion）和任务编排（Orchestration）仍存在过程式代码比例较高、单点依赖严重的问题。

---

## 2. 核心优化方向 (Core Optimizations)

### 2.1 数据库交互层 (Persistence Layer)
*   **Turso Pipeline API 实现**: 利用 Turso 的 HTTP Pipeline 功能，将 `DELETE + INSERT` 合并为单次原子操作，减少 30% 以上的 IO 往返耗时。
*   **Repository 模式抽象**: 建立 `StockRepository`, `PriceRepository`, `PredictionRepository`。将 SQL 逻辑从业务代码（如 `prices.py`）中抽离，实现“逻辑与数据持久化”的解耦。

### 2.2 数据模型标准化 (Data Modeling)
*   **引入 Pydantic**: 对抓取的原始数据（行情、财务、新闻）进行强类型定义。
*   **Schema Normalization**: 所有外部数据源在进入系统内环前，必须转换为统一的内部标准模型（如 `StandardBar`），消除不同数据源字段名不一致（如 `vol` vs `volume`）带来的冗余代码。

### 2.3 预测管道优化 (Reasoning Pipeline)
*   **上下文共享管理**: 实现 `SessionContext`，让多模型竞争运行时能共享全局的市场锚点（Market Anchors）和基本面数据，避免重复查库。
*   **Idempotency 幂等增强**: 细化模型级的幂等校验，确保在异常中断重跑时，已成功的模型结果不再重复计算。

---

## 3. 架构扩展策略 (Expansion Strategies)

### 3.1 股票数据源扩展 (Provider/Adapter Pattern)
*   **目标**: 引入与 AkShare 并行的源（如 Baostock, Yahoo Finance, EastMoney API）。
*   **实施**: 
    *   定义 `AbstractFetcher` 基类。
    *   通过 `FetcherFactory` 根据 symbol 格式或配置动态下发任务。
    *   支持“数据源降级策略”：当 AkShare 限流时自动切换到备用源。

### 3.2 新闻与情报源扩展 (News Aggregation)
*   **目标**: 接入结构化公告、社交媒体情绪、宏观新闻。
*   **实施**:
    *   建立 `NewsDesk` 模块，包含 `NewsAggregator`（聚合）、`SentimentAnalyzer`（预处理）。
    *   探索 Turso Vector 特性，为非结构化新闻建立向量化索引，供 LLM 进行 RAG（检索增强生成）式分析。

### 3.3 量化规则插件化 (Quantitative Plugin System)
*   **目标**: 让不同板块或市值的股票应用不同的指标规则。
*   **实施**:
    *   将 `indicators.py` 重构为 `IndicatorPipeline`。
    *   允许通过配置文件定义：`SmallCap -> [MA, RSI], LargeCap -> [MACD, VolumeFlow]`，实现计算资源的按需分配。

### 3.4 任务编排角色化 (Agentic Modularity)
*   **目标**: 减少 `main.py` 的复杂度，让代码更符合 Agent 设计初衷。
*   **实施**:
    *   将流程逻辑封装进角色类：`Marcus (Data)`, `Quinn (AI)`, `Nora (Push)`, `Sylar (Verify)`。
    *   实现简单的事件驱动或依赖注入：`on_ingestion_complete -> trigger_analysis`。

### 3.5 市场宏观与板块情报 (Market & Sector Intelligence)
*   **目标**: 引入资金流量（Capital Flow）、板块归属及轮动强度数据（来自 AkShare 或 EODHD）。
*   **实施**:
    *   **独立聚合层**: 建立 `SectorService`，不以单只股票为中心，而是以行业/概念板块为中心进行数据索引。
    *   **多维上下文注入**: 在 AI 分析流程中自动关联“个股 - 板块 - 市场”的三层动力学数据。例如：通过板块流向分析判断当前个股是在“主升浪”还是“补涨”阶段。
    *   **全球视野支持**: 利用 EODHD 等国际源，引入全球宏观指标（如美债收益率、大宗商品价格），为离岸市场（港股/美股）提供更深层的宏观底噪分析。

---

## 4. 代码质量与工程卓越 (Code Quality & Engineering Excellence)

针对目前后台代码中存在的工程细节问题，实施以下质量提升准则：

### 4.1 全面类型安全 (Type Safety)
*   **消除 Any**: 逐步移除代码中的 `Dict[str, Any]`，改用强类型的 Pydantic 模型或 `TypedDict`。
*   **严格类型检查**: 引入 `mypy` 等静态分析工具，确保在开发阶段捕获潜在的类型匹配错误。

### 4.2 错误处理模式标准化 (Error Handling)
*   **显式 vs 隐式**: 统一各个模块的错误处理哲学。目前有的模块返回 `False`，有的抛出异常。建议采用“业务异常类（Custom Exceptions）”体系，明确区分“网络波动（可重试）”与“逻辑错误（需人工干预）”。
*   **Circuit Breaker (熔断机制)**: 在调用第三方 API（LLM 或行情源）时引入熔断逻辑，防止单点故障拖垮整个 Actions 运行时间。

### 4.3 日志与可观测性 (Observability)
*   **结构化日志**: 引入 `structlog` 或优化 `logger.py`，支持 JSON 格式输出，方便未来接入 ELK 或类似日志分析平台。
*   **上下文追踪**: 在多线程环境（如 `prices.py`）中，确保 `task_id` 和 `symbol` 始终贯穿日志上下文，方便快速定位特定股票的执行轨迹。

### 4.4 SQL 安全与性能
*   **参数化查询一致性**: 确保所有模块严格遵循非字符串拼接的 SQL 参数化形式。
*   **索引优化检查**: 针对 `ai_predictions_v2` 等快速增长的表，定期评估索引效率，防止查询性能随数据量级呈对数级下降。

---

## 5. 长期愿景：世界级后端工程 (Long-term Vision: World-Class Engineering)

为将 StockWise 提升至行业顶尖水平，需在确定性、可观测性和自动化运维上进一步深耕：

### 5.1 AI 链路追踪 (AI Observability & Tracing)
*   **全生命周期日志**: 为每次预测分配 `trace_id`，持久化存储“原始数据快照 + Prompt + 原始 LLM 响应 + 解析结果”。
*   **黑盒调试能力**: 实现“预测回溯”，能够一键还原 AI 做决策时的所有输入条件，用于精准优化提示词。

### 5.2 确定性测试与质量控制 (Determinism & QA)
*   **金标准 (Golden Sets) 测试**: 建立 20+ 个经典股票形态的基准测试集。每次迭代 Prompt 或代码后，自动跑一遍比对，确保逻辑未回归。
*   **AI 审计员 (LLM-as-a-Judge)**: 引入高阶模型（如 GPT-4o）定期对生产环境的小模型（如 Gemini Flash）生成的建议进行逻辑审计和评分。

### 5.3 影子模式与 A/B 测试 (Shadow Mode)
*   **无感知灰度**: 支持新模型在生产环境以“影子模式”运行（只记录结果，不发送通知），通过离线胜率对比后决定是否上线。

### 5.4 持久化状态机 (Persistent Task Orchestration)
*   **断点续跑**: 将 ETL 流程由简单的脚本改为状态感知的引擎（Pending -> Synced -> Analyzed）。如果 GitHub Actions 超时，下次运行能从断点处重启。

### 5.5 资源弹性与动态路由
*   **API 密钥轮换**: 实现自动化的 API 密钥监控与轮换机制，配合动态 Rate Limiting，确保在海量并发时的服务稳定性。

---

## 6. 实施阶段规划 (Phased Roadmap)

*   **第一阶段 (Refactor)**: Pydantic 模型标准化 + Repository 模式初步抽象（预计 1-2 周）。
*   **第二阶段 (Abstract)**: Fetcher 适配器化 + 数据源并行扩展（预计 2-3 周）。
*   **第三阶段 (Evolve)**: 新闻源接入与 RAG 架构原型 + 任务编排角色化（持续迭代）。

---

*Document Created: 2026-02-01*  
*Status: Strategy & Discussion Draft*
