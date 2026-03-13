# 知守 AI (ZISO AI) 网站全球化实施方案 V2

本文件是 ZISO AI 官网全球化方案的 V2 设计稿。

V2 的目标不是把整个应用一次性改造成“多语言产品”，而是先把官网与内容体系做成可持续的国际化外壳，为后续 SEO、GEO、更多市场版本扩展预留正确的架构边界。

---

## 1. 目标与边界

### 1.1 当前阶段目标

当前阶段只解决以下问题：

1. 官网营销页面支持多语言索引与分发。
2. Learn / Support 等内容页支持多语言内容组织与搜索引擎识别。
3. 让 Google / AI 搜索产品能够识别站点存在不同语言版本。
4. 为未来更多市场版本保留扩展位，但当前不直接实现“按市场切换产品”。

### 1.2 当前阶段不做的事情

当前阶段明确不做：

1. 不把 `dashboard`、`admin`、`status` 等应用面整体改造成多语言产品。
2. 不把实时 AI 推理、交易逻辑、策略生成链路纳入本次全球化范围。
3. 不把“语言(locale)”和“市场版本(market edition)”混成同一个路由维度。
4. 不为尚未翻译完成的语言页面制造大量可索引的低质量副本。

### 1.3 设计原则

1. Public surface 与 App surface 分离设计。
2. SEO / GEO 是一等约束，不是附加项。
3. 语言维度先落地，市场维度先预留。
4. 内容关系优先于文件路径；不能只靠文件名维持多语言映射。

---

## 2. 核心结论

### 2.1 本次国际化只覆盖 Public Surface

本次纳入国际化的范围：

1. 首页
2. About
3. Pricing
4. Learn
5. Support
6. Terms / Privacy / Refund 等公共站点页面

本次不纳入国际化主路由的范围：

1. `/dashboard`
2. `/admin`
3. `/status`
4. `/api/*`

这不是偷懒，而是架构分层。

你们当前最迫切的是国际化 SEO / GEO，而不是把交易应用做成多语言交互产品。把 public 页面和 app 页面分开，才能避免未来为更多市场版本扩展时，语言逻辑侵入核心交易链路。

### 2.2 语言与市场必须拆成两个概念

V2 里明确区分：

- `locale`: 页面展示语言，例如 `zh`, `en`
- `market edition`: 面向哪个市场或产品分支，例如 `cn`, `us`, `hk`

短期内只落地 `locale`，但所有模型与路由约定都要避免把 `locale` 当成未来市场版本的替代品。

错误示例：

- `/en/dashboard` 被当成“国际版产品”
- `/en` 同时承担英文内容和美股产品版本含义

正确理解：

- `/en/learn/...` 只是英文内容页
- 未来如果做独立 NYSE 版本，应由独立 market edition 决定，不应通过 locale 强行承载

---

## 3. 推荐技术架构

### 3.1 技术栈

1. `next-intl` 用于 Public Surface 的 UI 文案国际化。
2. Next.js App Router 继续保留。
3. Markdown 内容继续本地文件驱动，但升级为“有稳定内容 ID 的多语言内容模型”。

### 3.2 路由策略

采用子路径国际化，但只用于 public 页面。

推荐 URL 规则：

- 默认语言中文保持无前缀：
  - `/`
  - `/about`
  - `/learn`
  - `/support`
- 非默认语言使用前缀：
  - `/en`
  - `/en/about`
  - `/en/learn`
  - `/en/support`

应用面保持原状：

- `/dashboard`
- `/admin`
- `/status`

不建议在本阶段引入：

- `/en/dashboard`
- `/en/admin`
- `/zh/dashboard`

### 3.3 路由分层建议

推荐目录形态：

```text
src/
  app/
    (public)/
      page.tsx
      about/
      pricing/
      learn/
      support/
      privacy/
      terms/
      refund/
    [locale]/
      (public)/
        page.tsx
        about/
        pricing/
        learn/
        support/
        privacy/
        terms/
        refund/
    (dashboard)/
      dashboard/
    admin/
    status/
    api/
  middleware.ts
  i18n/
    routing.ts
    request.ts
```

说明：

1. 默认中文 public 页面保留现有 URL，不破坏已有 SEO 与外链。
2. 非默认语言通过 `[locale]/(public)` 承载。
3. `dashboard` 与 `api` 明确排除在 i18n 路由处理之外。

---

## 4. SEO / GEO 设计要求

这是 V2 和旧版方案最大的区别。

全球化的首要目标是被正确理解、正确索引、正确分发，而不是简单出现一套英文界面。

### 4.1 每个 locale 页面都必须有独立 metadata

必须支持：

1. locale-aware `title`
2. locale-aware `description`
3. locale-aware Open Graph / Twitter 文案
4. locale-aware canonical
5. locale-aware `alternates.languages`

对于每一组多语言页面，需要显式输出：

- `canonical`
- `hreflang` alternates
- `x-default`

### 4.2 Sitemap 必须升级为 locale-aware

当前 sitemap 不能只列一套中文 URL。

V2 需要生成：

1. 默认中文 public URLs
2. 英文 public URLs
3. Learn / Support 的各语言内容页
4. 对应的 alternates 关系

如果某篇英文内容尚未完成：

1. 不应在英文 sitemap 中声明该 URL 为正式英文内容页。
2. 不应让 `/en/...` 页面成为一个承载中文正文却可被正常索引的英文页面。

### 4.3 翻译缺失页的索引策略

这是内容回退最容易出问题的地方。

如果 `en` 内容不存在，允许产品层回退显示中文，但搜索层必须单独处理。

推荐规则：

1. 对用户请求可回退显示中文，保证页面可用。
2. 但该页面应标记为“非正式英文版本”。
3. 对搜索引擎应采用以下二选一策略之一：
   - 方案 A：返回英文 URL，但加 `noindex`，并 canonical 到中文原文。
   - 方案 B：直接重定向到中文原文。

对于 SEO / GEO 目标，推荐优先采用方案 A，仅在确有语言切换体验需求时保留回退 UI。

结论：

“内容回退”可以存在，但“语言错配页面进入索引”不能存在。

### 4.4 GEO 额外要求

为了服务 AI 搜索与回答引擎，除了传统 SEO 以外，还应补上：

1. 结构化清晰的标题层级
2. 统一且稳定的文章元信息
3. 明确的发布日期 / 更新时间
4. 明确的作者 / 品牌归属
5. FAQ、Article、Breadcrumb 等结构化数据
6. 不同语言版本之间稳定可追踪的映射关系

---

## 5. 内容模型升级

旧版方案只提“按 `zh/` 和 `en/` 文件夹存放 Markdown”，这对落地不够。

V2 建议引入“稳定内容 ID + locale 内容文件”的模型。

### 5.1 推荐目录结构

```text
docs/
  4_Growth_Ops/content/
    learn/
      zh/
        stockwise-101-basics.md
      en/
        stockwise-101-basics.md
    support/
      zh/
        tactical-brief-guide.md
      en/
        tactical-brief-guide.md
```

相比旧版，关键不在 `zh/en` 文件夹，而在“同一篇内容必须共享一个稳定 slug / content id”。

### 5.2 Frontmatter 最低要求

每篇内容建议至少包含：

```yaml
id: stockwise-101-basics
slug: stockwise-101-basics
locale: zh
source_locale: zh
title: 股票 101：先理解什么是交易信号
description: ...
date: 2026-03-13
updated_at: 2026-03-13
category: Beginner
translation_status: source
publish: true
```

英文翻译版示例：

```yaml
id: stockwise-101-basics
slug: stockwise-101-basics
locale: en
source_locale: zh
title: Stock Signals 101
description: ...
date: 2026-03-15
updated_at: 2026-03-15
category: Beginner
translation_status: translated
publish: true
```

### 5.3 为什么需要稳定 ID

稳定 ID 用来解决以下问题：

1. 构建 locale alternates
2. 生成多语言 sitemap
3. 判断哪些内容已经翻译完成
4. 支持未来一个主题在不同市场版本下衍生不同内容
5. 避免未来 slug 改名后丢失跨语言关系

### 5.4 Learn / Support 加载器要求

`learn-content.ts` 和 `support-content.ts` 应从“按目录扫文件名”升级为：

1. 按 locale 读取内容
2. 按稳定 ID 建立内容映射
3. 返回内容本体时附带：
   - `locale`
   - `sourceLocale`
   - `translationStatus`
   - `availableLocales`
   - `canonicalLocale`

这样页面层才能同时处理：

1. UI 渲染
2. 语言切换器
3. metadata alternates
4. sitemap 生成
5. 翻译缺失策略

---

## 6. UI 文本国际化策略

### 6.1 适用范围

只对 Public Surface 做 `messages/*.json` 提取。

适用对象：

1. Header
2. Footer
3. 首页 Hero / CTA
4. About / Pricing / Learn / Support 页面的固定 UI
5. 公共法律页文案

暂不要求对 dashboard 内部所有组件做文案抽离。

### 6.2 文案提取原则

1. 固定 UI 文案进入 messages 文件。
2. 内容正文不进入 messages，继续由 Markdown 承载。
3. SEO metadata 文案也要能按 locale 输出，不要只翻译组件可见文本。

---

## 7. Middleware 与请求处理

### 7.1 Middleware 职责

Middleware 只做 public 页面 locale 解析与重写，不做业务鉴权，不碰 API 数据层。

需要排除：

1. `/api/*`
2. `/dashboard/*`
3. `/admin/*`
4. `/status/*`
5. 静态资源、PWA、图片、站点文件

### 7.2 推荐行为

1. 默认访问 public 页面时走中文无前缀 URL。
2. 明确访问 `/en/...` 时进入英文页面。
3. 可选地基于 `Accept-Language` 做轻量提示，但不强制首次跳转。

不建议一上来强制自动跳英文。

原因：

1. 会扰动当前中文站 SEO 主路径。
2. 会增加分享链接与归因分析复杂度。
3. 对你们当前以中文为主的产品现实不划算。

---

## 8. 对现有应用的影响控制

### 8.0 生产保护约定: `app.ziso.cc` 不在本次改造范围内

`app.ziso.cc` 是当前核心生产应用。

本次全球化项目在立项与实施上必须遵守以下硬约束：

1. `app.ziso.cc` 不纳入本次国际化改造范围。
2. 本次改造不得要求 `app.ziso.cc` 变更现有 URL 结构。
3. 本次改造不得要求 `app.ziso.cc` 接入 `next-intl`、locale layout、locale middleware 或多语言 provider。
4. 本次改造不得改变 `app.ziso.cc` 的登录态、Cookie、缓存键、PWA、Service Worker、API 路由和客户端导航逻辑。
5. 若某项全球化实现方案会对 `app.ziso.cc` 产生路径、缓存、鉴权、构建或运行时影响，则该方案在本阶段视为不合格方案，必须改写。

这不是“尽量避免影响”，而是明确约定：

`app.ziso.cc` 在本项目中的定位是受保护生产面，不作为国际化试验场，不接受顺手接入，不接受渐进式侵入。

### 8.0.1 实施验收条件

任一国际化相关 PR 在合入前，都应满足以下验收条件：

1. 不新增任何 `app.ziso.cc` 专属页面的 locale 前缀版本。
2. 不修改任何 `app.ziso.cc` 现有深链接或应用内跳转协议。
3. 不调整任何 `app.ziso.cc` API 路由入口与鉴权行为。
4. 不让 middleware 命中 `dashboard`、`admin`、`status`、`api` 相关请求。
5. 不把 public 站点的 metadata、SEO、sitemap、content fallback 逻辑注入到 `app.ziso.cc`。

### 8.1 Dashboard

目标是“尽量零影响”，但要靠边界实现，不是靠口头结论实现。

控制原则：

1. `dashboard` 不纳入 `[locale]`。
2. Dashboard layout 不依赖 i18n provider。
3. Dashboard 的 SEO、PWA、缓存逻辑维持独立。
4. Dashboard 内现有 API URL、客户端缓存键、深链接参数不因 locale 改变。

### 8.2 Auth 与 Cookie

只要 app 面不纳入 locale 路由，Auth 风险会显著降低。

仍需注意：

1. locale cookie 不应覆盖业务 cookie。
2. middleware 不应对鉴权请求做副作用重写。
3. 登录后跳转路径不要被错误拼上 locale 前缀。

### 8.3 PWA 与缓存

1. `manifest.json`、`sw.js`、图标资源继续放在根层。
2. 若未来 public 页面按 locale 预渲染，需避免把 locale HTML 缓存策略误应用到 dashboard。

---

## 9. 分阶段实施建议

### Phase 1: SEO / GEO 基础设施

目标：先让 public 页面具备可被正确索引的多语言框架。

交付项：

1. public-only locale routing
2. locale-aware metadata builder
3. locale-aware sitemap
4. hreflang / x-default 输出
5. 翻译缺失页的 canonical / noindex 策略

### Phase 2: UI 文案国际化

交付项：

1. 首页、About、Pricing、法律页 messages 提取
2. Header / Footer 语言切换器
3. 公共导航与 CTA locale 化

### Phase 3: 内容系统国际化

交付项：

1. Learn / Support 内容模型升级
2. locale-aware content loader
3. locale alternates
4. 翻译状态可见化

### Phase 4: 内容运营与分发

交付项：

1. 按语言输出文章 feed / sitemap
2. 结构化数据完善
3. GEO 导向内容模板
4. 翻译发布流程与质量校验

### Phase 5: 市场版本预研

此阶段才进入：

1. 更多市场内容分支
2. 独立 NYSE / US market edition
3. 市场维度品牌与产品拆分
4. locale 与 market 组合规则

---

## 10. V2 最终建议

最终建议可以概括为三句话：

1. 先做 public 内容国际化，不动交易应用主链路。
2. 先把 SEO / GEO 做对，再扩大语言页面覆盖面。
3. 现在只落 locale，但架构上绝不把 locale 当成未来 market edition 的替代物。

如果后续进入实施，建议先从 Phase 1 开始，优先完成 public routing、metadata、sitemap、内容回退索引策略四项基础设施，再进入页面文案翻译与内容搬迁。
