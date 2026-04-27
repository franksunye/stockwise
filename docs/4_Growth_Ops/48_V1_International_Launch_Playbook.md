# ZISO AI v1 国际版全球发布手册 (GTM Playbook)

> **版本**：v1.1 (2026-04-12)
> **状态**：Execution Draft — Ready after final go/no-go review
> **负责人**：Frank (Founder) + Antigravity (Advanced Agentic AI)

---

## 1. 核心叙事与价值主张 (Narrative & Value Prop)

本次国际版 v1 发布，目标用户不是“所有炒股的人”，而是那些已经意识到 **信息过载、复盘低效、临盘情绪化** 的 **serious retail investors**。

### 1.1 一句话定义 (Elevator Pitch)
- **ZISO AI 是一个为严肃零售投资者提供 AI 盘后研判、关键价位提示与实时提醒的股票研究助手。**

### 1.2 核心用户画像
- 已有基本交易经验，但复盘流程不稳定。
- 不是没信息，而是 **信息太多却没有结构化结论**。
- 希望减少噪音，建立更可持续的 nightly review workflow。
- 更关注 **decision clarity / risk boundary / execution discipline**，而不是“暴富型信号”。

### 1.3 核心主张
- **AI does the research. You keep the decision.**：强调 ZISO 替用户完成盘后研究，但不替代最终判断。
- **DeepSeek-powered Actionable Insights**：突出 Go 版的真实可售卖能力，即更深层的逻辑研判与 tactical brief。
- **Key Levels & Tactical Anchors**：把抽象 AI 落到具体价格结构，帮助用户看到 support / resistance / breakout / stop loss reference。
- **Real-time Alerts for Watchlist Discipline**：强调从“自己盯盘”变成“系统在关键变化时主动提醒”。
- **Silent Math Aesthetic**：极简、冷静、克制。拒绝 noisy hype，只呈现结构化研判与执行边界。

### 1.4 分层定价叙事（对外统一口径）
| 等级 | 当前发布定位 | 核心价值点 | 营销话术 (Copy Hook) |
| :--- | :--- | :--- | :--- |
| **Free** | 体验入口 | 3 只自选 / 基础 AI / 基础通知 | "Start with structure before you scale conviction." |
| **Go** | **本次主卖层** | DeepSeek 推理、10 只自选、200 份月报、盘中结构雷达 | "If you only track 10 names, make every review count." |
| **Plus** | 预热层 / Waiting List | 多模型交叉验证与更高置信度共识 | "Consensus reasoning, when you need a stricter second brain." |

### 1.5 发布口径约束（必须统一）
- **Go 是本次 launch 的成交核心**；所有主物料默认围绕 Go 展开。
- **Plus 仅能作为 upcoming / waitlist 预热点**，不能被描述为当前已完整开放的主功能。
- 对外统一使用：`Free / Go / Plus (Upcoming)`，避免混用 `Pro` 等历史命名。

---

## 2. 访问策略与增长激励 (Access Policy & Incentives)

### 2.1 Launch Access Policy（发布前必须先定）

在正式放量前，必须先确认国际版的入口策略，否则 PH / X / Reddit 的流量会被 invite 流程阻塞。

**当前执行方案：Marketing Open + App Invite Wall + PH Dedicated Invite Entry**
- 官网公开访问：`ziso.cc` 主站与 `pricing` 等营销页保持公开。
- App 入口当前仍有 invite wall，不能把 PH 主流量直接导向普通 app 入口。
- **Product Hunt 主链接固定使用：`https://ziso.cc/v/PH`**。
- `ziso.cc/v/PH` 会跳转至 app 并携带 `invite=PH`，作为 **PH 专用 invite/referral entry**。
- **发布前必须确认 `PH` 已在数据库中绑定为有效的 `referral_alias`**，否则 alias 解析会失败。
- Referral / Activation Code 继续保留，作为增长激励与放量控制手段。

**执行含义**
- PH：优先导向 `https://ziso.cc/v/PH`
- X / Reddit：默认可先导向 `pricing`，若评论区用户明确要试用，再补贴 invite link
- 任何对外文案都不要暗示“完全公开注册”，而要强调 `launch invite link` 或 `trial link`

### 2.2 增长激励政策
- **邀请裂变 (Referral)**：使用邀请链接注册的新用户，直接赠送 **5 天 Go 体验**。
- **反馈回赠 (Feedback Reward)**：针对在 PH / Reddit / X 提供高质量反馈的用户，赠送 **30 天 Go 激活码**。
- **Waitlist 收口**：对 Plus 感兴趣的用户，不强卖，统一导入 waitlist / mailbox。

### 2.3 Incentive Ops SOP（执行规则）
| 场景 | 触发条件 | 回赠内容 | Owner | SLA |
| :--- | :--- | :--- | :--- | :--- |
| Referral 注册 | 用户通过邀请链接完成注册并进入产品 | 被邀请人 5 天 Go | 系统自动 | 实时 |
| Referral 完成 onboarding | 被邀请人完成首次 onboarding | 邀请人 5 天 Go | 系统自动 | 实时 |
| PH 高质量反馈 | 明确提出产品、定位、支付、研究逻辑相关建议 | 30 天激活码 | Frank | 24h 内 |
| Reddit/X 深度交流 | 提出高质量问题或真实使用反馈 | 30 天激活码 | Frank | 24h 内 |

### 2.4 高质量反馈判定标准
- 不是单纯说 “cool” / “nice tool”。
- 至少满足以下任一：
  1. 明确指出 onboarding / pricing / narrative 的理解障碍；
  2. 对战术简报、关键价位、通知体系提出具体问题；
  3. 提供真实股票使用案例的反馈；
  4. 提出可执行的产品优化建议。

---

## 3. 多渠道发布阵地 (Channel Strategies)

### 3.1 Product Hunt (PH) - 大爆炸奇点
- **发布窗口**：下周二 (2026-04-14) **00:01 PT** / **15:01 BJT**。
- **核心物料**：
    - **Tagline**: `AI stock research assistant for disciplined retail investors`
    - **Maker's Comment**: 讲述从“信息过载 / generic AI 噪音”到“结构化盘后研判”的诞生故事。
    - **Video**: 30–45 秒纯视觉 Silent Demo（主展示 Tactical Brief、关键价位、reasoning trace、通知）。
    - **Gallery**: 5 张截图，分别覆盖：Hero、Tactical Brief、Key Levels、Notification Discipline、Pricing。
    - **Primary Link**: `https://ziso.cc/v/PH`

- **PH 链接策略**：由于 app 当前仍有 invite wall，PH 页面主 CTA 不走普通 `pricing` 链接，统一使用 `https://ziso.cc/v/PH` 作为专用 invite entry。

**PH 主卖点顺序（严禁打散）**
1. Actionable Insights after the close
2. Key price levels and tactical anchors
3. Real-time alerts across your watchlist
4. Go = current paid core; Plus = upcoming

### 3.2 X (Twitter) - 知识溢出阵地
- **Hero Thread**: 从“信息噪音导致决策失真”切入，而不是一上来攻击所有 LLM。
- **Daily Content**: 每日发布 **“结构化复盘卡片 / tactical brief 视觉化摘要”**，通过 $NVDA / $TSLA / $AAPL 等热门股建立专业感。
- **Reply Strategy**: 优先回复和 `discipline / review process / key levels / alerts` 相关的讨论，而不是泛 AI 论战。
- **Pinned CTA**: 统一导向 `pricing` 页，而不是直接跳随机深链。

### 3.3 Reddit - 创始人背书阵地
- **策略**: Value-First（内容先行）。
- **Subreddits**: `r/stocks`, `r/investing`, `r/algotrading`, `r/DeepSeek`.
- **Founder Story**: 创始人亲自出面讲述“为什么我们要构建一套更冷静、更结构化的盘后研究工具”。
- **Reddit 口径要求**：少用 marketing superlatives，多用具体流程、用户痛点与真实功能描述。

---

## 4. 全量发布物料仓库 (Draft Assets)

### 4.0 对外统一文案底板 (Final Copy Spine)
- **Product Name**: `ZISO AI`
- **Primary Tagline**: `AI stock research assistant for disciplined retail investors`
- **Short Description**: `Review the market after the close, see key price levels, and track your watchlist with structured AI insights and real-time alerts.`
- **Hero Headline**: `AI does the research. You keep the decision.`
- **Primary CTA**: `Start Free`
- **Secondary CTA**: `See Pricing`

### 4.1 Product Hunt Maker Comment
```markdown
Hi Product Hunt! I'm [Your Name], the maker of ZISO AI.

We built ZISO AI for retail investors who already have too much information, but not enough structure.

Most stock tools either flood you with dashboards or give you generic AI summaries. We wanted something calmer: an AI research assistant that helps you review the market after the close, identify key price levels, and stay disciplined the next day.

What makes ZISO different:
- **Actionable Insights**: nightly AI research built for decision clarity, not hype.
- **Key Levels & Tactical Anchors**: support, resistance, breakout, stop-loss reference in one view.
- **Reasoning Transparency**: Go unlocks a deeper logic layer powered by DeepSeek.
- **Watchlist Alerts**: track your names without staring at the screen all day.

Current launch focus:
- **Free** for exploration
- **Go** as the main paid tier
- **Plus** as an upcoming consensus layer

🎁 Launch perk: referral users get 5 days of Go. If you leave thoughtful feedback, we’ll send a 30-day activation code.
```

### 4.1B Product Hunt Listing Fields（定稿）
```markdown
Name: ZISO AI

Tagline: AI stock research assistant for disciplined retail investors

Short Description: Review the market after the close, see key price levels, and track your watchlist with structured AI insights and real-time alerts.
```

### 4.1C Product Hunt Gallery Headlines（定稿）
```markdown
1. Post-close research, without the noise
2. Actionable insights for your watchlist
3. Key levels. Clearer boundaries.
4. Real-time alerts for disciplined execution
5. Go deeper with DeepSeek-powered reasoning
```

### 4.1D Product Hunt Hero Image Copy（定稿）
```markdown
Headline:
AI does the research.
You keep the decision.

Subheadline:
Post-close stock research, key price levels, and watchlist alerts for disciplined retail investors.
```

### 4.1E Product Hunt FAQ（定稿）
```markdown
Q1: What makes ZISO AI different from generic AI stock tools?
A1: Most generic AI tools summarize information. ZISO AI is built around a repeatable workflow: post-close review, structured actionable insights, key price levels, and watchlist alerts. The goal is not to generate more market noise, but to help investors review more clearly and act with better boundaries.

Q2: What do I get in the Go tier?
A2: Go is the current core paid tier. It unlocks deeper reasoning powered by DeepSeek, supports up to 10 watchlist names, includes Session Structure Radar alerts, and provides up to 200 monthly research reports. It is designed for users who want a more disciplined nightly review process.

Q3: Is this investment advice?
A3: No. ZISO AI is a research and alerting tool, not investment advice. It helps users structure their post-close workflow, understand key levels, and track important changes more efficiently, but the final decision always remains with the investor.
```

### 4.2 X (Twitter) Hero Thread
```markdown
1/ Most retail investors don’t lack information. They lack a clean review process.
2/ News, charts, indicators, social feeds — too much input, too little decision clarity.
3/ We built ZISO AI to help serious retail investors review the market after the close.
4/ It turns noise into: actionable insight, key price levels, and watchlist alerts.
5/ Go unlocks deeper reasoning powered by DeepSeek. Plus is our upcoming consensus tier.
6/ If you only track 10 names, every nightly review should matter.
7/ Live now: [Link]
```

### 4.2B X Short Post（备选）
```markdown
Retail investors don’t need more stock noise.
They need a cleaner review process.

We built ZISO AI to help users:
- review the market after the close
- see key price levels
- stay on top of their watchlist with paid Session Structure Radar alerts

Go is live now.
Plus is upcoming.
[LINK]
```

### 4.3 Reddit Founder Story Draft
```markdown
Title: Why we built a calmer DeepSeek-powered stock research assistant for retail investors

Hey r/investing, I'm the founder of ZISO AI.

Like many of you, I'm tired of stock tools that create more noise than clarity. Most people already have enough charts, enough news, and enough opinions. What they don't have is a repeatable review process.

We took a different approach. We built an AI assistant for the post-close workflow: review the day, summarize the setup, mark key levels, and define what matters tomorrow.

Today, the core paid tier is Go. It gives users deeper reasoning powered by DeepSeek, 10 watchlist slots, Session Structure Radar alerts, and a tactical brief with support/resistance style anchors.

We call the product style “Silent Math.” No hype, no “99% accuracy” claims, and no pretending AI should replace judgment.

As a Redditor myself, I know this sounds like another pitch. So don't take my word for it.
Use [Referral Link] for a 5-day Go trial. No credit card required.

Test it against your own watchlist. If it helps you see a key level or a cleaner risk boundary you missed, then it did its job.

I'll be in the comments if anyone wants to talk about workflow design, alerting logic, or where AI should stop and the investor should decide.
```

### 4.3B Reddit Comment Closing Lines（备选）
```markdown
- Happy to share a 5-day Go trial link if anyone wants to test the workflow.
- Curious whether this feels genuinely useful, or just like another layer of stock-tool noise.
- If you try it, I’d especially love feedback on the key levels and alerting flow.
```

### 4.4 评论区短回复定稿 (Fast Replies)
```markdown
Q: Is this financial advice?
A: No. ZISO AI is a research and alerting tool, not investment advice. It helps structure post-close review and decision boundaries, but the final decision remains with the investor.

Q: What makes it different from generic AI tools?
A: Most generic AI tools summarize. ZISO is built around a repeatable workflow: nightly insight, key levels, tactical structure, and alerts for your watchlist.

Q: Why only 10 watchlist names in Go?
A: Because the product is designed for depth and discipline, not endless scanning. The goal is to help users review a focused set of names more consistently.

Q: Is Plus available now?
A: Not as the main launch tier. Go is the current paid core. Plus is the upcoming consensus layer for users who want stricter multi-model validation.

Q: Which markets do you support?
A: ZISO AI currently supports the US, Hong Kong, and China markets.
```

### 4.4B Launch Day 评论区 10 条超短回复 (Ultra-short Replies)
```markdown
1. Appreciate it — built for investors who want a cleaner nightly review process.
2. Totally fair question. It’s a research tool, not investment advice.
3. The main difference is workflow: insight, key levels, alerts, not just AI summaries.
4. Go is the current paid core. Plus is upcoming, not the main launch tier.
5. We currently support US, Hong Kong, and China markets.
6. The 10-name limit is intentional — depth and discipline over endless scanning.
7. Happy to share a 5-day Go trial link if you want to test it yourself.
8. Curious what matters more to you: the key levels, the alerts, or the nightly brief?
9. That’s useful feedback — I’m collecting launch notes and will fold this into the next iteration.
10. Thanks for checking it out. If the workflow feels noisy, I definitely want to hear why.
```

---

## 5. 发布物料准备清单 (Assets Production TODO)

> **目标**：在下周一 (4月13日) 18:00 前完成所有物料的定稿与导出。

### 5.1 Product Hunt (PH)
- [ ] **PH Tagline / Short Description 定稿并回填发布页** (见 4.1B)
- [ ] **PH Maker's Comment 定稿并回填发布页** (见 4.1)
- [ ] **30–45s Silent Demo 视频制作** (展示 Tactical Brief / Key Levels / Reasoning Trace / Alerts)
- [ ] **PH 展位图 (Screenshots) 包装**：按照下述《手机截图包装规范》处理
- [ ] **PH Hero Image 文案定稿并回填设计稿** (见 4.1D)
- [ ] **PH CTA 跳转核对**：主链接固定为 `https://ziso.cc/v/PH`，不要误填为普通 `pricing`
- [ ] **PH Gallery 标题回填** (见 4.1C)
- [ ] **PH FAQ 回填** (见 4.1E)

#### 🎨 手机截图包装规范 (Mobile Mockup Standard)
为了提升移动端截图的视觉溢价，所有 PH 展位图需遵循以下规范：
- **设备模型**：使用 iPhone 15 Pro (深空黑/原色钛金属)，侧倾 15-30 度以增加立体感。
- **画布比例**：1270 x 760 px。
- **背景设计**：纯黑 (#000000) 或深灰色 (#0D0D0D) 渐变。
- **文字标注**：在设备左侧或上方使用 Sans-serif 字体，标注核心功能点（如 *Reasoning Reflection Chain*, *Conflict Detection*）。
- **样板提示词 (Visual Prompt - 后期贴图版)**：
    > *A professional Product Hunt gallery image mockup, 1270x760. Dark mode aesthetic. A high-quality 3D render of a sleek, dark titanium iPhone 15 Pro positioned on the right. The smartphone screen is a pure, matte black surface with subtle, realistic glass reflections and no interface content (blank screen). On the left, minimalist typography: 'DeepSeek-V3 Powered'. The background is a sophisticated charcoal gray gradient.*

- **图生图提示词 (Image-to-Image Prompt - 截屏自动包装版)**：
    > *Create a professional Product Hunt gallery image (1270x760) based on the provided screenshot. Place the screenshot naturally into a high-quality, dark titanium iPhone 15 Pro mockup, positioned on the right side of the canvas. The aesthetic must be 'Silent Math'—ultra-minimalist, sophisticated, and logical. On the left side, add elegant, clean sans-serif typography: 'The Rationale Audit' with subtext 'DeepSeek-V3 Powered'. The background should be a deep, dark charcoal gray gradient with subtle studio lighting to make the device pop. Add very thin, light-gray technical annotation lines pointing to key areas of the dashboard on the phone screen.*

![PH Gallery Mockup from Screenshot](file:///Users/yesun/.gemini/antigravity/brain/f638f8e4-9447-4cec-94af-8879f50f7842/ziso_ph_gallery_from_screenshot_v1_1775816741433.png)

### 5.2 X (Twitter)
- [ ] **X Hero Thread 定稿** (见 4.2)
- [ ] **结构化复盘长图模板** (用于每日发帖，需包含 $NVDA, $TSLA 示例)
- [ ] **X Profile 装修** (确认主页链接指向 `ziso.cc` 且置顶推文)
- [ ] **UTM 规范**：为 Hero Thread、reply CTA、profile link 分配独立来源参数
- [ ] **X 短帖备选文案** (见 4.2B)
- [ ] **X 评论区超短回复备忘** (见 4.4B)

### 5.3 Reddit
- [ ] **Reddit Founder Story 定稿** (见 4.3)
- [ ] **Reddit 互动话术库** (优先使用 4.3B / 4.4 的短回复)
- [ ] **Subreddit 规则审查** (是否允许外链、是否允许 self-promo、是否先发讨论帖)
- [ ] **Reddit 首日评论区超短回复备忘** (见 4.4B)

### 5.4 增长与转化物料
- [ ] **邀请链接 (Referral Link) 落地页体验** (重点验证 `https://ziso.cc/v/PH` 到 app 的跳转与 5 天 Go 体验承接)
- [ ] **30 天反馈激活码池** (准备 100 个生成的激活码用于手动回赠)
- [ ] **Feedback 表单工具选型** (Tally / Typeform / Google Form 三选一)
- [ ] **海外 Feedback 表单上线** (Simple & logic-focused，收集 narrative / pricing / usability 反馈)

---

## 6. D-7 到 D+7 执行排期 (Launch Runbook)

### 6.1 D-7 ~ D-3：素材冻结与口径统一
- [ ] 锁定对外产品定义：Go 主卖，Plus 预热。
- [ ] 锁定 PH / X / Reddit 三渠道统一口径。
- [ ] 确认 pricing 页面、hero video、gallery screenshot 使用同一套卖点顺序。
- [ ] 确认 legal 页面（privacy / terms / refund）可公开访问。

### 6.2 D-2：技术与转化链路 final QA
- [ ] 官网首页、pricing、about、refund、privacy、terms 全部可访问。
- [ ] 国际 Stripe checkout 完整跑通（进入 checkout / success / cancel / portal）。
- [ ] 数据库中已存在可解析的 `referral_alias = PH`。
- [ ] `https://ziso.cc/v/PH` 跳转到 app 并带上 `invite=PH` 的链路跑通。
- [ ] Referral link、redeem code、waitlist mailto 全部可用。
- [ ] 通知开启链路、英文 onboarding、watchlist 添加至少走一遍。
- [ ] 确认 analytics / source tagging 已生效。

### 6.3 D-1：发布阵地预设
- [ ] Product Hunt 草稿完成并二次校对。
- [ ] X Hero Thread 草稿 + 首日 3 条跟进内容准备完毕。
- [ ] Reddit 主帖与 comment reply 模板准备完毕。
- [ ] 激活码池生成并分表管理。
- [ ] 发布当天 owner 值班表确认。

### 6.4 D-Day：发布当天操作序列
| 时间 | 动作 | Owner | 完成标准 |
| :--- | :--- | :--- | :--- |
| T-30min | 最终检查官网、`pricing`、`/v/PH`、checkout、analytics | Frank | 关键链路全部正常 |
| T-0 | 发布 Product Hunt | Frank | PH 页面公开可访问 |
| T+5min | 发布 X Hero Thread | Frank | 线程正常展示，链接可点 |
| T+15min | 发布首条 Reddit 帖 | Frank | 成功发布且未被秒删 |
| T+30min ~ T+12h | 持续回复评论 / 发码 / 收集反馈 | Frank | 每 30–60 分钟检查一次 |
| T+12h | 中期复盘 | Frank | 看 PV、signup、checkout、comment sentiment |
| T+24h | 首日复盘 | Frank | 记录高质量反馈与改动项 |

### 6.5 D+1 ~ D+7：复盘与二次传播
- [ ] 汇总渠道效果：PH / X / Reddit / Direct / Referral。
- [ ] 抽取最佳用户反馈做二次传播素材。
- [ ] 根据评论区高频问题，补 FAQ / pricing copy / support content。
- [ ] 判断是否追加第二轮内容 push。

---

## 7. Go / No-Go 最终审计清单 (Launch Gate)

### 7.1 Acquisition QA
- [ ] `home / pricing / about / privacy / terms / refund` 页面可公开访问。
- [ ] `hreflang`、`sitemap.ts`、`robots.ts` 国际化路径无误。
- [ ] 主页与 pricing 的 OG 图、标题、描述能正确分享。
- [ ] `llms.txt` 已部署，公开可访问。

### 7.2 Conversion QA
- [ ] 非 CN 入口可顺利进入 app。
- [ ] `https://ziso.cc/v/PH` 不会被 invite wall 卡死，且 referral / Go 试用承接正常。
- [ ] Stripe Checkout 可正常进入、成功返回、取消返回。
- [ ] Manage Subscription / cancel portal 可打开。
- [ ] referral link attribution 正常。
- [ ] redeem code 正常。

### 7.3 Product QA
- [ ] 英文首页 / pricing / about 无明显中文硬编码。
- [ ] watchlist 添加逻辑正常。
- [ ] Tactical Brief 可正常打开。
- [ ] Key Levels / Tactical Anchors 正常展示。
- [ ] Reasoning trace / tier gating 与 pricing 文案一致。
- [ ] 通知开启、通知细分类别可见。

### 7.4 Tracking QA
- [ ] GA4 / Clarity / 其他统计工具可用。
- [ ] 至少能区分 PH / X / Reddit / Referral / Direct。
- [ ] signup、pricing CTA、checkout start、checkout success 有埋点或可观察指标。
- [ ] waitlist / feedback submission 可记录来源。

### 7.5 Legal / Trust QA
- [ ] Privacy Policy 可访问。
- [ ] Terms of Service 可访问。
- [ ] Refund Policy 可访问。
- [ ] 风险提示明确：不构成投资建议。

---

## 8. KPI 与归因方案 (Success Metrics & Attribution)

### 8.1 Launch 核心指标
| 层级 | 指标 | 说明 |
| :--- | :--- | :--- |
| Awareness | Landing Page Visits | 官网访问量 |
| Interest | Pricing Page CTR | 进入 pricing 的比例 |
| Acquisition | Signup Conversion | 访问到注册的转化 |
| Activation | Onboarding Completion | 注册到完成 onboarding |
| Product Value | Watchlist Added / Alerts Enabled / Tactical Brief Opened | 用户是否真正进入核心体验 |
| Revenue | Checkout Start / Checkout Success / Go Paid Conversion | 付费转化漏斗 |
| Expansion | Referral Usage / Plus Waitlist | 裂变与高阶兴趣 |

### 8.2 Source Attribution 最低要求
- `utm_source`: `producthunt` / `x` / `reddit` / `referral` / `direct`
- `utm_medium`: `launch` / `thread` / `reply` / `comment` / `profile`
- `utm_campaign`: `v1_international_launch`

### 8.2B UTM 参数模板（直接可用）
```text
Product Hunt main link:
https://ziso.cc/v/PH

X hero thread link:
https://ziso.cc/pricing?utm_source=x&utm_medium=thread&utm_campaign=v1_international_launch

X reply CTA link:
https://ziso.cc/pricing?utm_source=x&utm_medium=reply&utm_campaign=v1_international_launch

X profile link:
https://ziso.cc/pricing?utm_source=x&utm_medium=profile&utm_campaign=v1_international_launch

Reddit post link:
https://ziso.cc/pricing?utm_source=reddit&utm_medium=launch&utm_campaign=v1_international_launch

Reddit comment link:
https://ziso.cc/pricing?utm_source=reddit&utm_medium=comment&utm_campaign=v1_international_launch

Referral landing link:
https://ziso.cc/pricing?utm_source=referral&utm_medium=share&utm_campaign=v1_international_launch
```

### 8.2C 使用规则
- Product Hunt 当前是特例：**主链接固定使用 `https://ziso.cc/v/PH`**，不走普通 `pricing`。
- 其余公开渠道默认优先导向 `pricing`，除非你明确需要导向 app 深链。
- 同一渠道不同位置，必须拆分 `utm_medium`，避免后续归因混在一起。
- 评论区临时贴链也尽量使用带 UTM 的短链或原链。
- 首日不要同时测试太多 landing path，避免归因失真。
- **重要限制**：当前 `/v/*` 跳转链路不会保留 UTM 参数，因此 PH 来源优先通过 invite alias `PH` 识别；如需 PH 粒度更细的 UTM 归因，需要后续单独增强跳转逻辑。

### 8.3 首周观察重点
- 哪个渠道带来的用户最愿意完成 onboarding。
- 哪个渠道带来的用户最愿意开启通知。
- pricing 到 checkout 的掉点在哪里。
- 用户是否理解 Go 与 Plus 的差异。

---

## 9. 评论区 FAQ 与回复口径 (Comment Response Library)

### 9.1 用户可能会问什么
- 这是不是投资建议？
- 你和普通 ChatGPT / Claude / generic AI stock summary 有什么区别？
- 为什么 Go 只给 10 个 watchlist？
- Plus 现在能不能买？
- 为什么要订阅，而不是一次性买断？
- 你们支持哪些市场？
- 你们怎么处理 AI 幻觉问题？

### 9.2 统一回复原则
- 先回答用户问题，再带 CTA。
- 不夸大收益，不做收益承诺，不做“准确率神话”。
- 不说 “beats the market”，只说 “helps structure the review process”。
- 不把 Plus 说成当前完整开放功能。

### 9.3 标准短回复模板
**Q: Is this financial advice?**
`No. ZISO AI is a research and alerting tool, not investment advice. It helps structure post-close review and decision boundaries, but the final decision remains with the investor.`

**Q: What makes it different from generic AI?**
`Most generic AI tools summarize. ZISO is built around a repeatable workflow: nightly insight, key levels, tactical structure, and alerts for your watchlist.`

**Q: Why only 10 watchlist names in Go?**
`Because the product is designed for depth and discipline, not endless scanning. The goal is to help users review a focused set of names more consistently.`

**Q: Is Plus available now?**
`Not as the main launch tier. Go is the current paid core. Plus is the upcoming consensus layer for users who want stricter multi-model validation.`

---

## 10. 风险登记册与应急预案 (Risk Register)

| 风险 | 触发信号 | 处理动作 | Owner |
| :--- | :--- | :--- | :--- |
| Invite wall 阻塞公开流量 | 用户无法通过 `https://ziso.cc/v/PH` 顺利进入 app / 获得 Go 试用 | 立即检查 `/v/PH` 重定向、alias 解析与 referral 承接逻辑 | Frank |
| Stripe checkout 失败 | 评论区出现支付失败反馈 / 后台错误 | 立即核对 price ID、checkout route、success/cancel URL | Frank |
| Reddit 删帖 | 帖子被移除或限流 | 快速调整为 value-first 讨论帖，不硬贴链接 | Frank |
| 用户误解为投资建议 | 评论区要求收益保证 | 立刻使用标准 disclaimer 回应 | Frank |
| Plus 预期过高 | 用户误以为 Plus 现已完整开放 | 明确说明 Plus 为 upcoming / waitlist | Frank |
| 通知/产品体验与文案不一致 | 用户说没看到文案所述功能 | 优先修正文案或下线夸大描述 | Frank |

### 10.1 停发条件（No-Go / Pause）
出现以下任一情况，暂停放量：
- checkout 无法正常创建；
- 公开流量被 invite 流程大面积阻塞；
- pricing 文案与实际功能明显不一致；
- 关键 legal 页面无法访问；
- analytics 基本失明，无法判断来源与转化。

---
*文档由 Antigravity (Advanced Agentic AI) 自动归档。*
