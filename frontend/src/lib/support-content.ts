export interface SupportArticle {
    slug: string;
    title: string;
    category: string;
    lastUpdated: string;
    content: string;
    relatedSlugs?: string[];
}

export const SUPPORT_ARTICLES: Record<string, SupportArticle> = {
    // --- 1. Experience & Navigation (交互与导航) ---
    'time-machine-feed': {
        slug: 'time-machine-feed',
        title: '时光机模式 (Time Machine)',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
ZISO AI 的垂直信息流本质上是一个“时空复盘引擎”。

### 为什么要向上滑动？
向上滑动不仅是为了看历史预测，更是为了**复原当时的决策环境**。当你停留在上周五的卡片时，你看到的是 AI 在当时的市场信息集下做出的研判，这能帮你摆脱“后视镜偏差”。
        `
    },
    'interaction-first': {
        slug: 'interaction-first',
        title: '交互优先策略 (Interaction First)',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
我们坚信：交易应用应当像游戏一样流畅。

- **60fps 动画**：动画响应是 0 延迟的，优先保证你的手感。
- **400ms 异步加载**：核心数据会在动画开始后的 400ms 内填入。这 400ms 的等待换取了极致的视觉连续性。
        `
    },
    'nav-map-logic': {
        slug: 'nav-map-logic',
        title: '横向滑动地图 (Snap-X)',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
ZISO AI 采用了极致的横向空间划分：
- **向左滑**：进入“监控池 (Stock Pool)”，打理你的自选股。
- **中心位**：主信息流 (Feed)，AI 的实时战场。
- **向右滑**：个人中心与设置。
        `
    },
    'perf-adaptation': {
        slug: 'perf-adaptation',
        title: '性能自适应模式 (Auto-Performance)',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
系统会自动检测设备性能：
- **高性能设备**：开启 Spring (弹簧) 物理动画。
- **普通设备**：自动降级为 Tween (渐变) 动画以节省电量并保持帧率。
        `
    },
    'deep-linking-usage': {
        slug: 'deep-linking-usage',
        title: '深度链接引导 (Deep Linking)',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
通过链接直接定位：
- \`ziso.cc/?s=600519\` 直接打开贵州茅台的 AI 卡片。
- \`ziso.cc/?open=brief\` 直接展开最新简报。
        `
    },
    'snap-y-dynamics': {
        slug: 'snap-y-dynamics',
        title: 'TikTok 式沉浸滚动 (Snap-Y)',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
为什么要全屏垂直翻页？
为了**单点对焦**。在金融世界里，分散注意力就是增加错误。我们通过垂直吸附逻辑，确保你每次只深入研究一个标的。
        `
    },
    'smart-search': {
        slug: 'smart-search',
        title: '搜索联想与秒速响应',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
- **多模识别**：支持股票代码、拼音首字母、中文全称。
- **300ms 防抖**：在你输入停止后的瞬时触发，平衡速度与算力。
        `
    },
    'ios-tuning': {
        slug: 'ios-tuning',
        title: 'iOS 专项性能优化 (Safari)',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
在 iOS 端，我们主动禁用了部分“毛玻璃”特效。
这是为了在 120Hz 的 ProMotion 屏幕上维持绝对的跟手感。**流畅度永远优先于华丽度。**
        `
    },

    // --- 2. AI Intelligence & Analysis (AI 智慧与分析) ---
    'ai-council-logic': {
        slug: 'ai-council-logic',
        title: 'AI 智囊团：群体决策机制',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
单一模型会有幻觉，但智囊团不会。
当 DeepSeek、Gemini 和我们的量化引擎观点重合时，信号强度将呈几何级倍增。
        `
    },
    'tactical-brief-guide': {
        slug: 'tactical-brief-guide',
        title: '战术简报解读 (Tactical Brief)',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
点击卡片即可查看。简报不仅有涨跌预判，更包含：
- **博弈背景**：当前筹码谁在主导？
- **潜在风险**：什么情况下预测会失效？
        `
    },
    'key-levels-mapping': {
        slug: 'key-levels-mapping',
        title: '关键价位图解 (Key Levels)',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
- **支撑位**：空头力竭点。
- **压力位**：多头反攻障碍。
我们的所有价位并非静态线，而是基于交易密集区的动态估值。
        `
    },
    'history-matrix-viz': {
        slug: 'history-matrix-viz',
        title: '胜率历史矩阵 (Win-Rate Matrix)',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
30 个色块代表过去一个月的历史表现。
- **红色**：预测准确。
- **灰色**：预测有偏差。
矩阵越红，说明该个股目前越符合 AI 的逻辑模型。
        `
    },
    'context-extraction': {
        slug: 'context-extraction',
        title: '智能上下文提取',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
AI 会从全局万字日报中，利用正则引擎精准剔除无用信息，只为你摘录与当前个股直接相关的核心见解。
        `
    },
    'failure-retrospective': {
        slug: 'failure-retrospective',
        title: '失败回溯审计 (Failure Retrospective)',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
我们对偏差进行 T+1/2/3 维度的分级审计。识别“因为市场黑天鹅”还是“模型逻辑失效”。
        `
    },

    // --- 3. Quant Logic & Discipline (量化逻辑与纪律) ---
    'anti-future-function': {
        slug: 'anti-future-function',
        title: '严格模式：防未来函数 (Anti-Future)',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
量化投资的大忌是“抢跑数据”。
我们严格锁死时间戳（thresholdDateStr），确保你在盘前只能看到盘前的数据，绝不混淆。
        `
    },
    'smart-title-logic': {
        slug: 'smart-title-logic',
        title: '智能标题逻辑',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
标题会随盘面呼吸：
- **盘前**：显示“交易策略 (Suggestion)”。
- **盘后**：转为“复盘复核 (Recap)”。
        `
    },
    'rsi-color-metaphor': {
        slug: 'rsi-color-metaphor',
        title: 'RSI 颜色隐喻 (RSI Metaphor)',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
**反本能视觉训练：**
- **绿色**：对应 <30 (超卖)，意味着安全与机会。
- **红色**：对应 >70 (超买)，意味着危险与风险。
        `
    },
    'ai-pulse-resonance': {
        slug: 'ai-pulse-resonance',
        title: '脉冲与共振 (Pulse & Resonance)',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
卡片上的呼吸频率代表 AI 的计算活跃度。
当所有模型逻辑达成共鸣（Resonance）时，脉冲频率会显著加快，提示信号极度强悍。
        `
    },
    'confidence-explained': {
        slug: 'confidence-explained',
        title: '置信度百分比解读',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
置信度不是胜率。
它是衡量当前市场结构是“有序 (Order)”还是“混沌 (Chaos)”的度量衡。
        `
    },
    'haptic-sync': {
        slug: 'haptic-sync',
        title: '触感反馈的心理暗示',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
在执行如“回归今日”等核心重定位操作时，系统会触发微弱震动，利用生理反馈增强你的心理确认感。
        `
    },

    // --- 4. Validation & Trust (验证与诚信) ---
    'multi-day-verification': {
        slug: 'multi-day-verification',
        title: 'T+3 多日验证机制',
        category: '验证与诚信',
        lastUpdated: '2026-02-15',
        content: `
我们不只验证明天。我们追踪预测后的 72 小时峰值收益轨迹。因为真正的策略需要时间让价值回归。
        `
    },
    'verification-states': {
        slug: 'verification-states',
        title: '验证的三种状态',
        category: '验证与诚信',
        lastUpdated: '2026-02-15',
        content: `
- **Verifying**：正在进行的博弈。
- **Correct**：逻辑与走势契合。
- **Incorrect**：市场与逻辑出现背离。
        `
    },
    'value-of-failure': {
        slug: 'value-of-failure',
        title: '失败的价值 (Value of Failure)',
        category: '验证与诚信',
        lastUpdated: '2026-02-15',
        content: `
我们从不删除历史上的灰色“X”。透明的失败是 AI 安全机制自我进化的养料。
        `
    },

    // --- 5. Identity & Security (身份与安全) ---
    'identity-passport': {
        slug: 'identity-passport',
        title: '身份护照系统 (Identity)',
        category: '账号与安全',
        lastUpdated: '2026-02-15',
        content: `
UserID 是你在 ZISO 宇宙的唯一指纹。它不需要电话或身份证，是完全匿名的理性通行证。
        `
    },
    'email-sync-logic': {
        slug: 'email-sync-logic',
        title: '邮箱绑定机制 (Email Binding)',
        category: '账号与安全',
        lastUpdated: '2026-02-15',
        content: `
由于 PWA 不依赖应用商店，请务必绑定邮箱以确保护航权益不会随浏览器清理而丢失。
        `
    },
    'identity-restore-flow': {
        slug: 'identity-restore-flow',
        title: '身份找回流程 (Account Recovery)',
        category: '账号与安全',
        lastUpdated: '2026-02-15',
        content: `
通过你的恢复邮箱，可以在任何新手机或浏览器上瞬时恢复你的监控池和 Pro 会员状态。
        `
    },
    'privacy-pledge': {
        slug: 'privacy-pledge',
        title: '隐私承诺 (Privacy Pledge)',
        category: '账号与安全',
        lastUpdated: '2026-02-15',
        content: `
我们只记录你的股票偏好。不收集银行、位置或社交数据。这里是你的数据避风港。
        `
    },
    'badge-hygiene': {
        slug: 'badge-hygiene',
        title: '角标清除与数字减压',
        category: '账号与安全',
        lastUpdated: '2026-02-15',
        content: `
进入 App 后，系统会自动清除系统的红点角标。我们希望你专注于决策，而不是被红点驱使。
        `
    },

    // --- 6. Benefits & Growth (权益与增长) ---
    'referral-rewards': {
        slug: 'referral-rewards',
        title: '推荐激励 (Referral Program)',
        category: '权益与增长',
        lastUpdated: '2026-02-15',
        content: `
分享即收益。邀请好友入场，双方都将获得“Loot Box”奖励，包含 Pro 会员时长。
        `
    },
    'channel-revenue-guide': {
        slug: 'channel-revenue-guide',
        title: '渠道分润看板',
        category: '权益与增长',
        lastUpdated: '2026-02-15',
        content: `
合作伙伴专用。透明显示佣金比例、推广用户活跃度与提现流水。
        `
    },
    'redeem-code-usage': {
        slug: 'redeem-code-usage',
        title: '权益兑换码 (Redeem Codes)',
        category: '权益与增长',
        lastUpdated: '2026-02-15',
        content: `
支持手动输入 PRO-XXXX 兑换码。通常通过社区活动、公测奖励或合作伙伴发放。
        `
    },
    'tiers-explained': {
        slug: 'tiers-explained',
        title: '免费版与 Pro 版阶梯对比',
        category: '权益与增长',
        lastUpdated: '2026-02-15',
        content: `
- **Free**：3 只监控股，基础 AI 结论。
- **Pro**：10 只监控股，解锁深度解析链与历史回溯。
        `
    },

    // --- 7. Notifications & Reach (通知与触达) ---
    'signal-flip-push': {
        slug: 'signal-flip-push',
        title: '智能反转推送逻辑',
        category: '通知与触达',
        lastUpdated: '2026-02-15',
        content: `
我们只在“多转空”或“空转多”的奇点推送。震荡期的无聊波动不会骚扰你。
        `
    },
    'notification-preference': {
        slug: 'notification-preference',
        title: '精细化控制面板',
        category: '通知与触达',
        lastUpdated: '2026-02-15',
        content: `
支持独立开关：早报推送、信号反转、价格异动、系统公告。
        `
    },
    'web-push-setup': {
        slug: 'web-push-setup',
        title: 'Web Push 开启指南',
        category: '通知与触达',
        lastUpdated: '2026-02-15',
        content: `
iOS 必须手动点击“添加到主屏幕”后才能在 Safari 中开启推送权限。
        `
    },
    'push-debug': {
        slug: 'push-debug',
        title: '通知连通性测试工具',
        category: '通知与触达',
        lastUpdated: '2026-02-15',
        content: `
设置中的“测试推送”按钮可以模拟真实信号，验证你的手机管家是否拦截了 ZISO AI。
        `
    },

    // --- 8. Data & Infrastructure (数据与服务保障) ---
    'optimistic-ui-logic': {
        slug: 'optimistic-ui-logic',
        title: '乐观更新机制',
        category: '数据与服务保障',
        lastUpdated: '2026-02-15',
        content: `
当你添加股票时，UI 会瞬间反应。网络同步在后台静默进行，不让网络波动中断你的思考流。
        `
    },
    'realtime-data-splicing': {
        slug: 'realtime-data-splicing',
        title: '实时盘中拼接技术',
        category: '数据与服务保障',
        lastUpdated: '2026-02-15',
        content: `
我们的指标计算采用了 Splicing 技术。将历史收盘数据与当前的 15 分钟实时行情在客户端本地拼接，动态生成最新的 MA/MACD。
        `
    },
    'on-demand-sync': {
        slug: 'on-demand-sync',
        title: '按需同步调度算法',
        category: '数据与服务保障',
        lastUpdated: '2026-02-15',
        content: `
系统会优先调度监控池内标的的云端算力。无人关注的边缘股票更新频率会自动降低。
        `
    },
    'data-resiliency': {
        slug: 'data-resiliency',
        title: '多源降级数据保障',
        category: '数据与服务保障',
        lastUpdated: '2026-02-15',
        content: `
AbstractFetcher 能够自动探测主数据源健康度。一旦 AkShare 延迟，将切换至 Yahoo Finance 备线。
        `
    }
};

export function getArticleBySlug(slug: string): SupportArticle | undefined {
    return SUPPORT_ARTICLES[slug];
}
