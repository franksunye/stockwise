# 营销内容对齐清单 (Growth Content Alignment Checklist)

**Last Updated: 2026-03-17**
**Reference Source**: `docs/3_Product/03_Product_Features_Manifest.md` + **Code Audit (v2.2)**

这是一份面向 **市场 (Market)** 与 **内容 (Content)** 团队的严苛对齐清单。它不仅基于产品功能审计，更通过 **代码级扫描 (Code-First Extraction)** 确保每一个影响用户决策、权益和体验的特性都已纳入宣发与支持体系。

**核心目标 (Goals)**：
1.  **查漏补全**：识别尚未文档化或尚未宣发的核心产品功能（目前已识别 60+ 项）。
2.  **动态同步**：确保产品代码更新与投教内容 100% 同步。
3.  **价值转化**：将代码层面的逻辑（如 `MEMBERSHIP_CONFIG`）转化为用户权益说明。

---

## 🚦 状态定义 (Status Definitions)
- `[ ] 待起草 (Pending)`：功能已实现，但尚无对应文章。
- `[/] 需更新 (Outdated)`：产品逻辑已变更或描述不严谨。
- `[x] 已就绪 (Ready)`：内容完整且与代码版本对齐。

---

## 🏗️ 1. 交互与导航 (Experience & Navigation)
- [x] **时光机模式 (Time Machine)**: 复盘历史决策语境。
- [x] **交互优先策略 (Interaction First)**: 60fps 动画与数据异步加载。
- [x] **横向滑动地图 (Horizontal Navigation)**: Snap-X 布局及区域自锁定逻辑。
- [x] **性能自校准 (Auto-Performance)**: 自动识别设备性能并切换渲染等级。
- [/] **精准定位逻辑 (Precision Positioning)**: **(需更新)** URL 参数如何驱动 `useTikTokScroll` 的秒级定位。
- [x] **TikTok 式沉浸滚动 (Snap-Y Dynamics)**: 垂直翻页的注意力对焦。
- [x] **搜索联想与秒速响应 (Smart Search)**: 拼音/代码多模态搜索。
- [/] **iOS 性能专项优化 (iOS Tuning)**: **(需更新)** 禁用辉光以提升 iOS 高刷体验。

---

## 🧠 2. AI 智慧与分析 (AI Intelligence & Analysis)
- [x] **投研决议 (AI Council)**: 多模型共识算法的判别逻辑。
- [ ] **共识结论定义 (Consensus Levels)**: **(待起草)** “结论一致” vs “更多共识” vs “判断分歧”的算法定义。
- [ ] **分析师实名/匿名角色**: **(待起草)** 申策、谷深、林旭、程巨等 AI 分析师的人设与擅长领域。
- [/] **策略内参解读 (Tactical Brief)**: **(需补全)** 深入技术层面的 Profit/Loss/Empty 场景预案。
- [ ] **关键价位阶梯 (Price Ladder)**: **(待起草)** 支撑、压力、挑战、防守位的平衡图解。
- [x] **胜率历史矩阵 (Win-Rate Matrix)**: 30天预测表现概率回溯。
- [ ] **大盘宏观黄历 (Yellow Pages)**: **(待起草)** 每日盘前气象与静默数学视角。
- [ ] **空头压力分析 (HK Only)**: **(待起草)** 沽空比与做空仓位等级解读。
- [x] **失败回溯审计 (Failure Retrospective)**: 针对偏差的公开审计机制。
- [ ] **模型层级划分 (Model Tiers)**: **(待起草)** 为什么 Pro 能看到 DeepSeek-V3 而免费用户仅限规则引擎。

---

## 🧪 3. 量化逻辑与纪律 (Quant Logic & Discipline)
- [/] **严格模式：防未来函数 (Anti-Future)**: **(需同步 V2)** 锁死时间窗口的强制性。
- [/] **智能标题语境 (Smart Title)**: **(需更新)** 导航栏随行情动态变化的引导逻辑。
- [x] **RSI 颜色隐喻 (RSI Metaphor)**: “红跌绿涨”感官系统说明。
- [x] **脉冲与共振 (Pulse & Resonance)**: 呼吸频率作为一致性的量化度量。
- [x] **置信度百分比 (Confidence Factor)**: 市场秩序的度量衡。
- [x] **振动反馈 (Haptic Sync)**: 生理反馈增强确认感。

---

## ✅ 4. 验证与诚信 (Validation & Trust)
- [x] **T+3 多日验证 (Multi-Day Validation)**: 追踪趋势轨迹。
- [x] **验证状态判定 (Verification States)**: 准确 vs 偏差。
- [x] **失败的价值 (Value of Failure)**: 透明展示错误的诚信逻辑。

---

## 🛡️ 5. 身份与安全 (Identity & Security)
- [x] **身份护照系统 (Identity Passport)**: 100% 匿名化。
- [x] **邮箱绑定机制 (Email Binding)**: 多端唯一入口。
- [x] **身份找回流程 (Account Recovery)**: 紧急恢复路径。
- [ ] **邀请墙机制 (Invite Wall)**: **(待起草)** 内测期为什么需要激活码或邀请才能进入。
- [x] **隐私承诺 (Privacy Pledge)**: 不收集敏感信息底线。
- [x] **角标清除逻辑 (Badge Hygiene)**: 应用红点自动清理。

---

## 🎁 6. 权益与增长 (Benefits & Growth)
- [ ] **投资模式自选 (Investment Mode)**: **(待起草)** 平衡/稳健/激进策略切换。
- [ ] **新用户体验期 (Onboarding Trial)**: **(待起草)** 完成 OB 后获赠 3 天 Pro 权益规则。
- [ ] **邀请双向激励 (Referral Mechanism)**: **(待起草)** 邀请 1 人双方各获 5 天 Pro（基于 `MEMBERSHIP_CONFIG`）。
- [ ] **自选股配额 (Stock Quota)**: **(待起草)** 免费版 3 只 vs Pro 版 10 只的门槛说明。
- [ ] **模型访问权等级**: **(待起草)** `hunyuan-lite` 与 `rule-engine` 的分级开放详情。
- [/] **渠道分润看板 (Partner Dashboard)**: **(需更新)** 佣金计算、 alias 与提现。
- [x] **权益兑换码 (Redeem Codes)**: 发放与激活说明。

---

## 🔔 7. 通知与触达 (Notification & Reach)
- [x] **智能反转推送 (Signal Flip Logic)**: 趋势根本改变时推送。
- [x] **精细化控制面板 (Notification Preference)**: 屏蔽 7 类消息。
- [x] **Web Push 设置 (PWA Setup)**: 跨平台配置路径。
- [x] **通知连通性测试 (Push Debug)**: 用户自助排错。

---

## ⚙️ 8. 数据与系统保障 (Data & Infra)
- [ ] **零过期协议 (Zero-Stale Protocol)**: **(待起草)** 实时行情锁与决策价值。
- [x] **乐观更新机制 (Optimistic Updates)**: “秒应”交互技术。
- [x] **实时盘中拼接 (Intraday Data Splicing)**: EOD 与实时 Sina 接口拼接。
- [x] **按需同步算法 (On-Demand Sync)**: 优先级调度逻辑。
- [ ] **预发隔离环境 (Env Isolation)**: **(待起草)** 代码隔离对数据安全的作用。
- [ ] **治理控制塔 (Tradeability Tower)**: **(待起草)** AI 模型上线门禁标准。
- [ ] **溯源审计 ID (Trace ID)**: **(待起草)** 用户如何通过 ID 反馈异常预测。
- [ ] **极端容错解析 (Smart Parser)**: **(待起草)** 为什么即使 LLM 抽风，UI 依然能稳定显示数据。

---

## 📋 接下来内容生产优先级 (Priority Articles)
1.  **权益闭环包**：OB 赠送规则、邀请奖励细则、Pro 会员配额说明。
2.  **决策增强包**：共识等级定义、AI 分析师角色说明、模型分级理由。
3.  **技术护航包**：追溯 ID 使用、隔离环境原理、数据新鮮度协议。
