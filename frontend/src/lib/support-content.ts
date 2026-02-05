export interface SupportArticle {
    slug: string;
    title: string;
    category: string;
    lastUpdated: string;
    content: string;
    relatedSlugs?: string[];
}

export const SUPPORT_ARTICLES: Record<string, SupportArticle> = {
    // --- QUICK START ---
    'what-is-pwa': {
        slug: 'what-is-pwa',
        title: '什么是 PWA (渐进式 Web 应用)？',
        category: '快速开始',
        lastUpdated: '2026-02-05',
        content: `
PWA 是一种结合了网页轻量与 App 沉浸感的卓越技术。它让 ZISO AI 能够绕过传统的应用商店，直接降落在你的主屏幕。

### 为什么我们选择 PWA？
- **零下载等待**：无需通过商店，一秒安装。
- **极致纯净**：无广告插件，只保留最核心的交易视图。
- **即时更新**：每次打开都是最新版本，算法实时同步。
    `
    },
    'install-ios': {
        slug: 'install-ios',
        title: 'iOS 用户如何安装？',
        category: '快速开始',
        lastUpdated: '2026-02-05',
        content: `
在 iPhone/iPad 上，只需两步即可将 ZISO AI 转化为全屏 App。

1. **Safari 访问**：打开 Safari 浏览器访问 \`ziso.cc\`。
2. **添加到主屏幕**：点击底部的“分享”图标，选择“添加到主屏幕”。

> **注意**：必须在 Safari 中操作，其他浏览器内核（如微信内）不支持 PWA 安装。
    `
    },
    'install-android': {
        slug: 'install-android',
        title: 'Android 用户如何安装？',
        category: '快速开始',
        lastUpdated: '2026-02-05',
        content: `
Android 是 PWA 的原生主场，支持最为流畅。

1. **Chrome 访问**：使用 Chrome 浏览器打开 \`ziso.cc\`。
2. **一键安装**：点击地址栏右侧的“安装应用”提示，或在菜单中选择“安装到桌面”。

**华为/小米/OPPO 特别提醒**：
若系统拦截，请在手机“设置”中允许 Chrome 浏览器的“创建桌面快捷方式”权限。
    `
    },
    'first-moves': {
        slug: 'first-moves',
        title: '初次入场：3 个核心动作',
        category: '快速开始',
        lastUpdated: '2026-02-05',
        content: `
为了发挥 ZISO AI 的最大价值，建议你完成以下动作：

1. **构建你的监控池**：将最关注的 3 只标的加入 Pool，观察 AI 的 48h 战术演化。
2. **滑向历史**：在主界面上下滑动，查看过往一周 AI 对波动转折点的判定。
3. **绑定身份**：进入个人中心绑定邮箱，确保护航付费权益不丢失。
    `
    },

    // --- THE BRAIN ---
    'brief-logic': {
        slug: 'brief-logic',
        title: '战术简报的决策原理',
        category: '底层智能',
        lastUpdated: '2026-02-05',
        content: `
每一份简报都是 AI 智囊团对当前筹码分布、量价动能与全网情报的实时建模。

- **非线性推理**：我们不仅看涨跌，更看价格所处的“环境叙事”。
- **概率优先**：AI 会告诉你“把握度 (Confidence)”，帮助你平衡仓位。
- **动作导向**：简报的结论始终落在“具体价位”与“具体动作”上，拒绝模棱两可。
    `
    },
    'ai-council': {
        slug: 'ai-council',
        title: '智囊团共鸣机制 (Resonance)',
        category: '底层智能',
        lastUpdated: '2026-02-05',
        content: `
ZISO AI 并非由单一模型驱动，而是由包括 DeepSeek V3、Gemini Pro、Claude 等组成的“智囊委员会”。

- **共振 (Resonance)**：当所有模型一致看多时，信号强度达到红色警戒。
- **动态博弈**：每个模型承担不同角色（技术派、叙事派、宏观派），最终通过共识层输出最优解。
    `
    },
    'data-delay': {
        slug: 'data-delay',
        title: '为什么会有 15 分钟延迟？',
        category: '底层智能',
        lastUpdated: '2026-02-05',
        content: `
这是 ZISO AI 与“分时高频噪点”保持距离的科学决策。

1. **抗高频噪音**：波段交易不需要秒级数据，15 分钟窗口能更好地捕捉筹码沉淀的真实意图。
2. **算力沉淀**：我们的 AI 智囊团需要约 60-180 秒进行深度推理。
3. **理性隔离**：秒级波动极易诱发散户的恐惧与贪婪。
    `
    },
    'counter-argument': {
        slug: 'counter-argument',
        title: '风险反思：对抗确认偏差',
        category: '底层智能',
        lastUpdated: '2026-02-05',
        content: `
战术简报中最重要的部分是 **风险反思 (Counter Argument)**。

人类大脑天生倾向于寻找支持自己看法的证据（确认偏差）。ZISO AI 会强制输出逻辑严密的“反面观点”，迫使你从另一个角度审视仓位风险。
    `
    },

    // --- TRADING PERFORMANCE ---
    'historical-cards': {
        slug: 'historical-cards',
        title: '历史卡片：信任的基石',
        category: '交易实战',
        lastUpdated: '2026-02-05',
        content: `
历史卡片是 ZISO AI 的“诚实镜像”。

你可以点击每一张历史卡片，**回溯到当时的时间点**，查看 AI 做出决定的逻辑背景。我们不仅展示成功的红色勾选，更重要的是我们从不抹除失败的灰色叉号。
    `
    },
    'validation-logic': {
        slug: 'validation-logic',
        title: '验证系统的工作流程',
        category: '交易实战',
        lastUpdated: '2026-02-05',
        content: `
验证系统在每日收盘后启动。系统会将 AI 信号的预测方向与次日实际价格走势进行“严丝合缝”的比对。

判定标准基于“收盘收益率”。只有实际走势与预测逻辑完全契合，才会标记为 **Correct**。
    `
    },
    'scenario-tactics': {
        slug: 'scenario-tactics',
        title: '盈利与亏损的战术差异',
        category: '交易实战',
        lastUpdated: '2026-02-05',
        content: `
AI 会根据你的心理场景定制建议：

- **持仓盈利**：战术核心是“落袋为盈”与“移动止盈线”。
- **持仓亏损**：战术核心是“止损防御”与“概率摊平”。
- **空仓**：寻找高确定性的“入场奇点”。
    `
    },
    'key-levels': {
        slug: 'key-levels',
        title: '如何解读关键价位？',
        category: '交易实战',
        lastUpdated: '2026-02-05',
        content: `
- **支撑 (Support)**：多头最后的阵地，跌破意味着逻辑崩盘。
- **压力 (Resistance)**：获利盘与解套盘的密集区，突破往往伴随暴力拉升。
- **止损 (Stop Loss)**：这是不可妥协的铁律纪律线。
    `
    },

    // --- IDENTITY & ACCOUNT ---
    'identity-passport': {
        slug: 'identity-passport',
        title: '什么是身份护照 (User ID)？',
        category: '账号与安全',
        lastUpdated: '2026-02-05',
        content: `
每一个 \`user_xxxx\` 都是你在 ZISO 宇宙中的唯一指纹。由于我们追求去中心化的极简体验，你的所有配置和权限都与这个 ID 强绑定。

请从不轻易向他人透露你的完整 ID 截图。
    `
    },
    'recovery-email': {
        slug: 'recovery-email',
        title: '如何绑定恢复邮箱？',
        category: '账号与安全',
        lastUpdated: '2026-02-05',
        content: `
绑定邮箱是**最高优先级**的安全动作。

由于 PWA 不依赖传统的应用商店账号，一旦你重装系统或清理浏览器，本地数据可能丢失。只要绑定了邮箱，你就可以通过验证码瞬间找回所有的 Pro 权益。
    `
    },
    'cross-device': {
        slug: 'cross-device',
        title: '多端登录与权益同步',
        category: '账号与安全',
        lastUpdated: '2026-02-05',
        content: `
ZISO AI 支持手机、Pad、电脑多端访问。

1. **在新设备登录**：访问 ziso.cc。
2. **恢复身份**：在个人中心输入你的 \`恢复邮箱\`。
3. **自动同步**：你的监控池与 Pro 权益将自动同步。
    `
    },
    'pro-vs-free': {
        slug: 'pro-vs-free',
        title: '专业版与免费版全对比',
        category: '账号与安全',
        lastUpdated: '2026-02-05',
        content: `
| 功能 | 免费版 | Pro 专业版 |
| --- | --- | --- |
| 监控标的 | 3 只 | 10 只 |
| AI 智囊团 | 基础逻辑 | 全模型协同 |
| 历史回滚 | 48 小时 | 无限回溯 |
| 战术细节 | 基础结论 | 完整推理链 |
| 深度复盘 | ❌ | ✅ |
    `
    }
};

export function getArticleBySlug(slug: string): SupportArticle | undefined {
    return SUPPORT_ARTICLES[slug];
}
