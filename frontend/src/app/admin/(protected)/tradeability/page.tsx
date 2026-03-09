'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Activity,
    ArrowLeft,
    ArrowRightLeft,
    BadgeCheck,
    Bot,
    CircuitBoard,
    FlaskConical,
    Info,
    ShieldAlert,
    TimerReset,
} from 'lucide-react';

type GateStatus = 'PASS' | 'FAIL' | 'HOLD';
type HealthState = 'ok' | 'warn' | 'critical';

interface TradeabilityPayload {
    generated_at: string;
    db_strategy: string;
    summary: {
        production_health: HealthState;
        configured_strategy_version: string;
        active_primary_versions_7d: Array<{
            strategy_version: string;
            sample_count: number;
        }>;
        latest_prices_date: string | null;
        latest_prediction_date: string | null;
        latest_mode_snapshot_date: string | null;
        api_latency_p95_ms_24h: number;
        confidence_low_ratio_7d: number;
        mode_pipeline_success_rate_14d: number;
        default_mode_id: string;
        research_pool: {
            manifest_path: string;
            pool_name: string;
            target_size: number;
            actual_size: number;
            latest_reference_date: string | null;
            latest_price_coverage_count: number;
            latest_signal_coverage_count: number;
            board_groups: Array<{ key: string; label: string; count: number }>;
            price_bands: Array<{ key: string; label: string; count: number }>;
            board_group_metrics: Array<{
                key: string;
                label: string;
                count: number;
                sample_count: number;
                triggered_coverage_pct: number;
                watch_coverage_pct: number;
                riskoff_coverage_pct: number;
                avg_opportunity_score: number;
            }>;
            price_band_metrics: Array<{
                key: string;
                label: string;
                count: number;
                sample_count: number;
                triggered_coverage_pct: number;
                watch_coverage_pct: number;
                riskoff_coverage_pct: number;
                avg_opportunity_score: number;
            }>;
        };
    };
    production: {
        default_mode_id: string;
        default_mode_name: string;
        default_mode_tagline: string;
        default_mode_horizons: Array<{
            horizon: string;
            hit_rate: number;
            coverage: number;
            max_drawdown: number;
            sample_size: number;
            payoff_ratio: number | null;
            stability_score: number | null;
            as_of_date: string | null;
        }>;
        latest_mode_30d: Array<{
            mode_id: string;
            horizon: string;
            hit_rate: number;
            coverage: number;
            max_drawdown: number;
            sample_size: number;
            payoff_ratio: number | null;
            stability_score: number | null;
            as_of_date: string | null;
        }>;
    };
    markets: Array<{
        market: string;
        verdict: {
            gate_status: GateStatus;
            candidate_version: string;
            baseline_version: string;
            pass_streak_weeks: number;
            recommended_action: string | null;
            blocking_reasons: string[];
            latest_week_end: string | null;
            verdict_created_at: string | null;
        };
        research: {
            metrics_7d: Array<{
                strategy_version: string;
                sample_count: number;
                triggered_count: number;
                watch_count: number;
                riskoff_count: number;
                triggered_coverage_pct: number;
                watch_coverage_pct: number;
                riskoff_coverage_pct: number;
                avg_opportunity_score: number;
                latest_date: string | null;
            }>;
            candidate_metric: {
                strategy_version: string;
                sample_count: number;
                triggered_count: number;
                watch_count: number;
                riskoff_count: number;
                triggered_coverage_pct: number;
                watch_coverage_pct: number;
                riskoff_coverage_pct: number;
                avg_opportunity_score: number;
                latest_date: string | null;
            } | null;
            baseline_metric: {
                strategy_version: string;
                sample_count: number;
                triggered_count: number;
                watch_count: number;
                riskoff_count: number;
                triggered_coverage_pct: number;
                watch_coverage_pct: number;
                riskoff_coverage_pct: number;
                avg_opportunity_score: number;
                latest_date: string | null;
            } | null;
        };
        promotion: {
            timeline: Array<{
                event_type: string;
                market: string;
                outcome_status: string;
                actor: string | null;
                created_at: string | null;
                candidate_version: string | null;
                baseline_version: string | null;
                reason: string | null;
                approval_id: string | null;
                rollback_to_version: string | null;
            }>;
        };
    }>;
}

function pct(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '--';
    return `${(value * 100).toFixed(1)}%`;
}

function num(value: number | null | undefined, digits = 2): string {
    if (value == null || Number.isNaN(value)) return '--';
    return value.toFixed(digits);
}

function gateClasses(status: GateStatus) {
    if (status === 'PASS') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    if (status === 'FAIL') return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
}

function gateLabel(status: GateStatus): string {
    if (status === 'PASS') return '通过';
    if (status === 'FAIL') return '未通过';
    return '观察中';
}

function healthClasses(state: HealthState) {
    if (state === 'critical') return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    if (state === 'warn') return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
}

function healthLabel(state: HealthState): string {
    if (state === 'critical') return '严重';
    if (state === 'warn') return '告警';
    return '正常';
}

function humanEventLabel(eventType: string): string {
    if (eventType === 'promotion_execute') return '执行升级';
    if (eventType === 'promotion_approve') return '升级审批';
    if (eventType === 'promotion_rollback') return '执行回退';
    if (eventType === 'verdict') return '门禁结论';
    return eventType;
}

function actionLabel(action: string | null | undefined): string {
    if (!action) return '暂无建议';
    if (action === 'promote_candidate') return '建议升级候选版本';
    if (action === 'hold_and_observe') return '继续观察';
    return action;
}

function outcomeLabel(status: string | null | undefined): string {
    if (!status) return '--';
    if (status === 'approved') return '已审批';
    if (status === 'applied') return '已执行';
    if (status === 'fail') return '失败';
    if (status === 'pass') return '通过';
    return status;
}

function modeLabel(modeId: string): string {
    if (modeId === 'balanced_v1') return '平衡';
    if (modeId === 'steady_v1') return '稳健';
    if (modeId === 'aggressive_v1') return '进取';
    if (modeId === 'observe_only_v1') return '仅观察';
    return modeId;
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '--';
    return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function explainMarket(market: 'CN' | 'HK'): string {
    return market === 'CN' ? 'A 股市场' : '港股市场';
}

export default function TradeabilityControlTowerPage() {
    const [data, setData] = useState<TradeabilityPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeMarket, setActiveMarket] = useState<'CN' | 'HK'>('CN');

    useEffect(() => {
        let active = true;
        const run = async () => {
            try {
                const res = await fetch('/api/admin/tradeability', { cache: 'no-store' });
                const json = await res.json();
                if (active) setData(json);
            } catch (error) {
                console.error('Failed to fetch admin tradeability:', error);
            } finally {
                if (active) setLoading(false);
            }
        };
        run();
        const timer = setInterval(run, 30000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, []);

    const marketData = useMemo(
        () => data?.markets.find((item) => item.market === activeMarket) || null,
        [data, activeMarket],
    );

    const topCards = useMemo(() => {
        if (!data || !marketData) return [];
        const dominant = data.summary.active_primary_versions_7d[0];
        const timeline = marketData.promotion.timeline[0];
        return [
            {
                label: '当前线上版本',
                value: data.summary.configured_strategy_version,
                sub: dominant ? `近 7 天主版本：${dominant.strategy_version}（${dominant.sample_count} 条）` : '近 7 天没有主版本样本',
                icon: CircuitBoard,
                tone: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200',
            },
            {
                label: '当前候选版本',
                value: marketData.verdict.candidate_version,
                sub: `对照版本：${marketData.verdict.baseline_version}`,
                icon: FlaskConical,
                tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
            },
            {
                label: '升级门禁',
                value: gateLabel(marketData.verdict.gate_status),
                sub: actionLabel(marketData.verdict.recommended_action),
                icon: BadgeCheck,
                tone: gateClasses(marketData.verdict.gate_status),
            },
            {
                label: '连续达标周数',
                value: `${marketData.verdict.pass_streak_weeks} 周`,
                sub: `统计周结束：${marketData.verdict.latest_week_end || '--'}`,
                icon: TimerReset,
                tone: 'border-white/15 bg-white/[0.04] text-white',
            },
            {
                label: '线上运行健康度',
                value: healthLabel(data.summary.production_health),
                sub: `模式流水线成功率 ${(data.summary.mode_pipeline_success_rate_14d * 100).toFixed(1)}%`,
                icon: ShieldAlert,
                tone: healthClasses(data.summary.production_health),
            },
            {
                label: '研究池覆盖',
                value: `${data.summary.research_pool.latest_signal_coverage_count}/${data.summary.research_pool.actual_size}`,
                sub: `最新信号覆盖 ${data.summary.research_pool.latest_price_coverage_count}/${data.summary.research_pool.actual_size} 条行情`,
                icon: Bot,
                tone: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
            },
            {
                label: '最近审计动作',
                value: timeline ? humanEventLabel(timeline.event_type) : '暂无',
                sub: timeline ? `${timeline.actor || 'system'} · ${formatDateTime(timeline.created_at)}` : '暂无审计记录',
                icon: BadgeCheck,
                tone: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
            },
        ];
    }, [data, marketData]);

    return (
        <div className="min-h-screen bg-[#050508] text-white p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Link href="/admin" className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                                <ArrowLeft className="w-4 h-4 text-slate-300" />
                            </Link>
                            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">管理员后台</span>
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                                策略 <span className="text-cyan-400">控制台</span>
                            </h1>
                            <p className="text-sm text-slate-500 mt-2">
                                一屏区分研究流水线和生产流水线，帮助判断现在能不能升级、为什么不能升级。
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-slate-400">
                            数据源：<span className="text-white font-mono">{data?.db_strategy || '--'}</span>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-slate-400">
                            更新时间：<span className="text-white font-mono">{formatDateTime(data?.generated_at)}</span>
                        </div>
                    </div>
                </header>

                <div className="flex items-center gap-2">
                    {(['CN', 'HK'] as const).map((market) => (
                        <button
                            key={market}
                            type="button"
                            onClick={() => setActiveMarket(market)}
                            className={`px-4 py-2 rounded-xl border text-xs font-black tracking-widest transition ${
                                activeMarket === market
                                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
                            }`}
                        >
                            {market}
                        </button>
                    ))}
                </div>

                {loading && !data ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                    </div>
                ) : !data || !marketData ? (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">
                        暂无控制塔数据。
                    </div>
                ) : (
                    <>
                        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {topCards.map((card) => (
                                <article key={card.label} className={`rounded-3xl border p-5 ${card.tone}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] uppercase tracking-[0.28em] font-black opacity-80">{card.label}</div>
                                        <card.icon className="w-4 h-4 opacity-80" />
                                    </div>
                                    <div className="mt-4 text-2xl font-black tracking-tight">{card.value}</div>
                                    <p className="mt-2 text-xs opacity-80">{card.sub}</p>
                                </article>
                            ))}
                        </section>

                        <section className="rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.04] p-6">
                            <div className="flex items-center gap-2 text-cyan-200 text-xs uppercase tracking-[0.24em] font-black">
                                <Info className="w-4 h-4" />
                                阅读说明
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <TipCard
                                    title="研究流水线"
                                    text="研究流水线跑在研究池上。研究池独立于产品池，用来科学验证规则，不直接受用户关注池限制。"
                                />
                                <TipCard
                                    title="生产流水线"
                                    text="生产流水线跑在产品池上。产品池就是用户真实形成的池子，只负责承接已经验证过的结论。"
                                />
                                <TipCard
                                    title="升级门禁"
                                    text="这是系统给出的升级结论。通过=允许进入升级流程；未通过=继续观察或修正；观察中=样本或观察窗口还不够。"
                                />
                                <TipCard
                                    title="研究池覆盖"
                                    text="看研究池当天有多少股票已经有最新行情、又有最新量化信号。这个数偏低，说明线上实验还没真正跑满。"
                                />
                            </div>
                        </section>

                        <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
                            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                                <SectionHeader
                                    icon={FlaskConical}
                                    title="研究流水线"
                                    description={`查看 ${explainMarket(activeMarket)} 最近窗口里，候选版本相对对照版本的表现差异。`}
                                    tone="text-cyan-300"
                                />
                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    {[marketData.research.candidate_metric, marketData.research.baseline_metric].map((metric, index) => (
                                        <div key={metric?.strategy_version || index} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-black">{metric?.strategy_version || '--'}</div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {index === 0 ? '候选版本' : '对照版本'} | 最新日期 {metric?.latest_date || '--'}
                                                    </div>
                                                </div>
                                                <ArrowRightLeft className="w-4 h-4 text-slate-600" />
                                            </div>
                                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                <MetricBlock label="触发率" value={pct(metric?.triggered_coverage_pct)} />
                                                <MetricBlock label="观察率" value={pct(metric?.watch_coverage_pct)} />
                                                <MetricBlock label="风险规避率" value={pct(metric?.riskoff_coverage_pct)} />
                                                <MetricBlock label="机会评分" value={num(metric?.avg_opportunity_score)} />
                                            </div>
                                            <div className="mt-3 text-xs text-slate-500">
                                                样本 {metric?.sample_count ?? 0} 条 | 触发 {metric?.triggered_count ?? 0} 条
                                            </div>
                                            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                                                触发率表示最近样本里进入“可出手”状态的比例。风险规避率越高，说明系统越偏向先避险。
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-black">当前门禁结论</div>
                                            <div className="text-xs text-slate-500 mt-1">{activeMarket} 市场当前是否允许升级</div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full border text-xs font-black ${gateClasses(marketData.verdict.gate_status)}`}>
                                            {gateLabel(marketData.verdict.gate_status)}
                                        </span>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        {marketData.verdict.blocking_reasons.length > 0 ? (
                                            marketData.verdict.blocking_reasons.map((reason) => (
                                                <div key={reason} className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-100">
                                                    {reason}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-100">
                                                当前没有阻塞项。
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                                        阻塞原因是当前不能升级的直接原因。这里最值得优先看，通常比单个指标数字更重要。
                                    </div>
                                </div>
                            </article>

                            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                                <SectionHeader
                                    icon={CircuitBoard}
                                    title="生产流水线"
                                    description="查看线上当前正式配置，以及对应的正式表现。"
                                    tone="text-indigo-300"
                                />
                                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className="text-sm font-black">{data.production.default_mode_name}</div>
                                    <div className="text-xs text-slate-500 mt-1">{data.production.default_mode_tagline}</div>
                                    <div className="mt-3 text-xs text-slate-400">
                                        当前配置策略 <span className="font-mono text-white">{data.summary.configured_strategy_version}</span>
                                    </div>
                                    <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                                        这里不是研究样本，而是正式口径。它回答的是“当前线上版本实际表现如何”。
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3">
                                    {data.production.default_mode_horizons.map((item) => (
                                        <div key={item.horizon} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-black">{item.horizon.toUpperCase()}</div>
                                                <div className="text-xs text-slate-500">统计到 {item.as_of_date || '--'}</div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                                <MetricBlock label="胜率" value={pct(item.hit_rate)} />
                                                <MetricBlock label="出手率" value={pct(item.coverage)} />
                                                <MetricBlock label="最大回撤" value={pct(item.max_drawdown)} />
                                                <MetricBlock label="样本数" value={String(item.sample_size)} />
                                            </div>
                                            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                                                胜率看历史上做对的比例；出手率看系统愿意给出明确出手结论的频率；最大回撤看最差情况下会承受多大损失。
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </article>
                        </section>

                        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                                <SectionHeader
                                    icon={Activity}
                                    title="系统概况"
                                    description="只看运行健康度，用来判断当前问题来自策略本身，还是来自运行链路。"
                                    tone="text-emerald-300"
                                />
                                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    <MetricPanel label="API 延迟 P95" value={`${data.summary.api_latency_p95_ms_24h.toFixed(0)} ms`} hint="近 24 小时" />
                                    <MetricPanel label="低置信度占比" value={pct(data.summary.confidence_low_ratio_7d)} hint="近 7 天" />
                                    <MetricPanel label="模式流水线成功率" value={pct(data.summary.mode_pipeline_success_rate_14d)} hint="近 14 天" />
                                    <MetricPanel label="研究池大小" value={`${data.summary.research_pool.actual_size}`} hint={data.summary.research_pool.pool_name} />
                                    <MetricPanel label="研究池行情覆盖" value={`${data.summary.research_pool.latest_price_coverage_count}/${data.summary.research_pool.actual_size}`} hint={data.summary.research_pool.latest_reference_date || '最新参考日'} />
                                    <MetricPanel label="研究池信号覆盖" value={`${data.summary.research_pool.latest_signal_coverage_count}/${data.summary.research_pool.actual_size}`} hint={activeMarket === 'CN' ? '最新 sidecar' : '当前仅接入 CN'} />
                                    <MetricPanel label="最新行情日期" value={data.summary.latest_prices_date || '--'} hint="daily_prices" />
                                    <MetricPanel label="最新预测日期" value={data.summary.latest_prediction_date || '--'} hint="ai_predictions_v2" />
                                    <MetricPanel label="最新模式快照" value={data.summary.latest_mode_snapshot_date || '--'} hint="mode_performance_snapshot" />
                                </div>
                            </article>

                            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                                <SectionHeader
                                    icon={BadgeCheck}
                                    title="升级中心"
                                    description="按时间顺序记录门禁、审批、升级和回退。这里主要用于复盘和追踪。"
                                    tone="text-amber-300"
                                />
                                <div className="mt-4 space-y-3">
                                    {marketData.promotion.timeline.slice(0, 8).map((item, index) => (
                                        <div key={`${item.event_type}-${item.created_at || index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-sm font-black">{humanEventLabel(item.event_type)}</div>
                                                <div className="text-xs text-slate-500">{formatDateTime(item.created_at)}</div>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-400">
                                                {item.actor || 'system'} | {outcomeLabel(item.outcome_status)}
                                            </div>
                                            <div className="mt-2 text-xs text-slate-500">
                                                {item.rollback_to_version
                                                    ? `回退到 ${item.rollback_to_version}`
                                                    : `${item.candidate_version || '--'} 对比 ${item.baseline_version || '--'}`}
                                            </div>
                                            {item.reason ? <div className="mt-2 text-xs text-amber-100">{item.reason}</div> : null}
                                        </div>
                                    ))}
                                </div>
                            </article>
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                            <SectionHeader
                                icon={Bot}
                                title="研究池分布"
                                description="这是当前 500 只研究池的基础分布。后续做板块、价格带实验时，直接基于这些分组切池。"
                                tone="text-sky-300"
                            />
                            <div className="mt-4 grid gap-6 xl:grid-cols-2">
                                <div className="space-y-3">
                                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500 font-black">板块分布</div>
                                    {data.summary.research_pool.board_groups.map((item) => (
                                        <div key={item.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-sm font-black">{item.label}</div>
                                                <div className="text-sm font-mono text-white">{item.count}</div>
                                            </div>
                                            <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-sky-400/80"
                                                    style={{ width: `${(item.count / Math.max(data.summary.research_pool.actual_size, 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-3">
                                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500 font-black">价格带分布</div>
                                    {data.summary.research_pool.price_bands.map((item) => (
                                        <div key={item.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-sm font-black">{item.label}</div>
                                                <div className="text-sm font-mono text-white">{item.count}</div>
                                            </div>
                                            <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-cyan-400/80"
                                                    style={{ width: `${(item.count / Math.max(data.summary.research_pool.actual_size, 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="grid gap-6 xl:grid-cols-2">
                            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                                <SectionHeader
                                    icon={FlaskConical}
                                    title="板块实验结果"
                                    description="这是研究池内各板块分组在最新实验日的量化结果，先看哪组更容易出现可出手机会。"
                                    tone="text-cyan-300"
                                />
                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-slate-500 text-xs uppercase tracking-widest">
                                            <tr className="border-b border-white/10">
                                                <th className="text-left py-3 pr-3">分组</th>
                                                <th className="text-left py-3 pr-3">池子数</th>
                                                <th className="text-left py-3 pr-3">当天样本</th>
                                                <th className="text-left py-3 pr-3">触发率</th>
                                                <th className="text-left py-3 pr-3">观察率</th>
                                                <th className="text-left py-3">风险规避率</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.summary.research_pool.board_group_metrics.map((row) => (
                                                <tr key={row.key} className="border-b border-white/5">
                                                    <td className="py-3 pr-3 font-black">{row.label}</td>
                                                    <td className="py-3 pr-3 font-mono">{row.count}</td>
                                                    <td className="py-3 pr-3 font-mono">{row.sample_count}</td>
                                                    <td className="py-3 pr-3 font-mono">{pct(row.triggered_coverage_pct)}</td>
                                                    <td className="py-3 pr-3 font-mono">{pct(row.watch_coverage_pct)}</td>
                                                    <td className="py-3 font-mono">{pct(row.riskoff_coverage_pct)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </article>

                            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                                <SectionHeader
                                    icon={FlaskConical}
                                    title="价格带实验结果"
                                    description="这是研究池内各价格带分组在最新实验日的量化结果，用来判断规则更适合哪类价格区间。"
                                    tone="text-cyan-300"
                                />
                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-slate-500 text-xs uppercase tracking-widest">
                                            <tr className="border-b border-white/10">
                                                <th className="text-left py-3 pr-3">分组</th>
                                                <th className="text-left py-3 pr-3">池子数</th>
                                                <th className="text-left py-3 pr-3">当天样本</th>
                                                <th className="text-left py-3 pr-3">触发率</th>
                                                <th className="text-left py-3 pr-3">观察率</th>
                                                <th className="text-left py-3">风险规避率</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.summary.research_pool.price_band_metrics.map((row) => (
                                                <tr key={row.key} className="border-b border-white/5">
                                                    <td className="py-3 pr-3 font-black">{row.label}</td>
                                                    <td className="py-3 pr-3 font-mono">{row.count}</td>
                                                    <td className="py-3 pr-3 font-mono">{row.sample_count}</td>
                                                    <td className="py-3 pr-3 font-mono">{pct(row.triggered_coverage_pct)}</td>
                                                    <td className="py-3 pr-3 font-mono">{pct(row.watch_coverage_pct)}</td>
                                                    <td className="py-3 font-mono">{pct(row.riskoff_coverage_pct)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </article>
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                            <SectionHeader
                                icon={Bot}
                                title="模式表现表"
                                description="用于横向比较几个模式最近 30 天的正式表现，帮助判断当前默认模式是否合理。"
                                tone="text-indigo-300"
                            />
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-slate-500 text-xs uppercase tracking-widest">
                                        <tr className="border-b border-white/10">
                                            <th className="text-left py-3 pr-3">模式</th>
                                            <th className="text-left py-3 pr-3"><HeaderTip label="胜率" tip="胜率表示历史样本里判断方向大体正确的比例。越高通常越好，但也要结合样本数一起看。" /></th>
                                            <th className="text-left py-3 pr-3"><HeaderTip label="出手率" tip="出手率表示系统愿意给出明确出手结论的比例。越高说明出手更频繁，但不代表质量一定更高。" /></th>
                                            <th className="text-left py-3 pr-3"><HeaderTip label="最大回撤" tip="最大回撤表示这段时间里最差的一次下滑幅度。绝对值越大，说明承受的风险越高。" /></th>
                                            <th className="text-left py-3 pr-3"><HeaderTip label="盈亏比" tip="盈亏比表示平均盈利和平均亏损的相对关系。大于 1 通常更理想，说明赚的时候比亏的时候更多。" /></th>
                                            <th className="text-left py-3 pr-3"><HeaderTip label="稳定性" tip="稳定性表示结果是否平稳、是否容易大起大落。越高通常说明策略更稳，不容易忽好忽坏。" /></th>
                                            <th className="text-left py-3"><HeaderTip label="样本数" tip="样本数表示这组统计是基于多少条历史记录算出来的。样本太少时，指标参考价值会下降。" /></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.production.latest_mode_30d.map((row) => (
                                            <tr key={row.mode_id} className="border-b border-white/5">
                                                <td className="py-3 pr-3">
                                                    <div className="font-black">{modeLabel(row.mode_id)}</div>
                                                    <div className="text-xs text-slate-500">{row.mode_id}</div>
                                                </td>
                                                <td className="py-3 pr-3 font-mono">{pct(row.hit_rate)}</td>
                                                <td className="py-3 pr-3 font-mono">{pct(row.coverage)}</td>
                                                <td className="py-3 pr-3 font-mono">{pct(row.max_drawdown)}</td>
                                                <td className="py-3 pr-3 font-mono">{num(row.payoff_ratio)}</td>
                                                <td className="py-3 pr-3 font-mono">{num(row.stability_score)}</td>
                                                <td className="py-3 font-mono">{row.sample_size}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}

function MetricPanel({ label, value, hint }: { label: string; value: string; hint: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-black">{label}</div>
            <div className="mt-3 text-2xl font-black">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{hint}</div>
        </div>
    );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-black">{label}</div>
            <div className="mt-1 font-mono text-white">{value}</div>
        </div>
    );
}

function SectionHeader({
    icon: Icon,
    title,
    description,
    tone,
}: {
    icon: typeof Activity;
    title: string;
    description: string;
    tone: string;
}) {
    return (
        <div>
            <div className={`flex items-center gap-2 text-xs uppercase tracking-[0.24em] font-black ${tone}`}>
                <Icon className="w-4 h-4" />
                {title}
            </div>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
    );
}

function TipCard({ title, text }: { title: string; text: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-black text-white">{title}</div>
            <p className="mt-2 text-xs leading-6 text-slate-400">{text}</p>
        </div>
    );
}

function HeaderTip({ label, tip }: { label: string; tip: string }) {
    return (
        <span className="group relative inline-flex items-center gap-1">
            <span>{label}</span>
            <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-[10px] normal-case text-slate-400 cursor-help transition hover:border-cyan-400/40 hover:text-cyan-200"
                aria-label={`${label}说明`}
            >
                ?
            </button>
            <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-56 rounded-xl border border-cyan-400/20 bg-[#0b0d13] px-3 py-2 text-left text-[11px] normal-case leading-5 text-slate-300 shadow-2xl shadow-black/40 group-hover:block group-focus-within:block">
                {tip}
            </span>
        </span>
    );
}
