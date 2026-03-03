# StockWise (ZISO AI) 全球化与多语言架构演进分析

## 1. 现状评估 (Current State Assessment)

经过对 `backend` 和 `frontend` 代码库的深度审计，目前的系统是高度定制化的 **"中文/东八区/A港股"** 单一市场架构。

### 1.1 核心依赖与硬编码 (Hard Constraints)
- **硬编码语言**: 前端 UI (`UserCenterDrawer.tsx`, `pricing-data.ts`)、帮助文档 (`support-content.ts`)、以及最重要的 AI 提示词模板 (`backend/templates/prompts/*.j2`) 全部为硬编码中文。
- **单一时区**: 后端配置深度依赖 `BEIJING_TZ` (Asia/Shanghai)，交易日历 (`trading_calendar.py`) 仅包含 CN 和 HK 假期。
- **数据源局限**: 数据获取层 (`fetchers.py`) 强依赖 `AkShare` (A股) 和 `Sina` (A/H 实时)，对于美股或其他海外市场目前仅有 `EODHDFetcher` 的占位符。
- **货币与单位**: 前端大量使用了 "万/亿" (`format_volume`) 这种中文特有的数量单位，以及 "¥" 货币符号。

### 1.2 扩展能力评分 (Scalability Score)
- **多语言支持**: ⭐️ (1/5) - 需重构
- **多市场支持**: ⭐️⭐️ (2/5) - 架构上有 `market` 字段，但实现缺失
- **多时区支持**: ⭐️ (1/5) - 需全局查找替换
- **AI 泛化能力**: ⭐️⭐️⭐️ (3/5) - LLM 本身支持多语言，但 Prompt 需本地化

---

## 2. 架构演进路线图 (Evolution Roadmap)

如果不进行重构直接生硬添加英文版，会导致代码库极其难以维护。建议分三个阶段进行演进：

### Phase 1: 基础架构解耦 (Infrastructure Decoupling)

**目标**: 移除代码中的"中国特色"硬编码，引入配置化上下文。

1.  **前端国际化 (i18n) 框架引入**:
    -   引入 `next-intl` 或 `react-i18next`。
    -   抽离所有 UI 文本到 `locales/zh-CN.json` 和 `locales/en-US.json`。
    -   **挑战**: 动态内容（如 AI 简报）的翻译或双语生成。

2.  **单位与格式自适应**:
    -   废弃硬编码的 `format_volume` (万/亿)，改用 `Intl.NumberFormat` 标准 API。
    -   货币显示应根据 `PricingPlan` 动态渲染 (CNY/USD)。

3.  **Prompt 模板引擎升级**:
    -   `backend/templates/prompts/` 目录下需按语言拆分，例如 `zh/stock_analysis.j2` 和 `en/stock_analysis.j2`。
    -   在 `LLMRegistry` 或 `run_ai_analysis` 中传入 `user_language` 上下文。

### Phase 2: 多市场数据适配 (Multi-Market Data Adapter)

**目标**: 让系统看懂美股、英股、日股。

1.  **Ticker 符号标准化**:
    -   目前使用 `sh000001` 或 `00700`。
    -   需兼容 Yahoo/Google 格式: `AAPL` (US), `7203.T` (Japan)。
    -   数据库 `stock_meta` 表需增加 `currency` 和 `timezone` 字段。

2.  **全球化交易日历**:
    -   `trading_calendar.py` 需要集成 `pandas_market_calendars` 或类似库，动态获取 NYSE, LSE, TYO 的假期。
    -   移除硬编码的 `CN_HOLIDAYS_2025`。

3.  **数据源扩展**:
    -   实现 `EODHDFetcher` 或集成 `YahooFinance` (yfinance) / `AlphaVantage` 作为美股数据源。
    -   扩展 `MarketObserver`，使其能并行处理不同开盘时间的市场（无需都在 UTC+8 运行）。

### Phase 3: 全球化运营配置 (Global Operations)

**目标**: 针对不同地区用户提供差异化服务。

1.  **动态定价策略**:
    -   `pricing-data.ts` 需根据用户 IP 或设置显示不同价格体系 (Stripe Price IDs 需区分区域)。
2.  **内容分发网络 (CDN)**:
    -   目前的 Cloudflare 设置对全球友好，但需确保 API 延迟在不同大洲均可接受。

---

## 3. 具体改造点清单 (Actionable Checklist)

### Frontend (`/frontend`)
- [ ] **Next.js Config**: 修改 `i18n` 路由配置，支持 `/en/dashboard`, `/zh/dashboard`。
- [ ] **Hardcoded Strings**: 扫描所有 `.tsx` 文件，替换中文文本为 `t('key')`。
- [ ] **UI Components**:
    -   `PricingData`: 支持多币种。
    -   `UserCenterDrawer`: 日期格式化移除 `zh-CN` 强绑定。
    -   `StockDashboardCard`: 分时图/K线图库需支持非东八区时间轴。

### Backend (`/backend`)
- [ ] **Database**:
    -   `users` 表添加 `locale` (en/zh) 和 `timezone` 字段。
    -   `stock_meta` 表添加 `region` (US/CN/HK)。
- [ ] **Prompt Engineering**:
    -   创建 `PromptManager` 类，根据用户偏好加载对应的 Jinja2 模板。
    -   AI 输出要求 (JSON) 保持不变，但内容字段 (`reasoning_trace`, `summary`) 需生成对应语言。
- [ ] **Engine**:
    -   `ContextService` 中的硬编码指数 (`sh000001` 等) 需按市场配置化。
    -   `brief_generator.py`: 简报生成需识别目标受众语言。

### AI 模型策略
- **DeepSeek V3 / R1**: 中文能力极强，英文能力也不错。可以继续作为主力。
- **GPT-4o**: 英文语境下的金融推理可能更地道，可作为英文版 Pro 用户的备选。

## 4. 结论 (Conclusion)

当前的 **ZISO AI** 架构是一个优秀的**单市场 MVP**。其核心逻辑（ETL -> 向量化 -> LLM 推理 -> 结构化输出）是通用的，能够很好地移植。

但**每一个**用户可见层（UI 文字、AI 输出、数据格式、时间显示）都被锁死在中文语境下。

**建议**: 不要急于"增加"英文版，而是先进行"国际化重构 (i18n Refactoring)"。先让当前系统具备"配置语言"的能力，哪怕暂时只配置中文。一旦架构支持了 `t('welcome')`，引入英文版就是水到渠成且低成本的工作。
