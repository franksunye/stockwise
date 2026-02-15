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
        title: '时光机模式：拒绝“马后炮”',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
为什么要往回刷？不是为了翻旧帐，是为了让你“穿越”。

### 别做“事后诸葛亮”
很多软件习惯拿之后的价格来证明之前多准，那叫“未来函数”。在 ZISO，你往回刷，看到的是 AI 在**当时那个瞬间**眼里的市场。这种复盘能帮你掐死心里名为“早知道就……”的那个念头，看清市场当时到底在想什么。
        `
    },
    'interaction-first': {
        slug: 'interaction-first',
        title: '交互优先：手感不能断',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
我们坚信：交易软件应该像游戏一样快。

点下去没反应最糟心。在 ZISO，按钮响应是 0 延迟的，动画先跑，数据慢个零点几秒填进来没关系，但**你的手感和节奏绝对不能断**。
        `
    },
    'nav-map-logic': {
        slug: 'nav-map-logic',
        title: '左右滑：你的三个战场',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
别在一堆菜单里乱找了，三个方向解决战斗：
- **往左滑**：你的“监控池”。盯着你买入或想买的票，看它们的心跳。
- **中间位**：主战场。看 AI 的最新研判。
- **往右滑**：你的身份。管好你的会员权益和设置。
        `
    },
    'perf-adaptation': {
        slug: 'perf-adaptation',
        title: '性能降级：省电也是战斗力',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
如果你的手机发烫或电量告急，App 会自动“变聪明”。
它会把华丽的弹簧动画关掉，换成省电的匀速滑动。虽然视觉上没那么炫了，但能保证你在关键时刻不卡顿，不掉链子。
        `
    },
    'deep-linking-usage': {
        slug: 'deep-linking-usage',
        title: '深度链接：一键直达“战场”',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
想直接看某只票？不用搜。
直接在网址后面加个 \`?s=股票代码\`。或者分享给哥们，他点开就能看到你正在研究的那份简报，不用再对半屏截图猜半天。
        `
    },
    'snap-y-dynamics': {
        slug: 'snap-y-dynamics',
        title: '单点对焦：别让散乱害了你',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
为什么要一页只放一只票？
因为散户最大的敌人就是“分心”。看一眼茅台，又瞄一眼宁德，结果哪个都没看透。咱们这儿强迫你垂直翻页，一次只盯一个，看透了逻辑再划下一个。
        `
    },
    'smart-search': {
        slug: 'smart-search',
        title: '聪明搜索：这才是量化速度',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
搜股票，越快越好。
不管是代码、拼音头（比如 GZMT）、还是中文名字，你怎么顺手怎么搜。我们专门做了防抖优化，手滑输入错一个字母，它也能尽量猜出你要找谁。
        `
    },
    'ios-tuning': {
        slug: 'ios-tuning',
        title: 'iOS 特供：极致跟手感',
        category: '交互与导航',
        lastUpdated: '2026-02-15',
        content: `
在 iPhone 上，我们主动把一些华而不实的“毛玻璃”背景关了。
这不是偷懒，是为了让你的 ProMotion 屏幕满帧跑。**手感要像黄油一样顺滑**，你下单的时候才会有信心。
        `
    },

    // --- 2. AI Intelligence & Analysis (AI 智慧与分析) ---
    'ai-council-logic': {
        slug: 'ai-council-logic',
        title: 'AI 智囊团：多听几个人的意见',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
一个模型容易钻牛角尖。
我们让 DeepSeek 负责技术流，Gemini 负责看大势，再加上咱们自己的量化库做保。只有他们几位都点头说“这票靠谱”时，信号才叫“共振”。一个人的错觉叫幻觉，五个人的共识才叫真相。
        `
    },
    'tactical-brief-guide': {
        slug: 'tactical-brief-guide',
        title: '战术简报：怎么看干货？',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
点击卡片，别只看涨跌。
去读那个“风险反思”。AI 会告诉你：“虽然我看多，但要是某某价位跌破了，我就认错。”这才是真干货。无脑吹牛的内容，外面到处都是，我们要的是应对方案。
        `
    },
    'key-levels-mapping': {
        slug: 'key-levels-mapping',
        title: '关键价位：市场的防线',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
- **支撑位**：跌到这儿，大多有人想护盘。
- **压力位**：涨到这儿，解套的想跑，获利的也想跑。
这就是市场的“心理防区”。AI 帮你钉死了这几条线，破了线，逻辑就全变了。
        `
    },
    'history-matrix-viz': {
        slug: 'history-matrix-viz',
        title: '胜率矩阵：摸清 AI 的脾气',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
那一排小方块就是 AI 的“模拟考成绩单”。
如果最近全是红的，说明这只票正处在 AI 最擅长的行情里。如果灰的多，可能是这段时间市场太乱，AI 也没摸准。跟着状态好的 AI 走，别跟它较真。
        `
    },
    'context-extraction': {
        slug: 'context-extraction',
        title: '上下文提取：只看我想要的',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
每天市场消息上万字，跟你那只股票相关的可能就两句。
AI 的正则引擎会帮你把那堆废话滤掉，直接把日报里最关键的那句拎到卡片上。不用通读全篇，也能知道你关心的票出啥事了。
        `
    },
    'failure-retrospective': {
        slug: 'failure-retrospective',
        title: '认错审计：出错不可怕',
        category: 'AI 智慧与分析',
        lastUpdated: '2026-02-15',
        content: `
没谁能 100% 稳赢。
如果 AI 昨天看错了，系统会自动复盘。是市场出了黑天鹅？还是模型没算对？**敢于公开承认并分析错误**，才是咱们能越跑越准的原因。
        `
    },

    // --- 3. Quant Logic & Discipline (量化逻辑与纪律) ---
    'anti-future-function': {
        slug: 'anti-future-function',
        title: '拒绝“未来函数”：咱们不玩虚的',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
炒股最怕看“马后炮”指标。
很多软件拿收盘后的结果来反推开盘前的预判，那是在忽悠你。我们后台加了硬锁，盘前就是盘前的，盘后就是盘后的。逻辑硬，咱才敢这么玩。
        `
    },
    'smart-title-logic': {
        slug: 'smart-title-logic',
        title: '智能标题：随盘面“变脸”',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
标题这玩意儿也有讲究：
- **开盘前**：给你的是“建议”，帮你想好怎么打。
- **收盘后**：转成“复盘”，看看咱昨儿想的对不对。
这就是交易节奏感。
        `
    },
    'rsi-color-metaphor': {
        slug: 'rsi-color-metaphor',
        title: '颜色反转：戒掉“追涨杀跌”',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
**注意！咱们这儿颜色是反着来的：**
- **看到绿色**：别怕，这代表“安全区”（跌透了）。
- **看到红色**：慢着，这代表“危险区”（涨过头了）。
强制让你养成逆向思维。要是看大红就想冲，那你就离被套不远了。
        `
    },
    'ai-pulse-resonance': {
        slug: 'ai-pulse-resonance',
        title: '脉冲频率：信号强度一眼看',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
卡片上那个一闪一闪的频率。
闪得越急，说明 AI 逻辑之间的“共振”越响，算出来的信心越足。如果半天不动弹，那说明信号不够强，咱还是先观望比较稳。
        `
    },
    'confidence-explained': {
        slug: 'confidence-explained',
        title: '置信度：这不是胜算，是把握',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
置信度 80% 并不代表 80% 会涨。
它衡量的是现在市场是“有规矩”还是“乱套了”。置信度高，说明市场现在的路数正好在 AI 的知识圈里；置信度低，说明市场在瞎跳，AI 看不懂。看不懂咱就不动手。
        `
    },
    'haptic-sync': {
        slug: 'haptic-sync',
        title: '触反馈：心跳与信号同步',
        category: '量化逻辑与纪律',
        lastUpdated: '2026-02-15',
        content: `
当你一键刷回“今天”的时候，手机会有个微弱的小震动。
这不是为了炫技，是为了给你的大脑发个信号：“归位了，准备战斗。”这种生理上的小暗示，能帮你瞬间找回交易状态。
        `
    },

    // --- 4. Validation & Trust (验证与诚信) ---
    'multi-day-verification': {
        slug: 'multi-day-verification',
        title: 'T+3 验证：趋势需要时间',
        category: '验证与诚信',
        lastUpdated: '2026-02-15',
        content: `
咱不玩那种“一秒钟涨跌”的游戏，那叫赌博。
一个好策略需要 2-3 天来释放价值。所以我们追踪预测后的 72 小时轨迹。只要这三天里最高涨幅达到了预期，这票就算赢。这才是做大趋势该有的格局。
        `
    },
    'verification-states': {
        slug: 'verification-states',
        title: '验证的三种状态',
        category: '验证与诚信',
        lastUpdated: '2026-02-15',
        content: `
- **正在跑**：比赛还没结束，多空还在搏斗。
- **中了**：走势印证了逻辑，这一局咱拿下了。
- **偏了**：市场不给面子，逻辑失效，咱撤退重来。
        `
    },
    'value-of-failure': {
        slug: 'value-of-failure',
        title: '认错的价值：咱们不删帖',
        category: '验证与诚信',
        lastUpdated: '2026-02-15',
        content: `
咱们的历史轴里有很多灰色的“X”。
我们从不删错贴。**诚信是量化投资的命根子。** 每一个错误都是 AI 下次进化的养料，也是让你看清 AI “边界”在哪里的最好教具。
        `
    },

    // --- 5. Identity & Security (身份与安全) ---
    'identity-passport': {
        slug: 'identity-passport',
        title: '身份护照：UserID 就是你的命',
        category: '账号与安全',
        lastUpdated: '2026-02-15',
        content: `
在这个 App 里，你不叫“张三”或“李四”，你就是那串 UserID。
我们不需要你的手机号，也不需要你的身份证。这就是你的全匿名通行证，管好它，别让人偷看。
        `
    },
    'email-sync-logic': {
        slug: 'email-sync-logic',
        title: '绑定邮箱：唯一的“救命稻草”',
        category: '账号与安全',
        lastUpdated: '2026-02-15',
        content: `
因为咱不存你的手机号，一旦你换手机或者清理了浏览器缓存，你的权益就丢了。
**绑定个邮箱吧！** 这是你找回 Pro 会员权益的唯一办法。别等丢了再哭，现在就去绑定。
        `
    },
    'identity-restore-flow': {
        slug: 'identity-restore-flow',
        title: '一键找回：权益瞬间同步',
        category: '账号与安全',
        lastUpdated: '2026-02-15',
        content: `
换了手机？别急。
在设置里输一下你的恢复邮箱，刷的一下，你的监控股、你的 Pro 时间就全都回来了。就像什么都没发生过一样。
        `
    },
    'privacy-pledge': {
        slug: 'privacy-pledge',
        title: '隐私承诺：这是你的避风港',
        category: '账号与安全',
        lastUpdated: '2026-02-15',
        content: `
我们对你赚多少钱不感兴趣。
我们只记录你的股票偏好，而且全是加密的。不收集通讯录，不看地理位置。在这里，你可以安安静静地打磨你的交易系统。
        `
    },
    'badge-hygiene': {
        slug: 'badge-hygiene',
        title: '角标清除：别被红点牵着走',
        category: '账号与安全',
        lastUpdated: '2026-02-15',
        content: `
当你打开 App，手机系统那个红点角标会自动消失。
我们希望你是为了交易才打开 App，而不是为了消灭那个该死的红点。**做一个理性的交易员，从控制多巴胺开始。**
        `
    },

    // --- 6. Benefits & Growth (权益与增长) ---
    'referral-rewards': {
        slug: 'referral-rewards',
        title: '推荐激励：有福同享',
        category: '权益与增长',
        lastUpdated: '2026-02-15',
        content: `
觉得咱这儿准？拉哥们一把。
只要他入场，你们俩都能领到一个“Loot Box”，里面装着 Pro 会员天数。独乐乐不如众乐乐。
        `
    },
    'channel-revenue-guide': {
        slug: 'channel-revenue-guide',
        title: '渠道分润：共同赚钱',
        category: '权益与增长',
        lastUpdated: '2026-02-15',
        content: `
专门给合伙人准备的。
你带来了多少活跃用户，账户里躺了多少佣金，什么时候能提现，全都透明。咱是干量化的，数据上绝不掺假。
        `
    },
    'redeem-code-usage': {
        slug: 'redeem-code-usage',
        title: '兑换码：手动给权益充值',
        category: '权益与增长',
        lastUpdated: '2026-02-15',
        content: `
拿到 \`PRO-XXXX\` 的码了？
去个人中心手动填上。通常这是公测、参加活动或者合伙人送你的特别礼包。手慢无！
        `
    },
    'tiers-explained': {
        slug: 'tiers-explained',
        title: 'Free 与 Pro：差距在哪？',
        category: '权益与增长',
        lastUpdated: '2026-02-15',
        content: `
- **免费版**：给你 3 个监控位，看点基础结论，这叫“入个门”。
- **Pro 版**：10 个监控位，看全模型的推理链条，还有历史全回溯。这叫“打擂台”。
想靠这个吃饭，Pro 版是刚需。
        `
    },

    // --- 7. Notifications & Reach (通知与触达) ---
    'signal-flip-push': {
        slug: 'signal-flip-push',
        title: '反转推送：只盯“大转折”',
        category: '通知与触达',
        lastUpdated: '2026-02-15',
        content: `
我们不会一天烦你八百次。
只有当多空趋势发生“大反转”（比如多转空）的时候，我们才会给你弹通知。平时那些小水花，咱不操那个心，安安稳稳持股就好。
        `
    },
    'notification-preference': {
        slug: 'notification-preference',
        title: '通知开关：不喜欢就关了',
        category: '通知与触达',
        lastUpdated: '2026-02-15',
        content: `
早报、反转、异动、公告……一共 6 类推送，你嫌哪个烦就关哪个。
我们要的是**高效的信息流**，不是垃圾短信轰炸。
        `
    },
    'web-push-setup': {
        slug: 'web-push-setup',
        title: '推送指南：不错过每一秒',
        category: '通知与触达',
        lastUpdated: '2026-02-15',
        content: `
iOS 用户注意：一定要在 Safari 里点“添加到主屏幕”，之后才能在 App 里开启通知权限。浏览器里是弹不出来的。这是苹果公司的锅，咱得绕着走。
        `
    },
    'push-debug': {
        slug: 'push-debug',
        title: '测测通没通：别被系统拦了',
        category: '通知与触达',
        lastUpdated: '2026-02-15',
        content: `
设了半天收不到通知？
点一下那个“测试推送”按钮。要是手机没响，那准是你的系统防火墙或者省电模式把咱给拦了。去设置里给点权限。
        `
    },

    // --- 8. Data & Infrastructure (数据与服务保障) ---
    'optimistic-ui-logic': {
        slug: 'optimistic-ui-logic',
        title: '乐观更新：不用等圈圈转',
        category: '数据与服务保障',
        lastUpdated: '2026-02-15',
        content: `
当你点“添加股票”的时候，UI 会瞬间反应过来。
网络慢点没关系，系统会在后台慢慢跟服务器对账。我们不希望网络的小转圈打断了你的思路。
        `
    },
    'realtime-data-splicing': {
        slug: 'realtime-data-splicing',
        title: '数据拼接：最新指标不求人',
        category: '数据与服务保障',
        lastUpdated: '2026-02-15',
        content: `
咱们显示的 MA（均线）和指标是“热乎”的。
系统会拿昨天的历史数据，直接缝合从行情源拿到的最新的 15 分钟实时价。不用等收盘，你在盘中看到的线也是准确的。
        `
    },
    'on-demand-sync': {
        slug: 'on-demand-sync',
        title: '按需更新：好钢用在刀刃上',
        category: '数据与服务保障',
        lastUpdated: '2026-02-15',
        content: `
全市场几千只票，我们优先更新你监控池里的那几只。
大家都不看的票，更新频率会自动降低。省下的算力，全用来伺候你最关心的标的了。
        `
    },
    'data-resiliency': {
        slug: 'data-resiliency',
        title: '多线热切：永不断线',
        category: '数据与服务保障',
        lastUpdated: '2026-02-15',
        content: `
如果主数据源（AkShare）卡了，系统会自动切到备用走廊（Yahoo Finance）。
行情软件要是断了线就是在谋财害命。我们准备了多套Fetcher，就是为了保证你在关键时刻永远能连得上。
        `
    }
};

export function getArticleBySlug(slug: string): SupportArticle | undefined {
    return SUPPORT_ARTICLES[slug];
}
