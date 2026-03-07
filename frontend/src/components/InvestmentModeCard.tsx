'use client';

import { useEffect, useState } from 'react';
import { Crown, Loader2, Lock, Radar, RefreshCw, Sparkles } from 'lucide-react';
import {
    getRiskBandLabel,
    type InvestmentModeDefinition,
    type ModeCatalogItem,
    type UserTier,
} from '@/lib/investment-mode';

type PerformanceScope = 'universal' | 'pool';

interface ModeApiResponse {
    mode: InvestmentModeDefinition | null;
    mode_id: string;
    updated_at: string | null;
    allowed_modes: ModeCatalogItem[];
}

interface PerformanceApiResponse {
    mode_id: string;
    scope: PerformanceScope;
    horizon: '7d' | '30d' | '90d';
    state: 'ready' | 'insufficient_sample' | 'stale_data';
    insufficient_sample: boolean;
    message: string | null;
    as_of_date?: string | null;
    metrics?: {
        coverage: number | null;
        hit_rate: number | null;
        max_drawdown: number | null;
        sample_size: number;
        payoff_ratio?: number | null;
        stability_score?: number | null;
    };
}

interface Props {
    currentTier: UserTier;
    onUpgrade: () => void;
}

interface CachedCardData {
    savedAt: number;
    tier: UserTier;
    modeResponse: ModeApiResponse;
    summaries: Partial<Record<PerformanceScope, PerformanceApiResponse>>;
}

const CARD_CACHE_KEY = 'stockwise:investment-mode-card';
const CARD_CACHE_TTL_MS = 10 * 60 * 1000;

const SCOPE_META: Record<PerformanceScope, { title: string; subtitle: string; icon: typeof Sparkles }> = {
    universal: {
        title: '通用表现',
        subtitle: '看这个模式整体是否稳健',
        icon: Sparkles,
    },
    pool: {
        title: '监控池表现',
        subtitle: '看这个模式对你的监控池是否更合适',
        icon: Radar,
    },
};

async function fetchCardData(): Promise<{
    modeResponse: ModeApiResponse;
    summaries: Partial<Record<PerformanceScope, PerformanceApiResponse>>;
}> {
    const modeRes = await fetch('/api/user/mode/summary', { cache: 'no-store' });
    const modeJson = (await modeRes.json().catch(() => ({}))) as Partial<ModeApiResponse> & {
        summaries?: Partial<Record<PerformanceScope, PerformanceApiResponse>>;
        error?: string;
    };

    if (!modeRes.ok) {
        throw new Error(modeJson.error || '暂时无法加载投资模式');
    }

    return {
        modeResponse: {
            mode: (modeJson.mode as InvestmentModeDefinition | null) || null,
            mode_id: String(modeJson.mode_id || ''),
            updated_at: modeJson.updated_at || null,
            allowed_modes: Array.isArray(modeJson.allowed_modes)
                ? (modeJson.allowed_modes as ModeCatalogItem[])
                : [],
        },
        summaries: modeJson.summaries ?? {},
    };
}

function readCachedCardData(currentTier: UserTier): CachedCardData | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(CARD_CACHE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<CachedCardData>;
        if (
            !parsed ||
            parsed.tier !== currentTier ||
            typeof parsed.savedAt !== 'number' ||
            !parsed.modeResponse ||
            !parsed.summaries
        ) {
            return null;
        }

        if (Date.now() - parsed.savedAt > CARD_CACHE_TTL_MS) {
            return null;
        }

        return parsed as CachedCardData;
    } catch {
        return null;
    }
}

function writeCachedCardData(
    currentTier: UserTier,
    modeResponse: ModeApiResponse,
    summaries: Partial<Record<PerformanceScope, PerformanceApiResponse>>
): void {
    if (typeof window === 'undefined') return;

    try {
        const payload: CachedCardData = {
            savedAt: Date.now(),
            tier: currentTier,
            modeResponse,
            summaries,
        };
        window.localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(payload));
    } catch {
        // Cache is optional.
    }
}

function formatPercent(value: number | null, options?: { signed?: boolean }): string {
    if (value == null) return '--';
    const scaled = value * 100;
    const text = `${Math.abs(scaled).toFixed(1)}%`;
    if (options?.signed) {
        if (scaled > 0) return `+${text}`;
        if (scaled < 0) return `-${text}`;
    }
    return scaled < 0 ? `-${text}` : text;
}

function formatUpdatedAt(value: string | null): string {
    if (!value) return '默认模式';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '默认模式';
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function SectionHeader({
    title,
    detail,
}: {
    title: string;
    detail?: string;
}) {
    return (
        <div className="text-left">
            <div className="flex items-end justify-between gap-3">
                <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>
                {detail ? <p className="text-[11px] font-medium text-slate-500">{detail}</p> : null}
            </div>
        </div>
    );
}

export function InvestmentModeCard({ currentTier, onUpgrade }: Props) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [savingModeId, setSavingModeId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [modeResponse, setModeResponse] = useState<ModeApiResponse | null>(null);
    const [summaryByScope, setSummaryByScope] = useState<Partial<Record<PerformanceScope, PerformanceApiResponse>>>({});

    useEffect(() => {
        let cancelled = false;
        const cached = readCachedCardData(currentTier);

        if (cached) {
            setModeResponse(cached.modeResponse);
            setSummaryByScope(cached.summaries);
            setLoading(false);
            setError(null);
        } else {
            setModeResponse(null);
            setSummaryByScope({});
            setLoading(true);
        }

        async function loadData(): Promise<void> {
            if (!cached) {
                setLoading(true);
            }

            try {
                setError(null);
                const { modeResponse: nextModeResponse, summaries } = await fetchCardData();
                if (cancelled) return;

                setModeResponse(nextModeResponse);
                setSummaryByScope(summaries);
                writeCachedCardData(currentTier, nextModeResponse, summaries);
            } catch (err) {
                if (cancelled) return;
                if (!cached) {
                    setError(err instanceof Error ? err.message : '暂时无法加载投资模式');
                }
            } finally {
                if (cancelled) return;
                setLoading(false);
                setRefreshing(false);
            }
        }

        void loadData();
        return () => {
            cancelled = true;
        };
    }, [currentTier]);

    async function handleRefresh(): Promise<void> {
        setNotice(null);
        setRefreshing(true);
        try {
            const { modeResponse: nextModeResponse, summaries } = await fetchCardData();
            setModeResponse(nextModeResponse);
            setSummaryByScope(summaries);
            setError(null);
            writeCachedCardData(currentTier, nextModeResponse, summaries);
        } catch (err) {
            if (!modeResponse) {
                setError(err instanceof Error ? err.message : '暂时无法加载投资模式');
            }
        } finally {
            setRefreshing(false);
        }
    }

    async function handleSwitchMode(modeId: string): Promise<void> {
        if (!modeResponse || savingModeId || modeId === modeResponse.mode_id) return;

        setSavingModeId(modeId);
        setNotice(null);
        setError(null);

        try {
            const res = await fetch('/api/user/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode_id: modeId }),
            });
            const json = (await res.json().catch(() => ({}))) as { error?: string; note?: string };
            if (!res.ok) {
                throw new Error(json.error || '切换失败，请稍后再试');
            }
            setNotice(json.note || '已切换，后续新结论将按当前模式展示');
            await handleRefresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : '切换失败，请稍后再试');
        } finally {
            setSavingModeId(null);
        }
    }

    const currentMode = modeResponse?.mode;
    const allowedModes = modeResponse?.allowed_modes || [];
    const scopes = (['universal', 'pool'] as PerformanceScope[]).filter(
        (scope) => currentTier === 'pro' || scope === 'universal'
    );

    if (loading) {
        return (
            <div className="min-h-[320px] flex items-center justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    if (error && !modeResponse) {
        return (
            <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/5 px-5 py-5 text-left">
                <p className="text-sm font-bold text-rose-200">暂时无法加载投资模式</p>
                <p className="mt-2 text-[12px] leading-6 text-rose-200/75">{error || '请稍后再试'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-7 pb-12">
            <div className="flex items-start justify-between gap-4">
                <div className="text-left">
                    <p className="text-sm text-slate-400 leading-6">选择适合你的投资风格，并查看对应表现。</p>
                </div>
                <button
                    onClick={() => void handleRefresh()}
                    disabled={refreshing || !!savingModeId}
                    className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] p-2.5 text-slate-400 transition-colors hover:text-white hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-40"
                    aria-label="刷新投资模式"
                >
                    {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-indigo-500/15 bg-gradient-to-br from-indigo-500/12 via-white/[0.03] to-transparent p-[1px]">
                <div className="relative rounded-[27px] bg-[#0c0c14]/96 px-5 py-5">
                    <div className="absolute -right-12 top-0 h-28 w-28 rounded-full bg-indigo-500/10 blur-3xl" />
                    <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-sky-500/10 blur-3xl" />
                    <div className="relative flex items-start justify-between gap-4">
                        <div className="min-w-0 text-left">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300/80">当前模式</p>
                            <div className="mt-3 flex items-center gap-2">
                                <h3 className="text-3xl font-black tracking-tight text-white">{currentMode?.name || '平衡'}</h3>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-slate-300">
                                    {getRiskBandLabel(currentMode?.risk_band)}
                                </span>
                            </div>
                            <p className="mt-3 max-w-[240px] text-sm leading-6 text-slate-300">
                                {currentMode?.tagline || '覆盖与质量平衡，默认推荐'}
                            </p>
                        </div>
                        <span
                            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold border ${
                                currentTier === 'pro'
                                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                    : 'border-white/10 bg-white/[0.05] text-slate-300'
                            }`}
                        >
                            {currentTier === 'pro' ? 'Pro' : 'Free'}
                        </span>
                    </div>

                    <div className="relative mt-6 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-left">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">当前生效</p>
                            <p className="mt-2 text-lg font-black text-white">{formatUpdatedAt(modeResponse?.updated_at || null)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-left">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">模式范围</p>
                            <p className="mt-2 text-lg font-black text-white">{currentTier === 'pro' ? '多模式' : '平衡模式'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <section className="space-y-4">
                <SectionHeader
                    title="选择模式"
                    detail={currentTier === 'free' ? 'Free 默认使用平衡模式' : '切换只影响后续新结论'}
                />
                <div className="grid grid-cols-2 gap-3">
                    {allowedModes.map((mode) => {
                        const active = mode.mode_id === modeResponse?.mode_id;
                        const locked = mode.is_locked;

                        return (
                            <button
                                key={mode.mode_id}
                                type="button"
                                onClick={() => {
                                    if (locked) {
                                        onUpgrade();
                                        return;
                                    }
                                    void handleSwitchMode(mode.mode_id);
                                }}
                                disabled={!!savingModeId}
                                className={`min-h-[148px] rounded-[24px] border px-4 py-4 text-left transition-all ${
                                    active
                                        ? 'border-indigo-500/40 bg-indigo-500/10 shadow-[0_0_0_1px_rgba(99,102,241,0.08)]'
                                        : locked
                                          ? 'border-white/6 bg-white/[0.02]'
                                          : 'border-white/6 bg-white/[0.03] hover:border-white/12 hover:bg-white/[0.045]'
                                } disabled:opacity-60`}
                            >
                                <div className="flex h-full flex-col justify-between gap-6">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[17px] font-black tracking-tight ${active ? 'text-white' : 'text-slate-100'}`}>
                                                {mode.name}
                                            </span>
                                            <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-400">
                                                {getRiskBandLabel(mode.risk_band)}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-[13px] leading-6 text-slate-400 line-clamp-3">{mode.tagline}</p>
                                    </div>
                                    <div className="shrink-0 flex items-center justify-end gap-2">
                                        {savingModeId === mode.mode_id ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                        ) : locked ? (
                                            <span className="flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-slate-400">
                                                <Lock className="w-3.5 h-3.5" />
                                                Pro
                                            </span>
                                        ) : active ? (
                                            <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2.5 py-1 text-[10px] font-bold text-indigo-200">
                                                当前
                                            </span>
                                        ) : (
                                            <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-slate-400">
                                                选择
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="space-y-4">
                <SectionHeader title="模式表现" />
                <div className="space-y-4">
                    {scopes.map((scope) => {
                        const summary = summaryByScope[scope];
                        const meta = SCOPE_META[scope];
                        const Icon = meta.icon;
                        const insufficient = summary?.insufficient_sample;

                        return (
                            <div key={scope} className="rounded-[24px] border border-white/6 bg-white/[0.03] p-4 text-left">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 rounded-2xl border border-indigo-400/15 bg-indigo-400/10 p-2 text-indigo-300">
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h4 className="text-base font-black text-white">{meta.title}</h4>
                                                <p className="mt-1 text-[12px] leading-6 text-slate-400">{meta.subtitle}</p>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">30D</span>
                                        </div>

                                        <div className="mt-4 grid grid-cols-3 gap-2">
                                            <div className="rounded-2xl bg-black/20 px-3 py-3 text-center">
                                                <div className="text-sm font-black text-white">
                                                    {formatPercent(summary?.metrics?.coverage ?? null)}
                                                </div>
                                                <div className="mt-1 text-[10px] text-slate-500">覆盖率</div>
                                            </div>
                                            <div className="rounded-2xl bg-black/20 px-3 py-3 text-center">
                                                <div className="text-sm font-black text-white">
                                                    {formatPercent(summary?.metrics?.hit_rate ?? null)}
                                                </div>
                                                <div className="mt-1 text-[10px] text-slate-500">命中率</div>
                                            </div>
                                            <div className="rounded-2xl bg-black/20 px-3 py-3 text-center">
                                                <div className={`text-sm font-black ${insufficient ? 'text-slate-500' : 'text-white'}`}>
                                                    {formatPercent(summary?.metrics?.max_drawdown ?? null, { signed: true })}
                                                </div>
                                                <div className="mt-1 text-[10px] text-slate-500">最大回撤</div>
                                            </div>
                                        </div>

                                        {summary?.message ? (
                                            <p className="mt-3 text-[11px] leading-5 text-amber-300/85">{summary.message}</p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {notice ? (
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-[12px] text-emerald-200">
                    {notice}
                </div>
            ) : null}

            {currentTier === 'free' ? (
                <div className="rounded-[26px] border border-indigo-500/15 bg-indigo-500/6 p-5 text-left">
                    <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <p className="text-base font-black text-white">解锁更多投资模式与监控池表现</p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                        当前可查看平衡模式的通用表现。升级 Pro 后，可按自己的投资风格切换更多模式，并查看监控池表现。
                    </p>
                    <button
                        type="button"
                        onClick={onUpgrade}
                        className="mt-4 inline-flex items-center rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-500"
                    >
                        升级 Pro
                    </button>
                </div>
            ) : (
                <p className="text-[12px] leading-6 text-slate-500">模式切换只影响后续新结论，历史记录保持不变。</p>
            )}
        </div>
    );
}
