---
title: "International V1 Release Engineering Review"
doc_id: "eng-international-v1-release-review-20260411"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-04-11"
summary: "国际版 v1 发布前的端到端工程 review 清单与当前结论，覆盖自动门禁、公开站 SEO/GEO/i18n、支付身份链路、生产准备与 go/no-go 规则。"
---

# International V1 Release Engineering Review

## 1. Review Objective

这次 review 的目标不是重复全量功能测试，而是在正式发布前回答 3 个工程问题：

1. 国际用户能否顺利进入产品
2. 关键发布资产是否以正确形式对外暴露
3. 出现问题时是否能在可接受时间内定位和回退

本文件同时承担两种角色：

1. 发布前执行清单
2. 2026-04-11 当前仓库状态的 review 结果记录

当前范围只覆盖国际版 v1 端到端发布链路，不包含 `admin` 内页和内部研究 workflow 验收。

## 2. Go / No-Go Rule

- `Passed`
  - 自动门禁通过
  - 支付/身份主链路无阻断
  - 公开发布资产无结构性 SEO 错误
- `Passed with risk`
  - 核心链路可发布
  - 但存在不阻断的监控、文案、分析埋点或资产完善项
- `Blocked`
  - 任一自动门禁失败
  - 支付链路失败
  - 后端稳定回归不通过
  - 公开页 canonical / sitemap / robots 结构错误影响主入口索引

## 3. Execution Checklist

### 3.1 Automated Gates

- [x] `cd frontend && npm run verify:release`
- [x] `cd frontend && node --test tests/quality-gates.test.mjs`
- [x] `cd . && ./scripts/run_backend_tests.sh --suite unit`
- [x] `cd frontend && npm run db:sync-local:incremental`
- [x] `cd frontend && npm run db:audit-local`
- [x] 生产域名公开资产抽查：`robots.txt` / `sitemap.xml` / `llms.txt`
- [x] 支付链路代码 review：checkout / portal / webhook
- [x] 部署后复查脚本已补齐：`cd frontend && npm run verify:production-hosts`

Release gate 判定规则：

1. `build`、`test:quality`、`verify:dashboard-entry`、`verify:dashboard-interaction`、`verify:dashboard-refresh` 必须全部通过
2. 任意 `console:error`、`pageerror`、受保护 API contract 失败都算 blocker
3. 后端 unit suite 失败按 blocker 处理，除非明确隔离出与本次发布无关且已书面豁免

### 3.2 Public Surface: SEO / GEO / i18n

- [x] 根路径英文站可访问
- [x] `/cn`、`/ko`、`/es` 公开站路由存在
- [x] `/dashboard` 在 marketing host 上会跳转到 `app.ziso.cc`
- [x] `robots.txt` 指向正式 sitemap，并屏蔽 `/api/`、`/admin/`
- [x] `sitemap.xml` 不发布 `/en/*` 旧路径
- [x] `llms.txt` 存在于公开静态资源
- [x] 英文首页、英文定价页无中文硬编码暴露
- [ ] 生产域名下实际抓取 `robots.txt` / `sitemap.xml` / `llms.txt`
- [ ] Search Console / 实际爬虫视角抽查 canonical / hreflang

### 3.3 Identity / Pricing / Payment Path

- [x] `/api/checkout` 对 `priceId` 做白名单校验
- [x] 国际定价常量存在 USD 价格 ID
- [x] Checkout 成功/取消回跳指向 app 域名 dashboard
- [x] Stripe webhook 写回用户订阅与 customer ID 的链路代码存在
- [ ] 真实国际新用户从公开站到支付完成的手工串联验证
- [ ] 已注册国际用户重复进入 dashboard 的手工验证
- [ ] 支付取消返回的手工验证

### 3.4 Production Assets / Monitoring / Rollback

- [x] `manifest.json`
- [x] `sw.js`
- [x] `offline.html`
- [x] `logo.png`
- [ ] `og-image.png`
- [x] GA4 仅在 `ziso.cc` host 注入
- [x] Clarity 仅在 `ziso.cc` host 注入
- [ ] 国际流量按 locale / 来源细分的分析维度确认
- [ ] iOS Safari / Home Screen PWA 最小人工冒烟
- [ ] 生产观察面板与回滚 owner 确认

## 4. Current Review Result (2026-04-11)

### 4.1 Commands Actually Run

```bash
cd frontend && npm run verify:release
cd frontend && node --test tests/quality-gates.test.mjs
cd . && ./scripts/run_backend_tests.sh --suite unit
cd frontend && npm run db:sync-local:incremental
cd frontend && npm run db:audit-local
cd frontend && npm run verify:production-hosts
python - <<'PY'  # requests 抽查 www.ziso.cc 的 robots/sitemap/llms 与 metadata
...
PY
```

### 4.2 Result Summary

- Frontend release gate: `PASS`
- Frontend public i18n/SEO gate: `PASS`
- Backend unit suite: `PASS`
- Local production-like data sync baseline: `PASS`
- Production host verification: `FAIL`
- Current overall verdict: `Blocked`

仓库自动门禁层面已经转绿：前端 `verify:release` 通过，后端 `unit` suite 通过，并且本地 SQLite 已能通过增量同步对齐线上关键数据表，用于更接近生产状态的功能模拟。但生产域名复查脚本当前直接失败，说明线上环境尚未完成 host 收口，因此当前真实状态必须标记为 `Blocked`。

## 5. Findings

### 5.1 Passed

1. 前端 `verify:release` 所需的公开站 contract 已收口：
   - marketing host `/dashboard` 会 307 到 `https://app.ziso.cc/`
   - app host locale 前缀保护行为存在
   - sitemap 已统一回根域 `https://ziso.cc`
2. `robots.txt` 与 `sitemap.xml` 已统一使用 `https://ziso.cc`
3. `llms.txt`、`manifest.json`、`sw.js`、`offline.html` 当前都存在
4. 英文首页与英文定价页本地静态扫描未发现中文硬编码
5. `run_backend_tests.sh --suite unit` 的空参数崩溃已修复，测试入口现在可正常执行
6. 后端 unit suite 已恢复为全绿
   - 结果：`190 passed, 16 deselected`
   - 关键修复面：notification aggregation 兼容、模板兜底、signal semantics 标签一致性、market facts 在降级环境下的韧性
7. 本地数据环境现在可做增量线上同步
   - `frontend/scripts/sync-remote-to-local.mjs` 已支持 schema drift 自愈：当远端新增列或本地表结构滞后时，会按表级重建并回退到全量刷新
   - `npm run db:audit-local` 已确认 `integrity_check = ok`
   - 当前关键表已具备本地验证所需数据量：`daily_prices`、`stock_meta`、`users`、`user_watchlist`、`ai_predictions_v2`、`llm_traces`、`mode_decision_log`、`mode_performance_snapshot`
8. OG metadata 现已改为引用仓库中真实存在的 `/logo.png`，不再依赖缺失的 `/og-image.png`
9. 支付主链路代码检查已确认：
   - `/api/checkout` 只接受白名单 `priceId`
   - checkout `success_url` / `cancel_url` 都回跳到 `app.ziso.cc/dashboard`
   - billing portal `return_url` 也回到 `app.ziso.cc/dashboard`
   - Stripe webhook 会写回 `subscription_tier`、`subscription_expires_at`、`stripe_customer_id`
10. 生产公开资产已实测可访问
   - `https://www.ziso.cc/robots.txt` -> `200`
   - `https://www.ziso.cc/sitemap.xml` -> `200`
   - `https://www.ziso.cc/llms.txt` -> `200`
11. 已补充可复用的生产 host 验证脚本
   - 入口：`frontend/scripts/verify-production-hosts.mjs`
   - 覆盖：`www -> ziso.cc` 永久重定向、robots/sitemap/llms/logo 可访问性、canonical/hreflang、`/` `/pricing` `/cn` `/es` `/ko` 的首屏 `html lang`

### 5.2 Blockers

1. 当前生产环境仍未完成 `www.ziso.cc -> ziso.cc` 永久重定向
   - 复现命令：`cd frontend && npm run verify:production-hosts`
   - 现象：脚本失败于 `Expected permanent redirect for /robots.txt, got 200`
   - 影响范围：`robots.txt` / `sitemap.xml` / `llms.txt` 与 canonical host 仍存在双重真相，按本次 go/no-go 规则应判定为 `Blocked`
2. 当前工作站缺少可直接执行的 Vercel 部署上下文
   - 现象：无全局 `vercel` CLI、无 `frontend/.vercel/project.json` 绑定；`npx vercel` 可下载安装 CLI，但当前环境未提供已登录且已绑定项目的部署上下文
   - 影响范围：无法在本轮直接把 `frontend/vercel.json` 推到线上验证
   - 建议 owner：负责线上部署的工程 owner 在已绑定项目的环境中完成部署后，立即执行 `npm run verify:production-hosts`

### 5.3 Non-Blocking Risks

1. GA4 / Clarity 当前只按 host 控制注入，没有在本次 review 中确认国际流量的 locale/source 细分维度是否足够
   - 当前判断：`Passed with risk`
   - 影响：发布后分析国际流量来源与 locale 表现会受限
2. iOS Safari / Home Screen PWA 手工检查尚未完成
   - 当前判断：未完成，不可视为通过
3. 本地增量同步不会自动处理远端删除
   - 当前判断：`Passed with risk`
   - 影响：本地模拟环境适合高覆盖功能测试，但不应被误认为是强一致镜像
   - 建议：发布前关键验证日若发现统计偏差，执行一次全量同步校准
4. 非英文 locale 页面首屏 HTML 的 `lang` 仍为 `en`
   - 当前判断：`Passed with risk`
   - 现象：线上 `https://www.ziso.cc/cn`、`/es` 的返回 HTML 中 `<html lang="en">`，语言切换依赖客户端脚本后改写
   - 影响：SEO 抓取、无脚本环境与首屏语义标注可能退化
   - 当前状态：由于根 layout 一旦使用动态 API 会打破 SSG release gate，这项修复尚未安全落地，仍需采用不破坏 SSG 的实现方式

## 6. Required Manual Checks Before Release

以下项目本地静态 review 不能替代，发布前仍需人工完成：

1. 国际新用户首次访问 -> 注册/会话建立 -> Checkout -> 支付回跳 -> Dashboard
2. 支付取消返回
3. 国际已注册用户重复进入 dashboard
4. iOS Safari 打开首页与 dashboard
5. iOS 冷启动 / 断网 fallback / 恢复联网
6. 生产域名下 `robots.txt`、`sitemap.xml`、`llms.txt` 实际可访问性
7. 发布后观察面板与回滚 owner 确认

## 7. Release Decision

截至 2026-04-11 15:55 CST，国际版 v1 的工程 review 结论为：

**Blocked**

原因：

1. 前端国际公开面自动门禁已通过
2. 后端 unit suite 已恢复为全绿，自动门禁不再阻塞发布
3. 本地数据环境已可通过增量同步贴近线上状态，支持更高覆盖率的功能测试与模拟
4. 但生产 `www -> ziso.cc` 收口尚未在线上生效，`verify:production-hosts` 当前失败，按本次规则必须视为 `Blocked`
5. 支付/iOS/生产域名人工验证也尚未完成，因此暂不应给出最终 `Passed`

推荐下一步：

1. 在已绑定 Vercel 项目的环境中部署当前前端改动
2. 部署后立即运行 `cd frontend && npm run verify:production-hosts`
3. 用本地增量同步后的数据环境完成国际用户关键路径模拟
4. 完成支付/iOS/生产域名人工验证
5. 采用不破坏 SSG 的实现方式修复非英文 locale 的首屏 `html lang`
6. 确认 GA4 / Clarity 是否具备 locale/source 细分维度
7. 完成后把结论从 `Blocked` 收口到 `Passed` 或 `Passed with risk`
