---
title: "App Locale Resolution Model"
doc_id: "eng-i18n-app-locale-resolution-model-20260415"
doc_domain: "engineering"
doc_status: "draft"
owner: "founder"
last_reviewed_at: "2026-04-15"
summary: "定义 StockWise App 侧语言解析的长期模型，并记录 2026-04-15 invite 首访语言 bug 的已验证根因、当前止血状态与后续清理 backlog。"
---

# App Locale Resolution Model

## 0. 决策摘要

1. 首次访问时，如果用户档案还没有 `locale`，则使用当前环境语言作为应用语言。
2. 首次确定出的应用语言应写入 `users.locale`。
3. 后续访问默认优先使用 `users.locale`。
4. 用户可以在个人中心手动修改 `users.locale`。
5. `profile.locale = null` 表示“尚未建立语言”，不表示中文。
6. invite 使用单一短链，多数场景默认继承 inviter 的语言上下文；当前 URL locale / 强制英文仅是临时救火补丁，不是正式产品规则。

## 1. 背景

2026-04-15 的线上 incident 暴露出一个根问题：

1. `invite -> onboarding` 链路中的语言控制权不统一
2. 首次访问的环境语言识别与落库存在 bug
3. `profile.locale = null/empty` 与 `profile.locale = cn` 在历史实现中被混为一谈
4. 环境语言、跨子域 cookie、本地缓存、持久化档案之间缺少单一事实源

本文件既记录长期模型，也记录本次 bug 的已验证根因与临时补丁边界，避免后续团队把救火逻辑误认为正式规则。

## 1.1 本次 Incident 的最终代码结论

2026-04-15 这次 `invite -> onboarding` 语言故障，已经通过本地代码复现与 Playwright + SQLite 验证，结论如下：

1. 英文环境首访时，客户端首轮 `bootstrap` 请求实际上已经正确上报了 `locale = en`
2. 根因不在浏览器环境识别失败，也不在首轮请求体传错
3. 真正的问题出在“新用户首次建档”与“服务端过早信任持久化 locale”之间的组合

已验证的根因链：

1. [`/api/user/register`](/Users/yesun/Code/stockwise/frontend/src/app/api/user/register/route.ts:63) 历史上创建匿名用户时不写 `locale`
2. 历史 schema 中 `users.locale` 存在 `DEFAULT 'cn'`
3. 因此新用户首条 `users` 记录会在 register 阶段被默认写成 `cn`
4. invite 用户随后在 bootstrap 中会被升级为 `go`
5. 服务端历史上会过早相信已持久化的 `user.locale = cn`
6. 最终表现为：浏览器环境是英文，但 onboarding 仍被压回中文

因此，这次 bug 的根因不是“我们不会识别英文环境”，而是：

1. 首次 register 没有显式持久化环境语言
2. 数据库默认值把未知语言错误地写成了 `cn`
3. invite 用户在未完成 onboarding 前被升级为 `go`，导致服务端过早相信了错误的持久化 locale

## 2. 结论

未来必须明确四个不同层次：

1. `环境语言`
2. `用户偏好语言`
3. `会话语言`
4. `内容语言`

但在 StockWise 当前产品定义下，有一个更直接的事实：

1. 匿名用户也是用户
2. 匿名用户首次访问时，根据环境语言写入 `users.locale` 是合理的
3. 用户后续可以在个人中心手动修改语言

因此，当前问题的核心不是“匿名用户不该承载语言”，而是：

1. 首次环境语言没有被稳定、正确地识别
2. 首次识别出的语言没有被稳定写入或消费
3. 后续链路存在覆盖、回退或默认值污染

## 2.1 当前代码核实结果

以下结论已经基于当前仓库代码核实，不是抽象建议：

1. App runtime locale 的主解析入口当前仍分散在多处，而不是一个统一函数：
   - [`frontend/src/lib/i18n.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/i18n.ts:104)
   - [`frontend/src/hooks/useDashboardAuthorization.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardAuthorization.ts:42)
   - [`frontend/src/lib/user-bootstrap-server.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/user-bootstrap-server.ts:47)
2. `LocaleProvider` 当前仍以 `localStorage -> cookie -> profile -> browser -> default` 的顺序初始化：
   - 见 [`frontend/src/lib/i18n.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/i18n.ts:104)
3. App 首次 bootstrap/profile 同步已新增 URL `locale` 优先级，但这套优先级尚未回流到 `resolveLocale()` 本身：
   - 见 [`frontend/src/hooks/useDashboardAuthorization.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardAuthorization.ts:42)
4. 当前服务端 bootstrap/profile 已支持：
   - `profile.locale` 为空时回退当前请求 locale
   - 对已有但 `locale` 为空的用户壳，会补写当前请求 locale
   - 见 [`frontend/src/lib/user-bootstrap-server.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/user-bootstrap-server.ts:45)
5. `ziso.cc/v/:code` 当前已经做了“国际 invite 强制英文”特判：
   - 跳转到 `app.ziso.cc` 时附加 `locale=en`
   - 并写入 `ziso_locale=en`
   - 见 [`frontend/src/middleware.ts`](/Users/yesun/Code/stockwise/frontend/src/middleware.ts:175)
6. 当前客户端 register 已显式上报首次环境语言，不再依赖 DB 默认值：
   - 见 [`frontend/src/lib/user.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/user.ts:24)
   - 见 [`frontend/src/app/api/user/register/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/user/register/route.ts:20)
7. 当前 schema 定义与运行时补列逻辑，均已从 `users.locale DEFAULT 'cn'` 调整为无默认值：
   - 见 [`backend/database.py`](/Users/yesun/Code/stockwise/backend/database.py:455)
   - 见 [`backend/database.py`](/Users/yesun/Code/stockwise/backend/database.py:1160)
8. 官网公开路由的 locale 默认值仍是 `en`，这是 public site 路由规则，不等价于 App 用户偏好：
   - 见 [`frontend/src/lib/public-i18n.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/public-i18n.ts:1)

因此，当前系统状态应被定义为：

1. `invite -> onboarding` 英文主链路已通过根因修复 + 显式补丁双层保护恢复
2. 服务端对空 `profile.locale` 的解释已经修正
3. 首次 register 已显式持久化环境语言，不再依赖 DB 默认值
4. 但 App 侧仍未完成“单一 locale 解析事实源”收口
5. `invite` 强制英文补丁仍在线上逻辑中，属于后续应移除的临时保护层

## 3. 四层模型

### 3.1 环境语言

环境语言表示“这一次访问”的事实。在 StockWise 当前产品定义下，它也是首次建立用户应用语言的来源。

典型来源：

1. URL 显式参数，如 `?locale=en`
2. locale 路径前缀
3. 跨子域 cookie，如 `ziso_locale`
4. 浏览器 / 设备语言
5. `Accept-Language`

原则：

1. 环境语言可以驱动匿名态首屏
2. 对首次访问用户，环境语言可以初始化并写入 `users.locale`
3. 对已有用户，环境语言不应无条件覆盖已持久化的 `users.locale`

### 3.2 用户偏好语言

用户偏好语言表示“用户已经明确确认过的长期选择”。

允许来源：

1. 用户首次访问时，由环境语言确定的应用语言
2. 用户在 App 中手动切换语言
3. onboarding/注册流程中若存在语言确认，也可以更新

在 StockWise 当前产品定义下：

1. 匿名用户不是“无意义会话壳”，而是真实用户的早期形态
2. 因此匿名用户根据首次环境语言写入 `users.locale` 是合理的
3. 后续实名/升级并不改变这条语言语义，只是延续同一用户档案

原则：

1. 一旦存在，用户偏好语言高于环境语言
2. 用户偏好语言应持久化到 DB
3. 用户偏好语言为空时，必须被解释为“未知”，不能等价于 `cn`

### 3.3 会话语言

会话语言表示“当前页面实际渲染所使用的语言”。

它应是统一解析函数的结果，而不是多个组件分别猜测的结果。

原则：

1. 会话语言是运行时结果
2. 组件只能消费它，不能各自决定它
3. middleware、bootstrap API、profile API、dashboard client 必须共享同一套决策规则

### 3.4 内容语言

内容语言与 UI 语言不是同一回事。

至少应区分：

1. UI 文案语言
2. AI reasoning / brief 内容语言
3. 股票名称显示语言
4. support / marketing 内容语言

原则：

1. `ui_locale` 与 `content_locale` 最终应拆分
2. 不应默认假设 UI 语言切换后，所有历史内容都天然同语言

## 4. 统一优先级

App 侧未来应统一遵循下面的优先级：

1. 已存在的用户档案语言
2. 当前浏览器 / 设备环境语言
3. 会话 / cookie 中的同步语言
4. 默认值

对应伪代码：

```ts
resolvedLocale =
  persistedUserPreference
  ?? browserLocale
  ?? sessionOrCookieLocale
  ?? defaultLocale;
```

关键约束：

1. 首次访问时，如果 `profile.locale` 不存在，则应由环境语言确定并写入
2. 后续访问时，如果 `profile.locale` 已存在，则应优先使用它
3. `profile.locale = null` 必须表示“尚未建立语言”，而不是中文
4. URL 语言不属于正式产品能力定义

## 4.1 与当前代码的差异

当前代码与上面的目标优先级并不完全一致：

1. [`resolveLocale()`](/Users/yesun/Code/stockwise/frontend/src/lib/i18n.ts:104) 当前顺序是：
   - `localStorage`
   - `cookie`
   - `profile`
   - `browser`
   - `default`
2. 当前 `browser` 优先级低于 `localStorage / cookie / profile`
3. `URL locale` 只在 [`useDashboardAuthorization()`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardAuthorization.ts:42) 这条链路中被提升为显式优先级，但这属于临时救火，不是正式产品模型
4. 因此“统一优先级”目前只是目标，不是全局事实

这意味着：

1. 只要某个页面或模块绕过 `useDashboardAuthorization()` 直接调用 `resolveLocale()`，就仍可能得到旧顺序
2. 当前 invite 英文化主要依赖入口特判，而不是“首次信环境、后续信 profile”模型已经完成收口

## 5. 当前实现的根问题

### 5.1 首次环境语言识别与持久化不稳定

当前真正的问题不在于“匿名用户是否应该有语言”，而在于：

1. 首次环境语言没有被稳定识别
2. 首次识别出来的语言没有稳定写入或稳定回读
3. 后续存在 cookie / 本地缓存 /旧值覆盖
4. 导致英文环境首次进入仍可能表现为中文

这会导致：

1. 首次体验语言与环境不一致
2. 同一用户在首次和后续访问看到不同语言
3. 语言字段失去可信度

### 5.2 空 locale 被错误解释

历史实现中的一个典型错误是：

1. `profile.locale = null/empty`
2. 被直接解释成 `cn`

这会把“未知”错误翻译成“中文偏好”。

正确解释应该是：

1. `profile.locale` 有值：说明存在已知偏好
2. `profile.locale` 为空：说明不存在已知偏好，应回退到当前环境语言

### 5.3 invite 链路过度依赖自动推断

国际 invite 是增长主入口，不能完全依赖隐式猜测。

问题在于：

1. 浏览器语言
2. cookie
3. 匿名 profile
4. 站点区域导向

这些层都可能互相覆盖。

但这条“显式语言握手”在当前系统里只是临时救火，不应被误写成长期产品规则。

### 5.4 当前止血方案的边界

当前线上能够稳定恢复英文 invite 首访，依赖两层保护：

1. 根因修复
   - 首次 register 显式写入环境语言
   - bootstrap 对空 locale 用户壳做补写
   - schema 不再依赖 `DEFAULT 'cn'`
2. 临时补丁
   - invite 短链入口强制附加 `locale=en`
   - 并写 `ziso_locale=en`

这两层保护的角色不同：

1. 根因修复是正式能力，应长期保留
2. invite 强制英文补丁是临时保护层，应在观察期后移除

## 6. 未来目标模型

### 6.1 用户表语义

`users.locale` 的长期目标语义应收口为：

`用户已经明确确认过的偏好语言`

这意味着：

1. 新用户首次访问时，可以根据环境语言初始化 `locale`
2. 后续 `locale` 就表示该用户当前应用语言
3. 用户可在个人中心修改 `locale`
4. `NULL` 只表示“尚未建立语言”，不表示中文

与当前代码对照：

1. 当前 [`prepareUserBootstrapPayload()`](/Users/yesun/Code/stockwise/frontend/src/lib/user-bootstrap-server.ts:196) 在新建匿名用户时，会把 `preferredLocale` 直接写入 `users.locale`
2. 这与当前产品定义是兼容的
3. 当前真正的问题不是“写入本身不合理”，而是“首次写入的语言有时写错或被覆盖”

### 6.2 invite 入口

invite 链路应具备显式语言语义。

但这不意味着要把 invite 链路拆成“中英文两套短链”，也不意味着 URL 语言要成为正式产品能力。

从产品体验看，invite 应该对多数用户无感：

1. 中文用户在中文环境中复制邀请链接，默认多数会发送给中文用户
2. 英文用户在英文环境中复制邀请链接，默认多数会发送给英文用户
3. 用户不应该为了发送邀请链接而先学习“该选哪种语言短链”

因此，长期规则不应是“为每种语言准备不同 invite shortlink”，而应是：

1. invite shortlink 保持单一
2. 邀请链接默认继承“邀请发起人生成链接时的语言上下文”
3. 被邀请人若还没有自己的已存语言，则 onboarding 前优先使用该 invite 语言上下文
4. 被邀请人若已有 `users.locale`，则仍以该值为准

更符合当前产品定义的 invite 语言优先级应为：

1. 被邀请人已存在的 `users.locale`
2. invite 携带的 inviter locale context
3. 被邀请人当前环境语言
4. 默认值

关键约束：

1. `inviter locale context` 可以用于初始化被邀请人的首次语言
2. 但不应被错误默认值或旧污染覆盖
3. onboarding 后若用户明确切换语言，应以用户自己的设置为准
4. URL locale 不应成为正式产品规则

### 6.3 onboarding 前后的写入边界

在 onboarding 完成前：

1. 允许使用首次环境语言或 invite context 驱动首屏
2. 如果用户档案还没有语言，可以把首次确定出的语言写入 `users.locale`
3. 不应让错误默认值覆盖已确定的语言

在 onboarding 完成后：

1. 用户继续沿用已有 `users.locale`
2. 用户若在个人中心切换语言，则更新 `users.locale`

## 7. 统一解析函数

长期应把语言决定权收口到统一解析层，例如：

1. `resolveRequestLocale(request, profile?)`
2. `resolveClientLocale({ url, cookie, storage, profile, browser })`

原则：

1. middleware 不得自定义一套规则
2. bootstrap/profile API 不得自定义另一套规则
3. React client 不得再自行拼装第三套规则
4. 该统一解析层应遵循“首次信环境、后续信 profile、个人中心可修改”的产品定义

## 8. 分阶段改造建议

### Phase 1: 语义收口

目标：

1. 停止把空 locale 解释成 `cn`
2. 明确首次环境语言就是用户语言的初始化来源
3. 明确后续访问应优先使用 `users.locale`

建议动作：

1. 统一所有 locale 解析 helper
2. 修复首次环境语言识别与写入
3. 给 invite/onboarding 链路建立回归测试

当前完成度：

1. `profile.locale` 为空时不再被解释为 `cn`：已完成
2. invite/onboarding 回归测试：已完成
3. 统一所有 locale helper：未完成
4. 首次环境语言稳定写入：已完成

### Phase 2: 入口显式化

目标：

1. 关键增长入口在多数场景下无感工作

建议动作：

1. invite 生成时记录 inviter 的 locale context
2. invite 落地时优先消费 invite context，而不是只依赖浏览器猜测
3. 关键跳转时同步跨子域 locale cookie
4. 保留当前 URL locale 仅作为临时救火与调试能力，不写入正式产品规则

当前完成度：

1. `invite` 短链显式带 `locale=en`：已完成
2. app 侧把 URL locale 视为显式语言：已完成，但仅覆盖 dashboard authorization 链路，且不应视为长期正式方案
3. 关键跳转同步 `ziso_locale`：已完成
4. invite 生成时携带 inviter locale context：未完成

### Phase 3: 偏好与内容解耦

目标：

1. UI 语言与内容语言从概念上分离

建议动作：

1. 定义 `ui_locale`
2. 定义 `content_locale`
3. 评估 DB schema 是否需要新增显式偏好字段

当前完成度：

1. prediction / reasoning 侧已有 `content_locale` 概念，但并未成为 App 全局标准
2. UI locale 与内容 locale 的统一分层尚未完成
3. DB schema 尚未区分 `locale` 与 `locale_preference`

## 9. Backlog

### P0 观察项

1. 观察线上新 invite 用户的 `users.locale` 是否稳定按环境写入
2. 确认不再出现“英文环境首访落成 `cn`”的新样本
3. 按日抽查 invite 新用户的 `locale / tier / has_onboarded` 组合，防止回归

### P1 清理项

1. 移除 [`frontend/src/middleware.ts`](/Users/yesun/Code/stockwise/frontend/src/middleware.ts:175) 中的 invite 强制 `locale=en` 与 `ziso_locale=en`
2. 移除 [`frontend/src/hooks/useDashboardAuthorization.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardAuthorization.ts:43) 中把 URL locale 作为最高优先级的临时特判
3. 将 invite 入口恢复为“单一短链 + 多数场景无感继承上下文”的正式模型

### P2 架构项

1. 统一 `frontend/src/lib/i18n.ts`、`useDashboardAuthorization()`、`user-bootstrap-server.ts` 的 locale 解析 helper
2. 收口为“首次信环境、后续信 `users.locale`、个人中心可修改”的单一事实源
3. 为 invite context 建立正式数据模型，而不是继续依赖 URL locale 补丁

## 10. 当前临时修复与长期方案的关系

2026-04-15 的修复分为两层：

1. 根因修复
   - `register` 显式持久化首次环境语言
   - `bootstrap` 对空 locale 用户壳补写
   - schema 不再依赖 `DEFAULT 'cn'`
2. 临时保护
   - invite 入口强制 `locale=en`
   - app 侧把 URL locale 视为显式语言

当前国际 invite 首进英文链路已经恢复，但长期仍必须继续完成：

1. 统一语言解析函数
2. 移除 invite 强制英文补丁
3. 建立“首次信环境、后续信 profile、个人中心可修改”的完整实现闭环

## 11. 决策摘要

未来的标准不是“更聪明地猜语言”，而是：

1. 首次访问时，环境语言就是应用语言
2. 首次确定出的语言要稳定写入用户档案
3. 后续访问默认信 `users.locale`
4. 用户可在个人中心修改 `users.locale`
5. invite 在多数场景下应无感继承 inviter 的语言上下文

这应作为后续 App i18n 与国际增长入口的统一工程标准。
