'use client';

import { useEffect, useState } from 'react';
import { Crown, Loader2, Lock, Radar, RefreshCw, Shield, Sparkles } from 'lucide-react';
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

async function fetchCardData(currentTier: UserTier): Promise<{
    modeResponse: ModeApiResponse;
    summaries: Partial<Record<PerformanceScope, PerformanceApiResponse>>;
}> {
    const modeRes = await fetch('/api/user/mode', { cache: 'no-store' });
    const modeJson = (await modeRes.json().catch(() => ({}))) as Partial<ModeApiResponse> & { error?: string };
    if (!modeRes.ok) {
        throw new Error(modeJson.error || '暂时无法加载投资模式');
    }

    const nextModeResponse: ModeApiResponse = {
        mode: (modeJson.mode as InvestmentModeDefinition | null) || null,
        mode_id: String(modeJson.mode_id || ''),
        updated_at: modeJson.updated_at || null,
        allowed_modes: Array.isArray(modeJson.allowed_modes)
            ? (modeJson.allowed_modes as ModeCatalogItem[])
            : [],
    };

    const scopes: PerformanceScope[] = currentTier === 'pro' ? ['universal', 'pool'] : ['universal'];
    const summaries = await Promise.all(
        scopes.map(async (scope) => {
            const res = await fetch(
                `/api/modes/performance?scope=${scope}&horizon=30d&mode_id=${encodeURIComponent(nextModeResponse.mode_id)}`,
                { cache: 'no-store' }
            );
            const json = (await res.json().catch(() => ({}))) as PerformanceApiResponse & { error?: string };
            if (!res.ok) {
                throw new Error(json.error || '暂时无法加载表现数据');
            }
            return [scope, json] as const;
        })
    );

    return {
        modeResponse: nextModeResponse,
        summaries: Object.fromEntries(summaries) as Partial<Record<PerformanceScope, PerformanceApiResponse>>,
    };
}

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

        async function loadData(): Promise<void> {
            setLoading(true);

            try {
                setError(null);
                const { modeResponse: nextModeResponse, summaries } = await fetchCardData(currentTier);

                if (cancelled) return;

                setModeResponse(nextModeResponse);
                setSummaryByScope(summaries);
            } catch (err) {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : '暂时无法加载投资模式';
                setError(message);
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
            const { modeResponse: nextModeResponse, summaries } = await fetchCardData(currentTier);
            setModeResponse(nextModeResponse);
            setSummaryByScope(summaries);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : '暂时无法加载投资模式');
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

    return (
        <div className="glass-card !p-0 rounded-[24px] overflow-hidden border-white/5 bg-white/[0.02]">
            <div className="px-5 py-4 border-b border-white/5">
                <div className="flex items-start justify-between gap-3">
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-indigo-400" />
                            <h4 className="text-sm font-bold text-white uppercase">投资模式</h4>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                            选择更适合你的投资风格，并查看对应表现。
                        </p>
                    </div>
                    <button
                        onClick={() => void handleRefresh()}
                        disabled={loading || refreshing || !!savingModeId}
                        className="p-2 rounded-full text-slate-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                        aria-label="刷新投资模式"
                    >
                        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="px-5 py-4 space-y-4">
                {loading ? (
                    <div className="py-8 flex items-center justify-center text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-left">
                        <p className="text-xs font-bold text-rose-300">暂时无法加载投资模式</p>
                        <p className="mt-1 text-[11px] text-rose-200/70">{error || '请稍后再试'}</p>
                    </div>
                ) : (
                    <>
                        <div className="rounded-[20px] border border-white/5 bg-white/[0.02] p-4 text-left">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-black text-white">{currentMode?.name || '平衡'}</span>
                                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase">
                                            {getRiskBandLabel(currentMode?.risk_band)}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {currentMode?.tagline || '覆盖与质量平衡，默认推荐'}
                                    </p>
                                </div>
                                {currentTier === 'pro' ? (
                                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300 border border-amber-500/20">
                                        Pro
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-400 border border-white/10">
                                        Free
                                    </span>
                                )}
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
                                <span className="text-slate-500">当前生效</span>
                                <span className="font-bold text-slate-300">{formatUpdatedAt(modeResponse?.updated_at || null)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">选择模式</span>
                                {currentTier === 'free' && (
                                    <span className="text-[10px] font-bold text-slate-600">Free 当前默认使用平衡模式</span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
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
                                            className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                                                active
                                                    ? 'border-indigo-500/40 bg-indigo-500/10'
                                                    : locked
                                                      ? 'border-white/5 bg-white/[0.02]'
                                                      : 'border-white/5 bg-white/[0.03] hover:border-white/10'
                                            } disabled:opacity-60`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-sm font-bold ${active ? 'text-white' : 'text-slate-200'}`}>
                                                    {mode.name}
                                                </span>
                                                {locked ? (
                                                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                                                ) : active ? (
                                                    <span className="text-[10px] font-black text-indigo-300">当前</span>
                                                ) : savingModeId === mode.mode_id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                                ) : null}
                                            </div>
                                            <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{mode.tagline}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {(['universal', 'pool'] as PerformanceScope[])
                                .filter((scope) => currentTier === 'pro' || scope === 'universal')
                                .map((scope) => {
                                    const summary = summaryByScope[scope];
                                    const meta = SCOPE_META[scope];
                                    const Icon = meta.icon;
                                    const insufficient = summary?.insufficient_sample;

                                    return (
                                        <div key={scope} className="rounded-[20px] border border-white/5 bg-white/[0.02] p-4 text-left">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <Icon className="w-4 h-4 text-indigo-400" />
                                                        <span className="text-sm font-bold text-white">
                                                            {meta.title} · 30D
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-[11px] text-slate-500">{meta.subtitle}</p>
                                                </div>
                                            </div>

                                            <div className="mt-3 grid grid-cols-3 gap-2">
                                                <div className="rounded-2xl bg-black/20 px-3 py-2 text-center">
                                                    <div className="text-sm font-black text-white">
                                                        {formatPercent(summary?.metrics?.coverage ?? null)}
                                                    </div>
                                                    <div className="mt-1 text-[10px] text-slate-500">覆盖率</div>
                                                </div>
                                                <div className="rounded-2xl bg-black/20 px-3 py-2 text-center">
                                                    <div className="text-sm font-black text-white">
                                                        {formatPercent(summary?.metrics?.hit_rate ?? null)}
                                                    </div>
                                                    <div className="mt-1 text-[10px] text-slate-500">命中率</div>
                                                </div>
                                                <div className="rounded-2xl bg-black/20 px-3 py-2 text-center">
                                                    <div className={`text-sm font-black ${insufficient ? 'text-slate-500' : 'text-white'}`}>
                                                        {formatPercent(summary?.metrics?.max_drawdown ?? null, { signed: true })}
                                                    </div>
                                                    <div className="mt-1 text-[10px] text-slate-500">最大回撤</div>
                                                </div>
                                            </div>

                                            {summary?.message && (
                                                <p className="mt-3 text-[11px] text-amber-300/80">{summary.message}</p>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>

                        {notice && <p className="text-[11px] text-emerald-300">{notice}</p>}

                        {currentTier === 'free' ? (
                            <div className="rounded-[20px] border border-indigo-500/15 bg-indigo-500/5 p-4 text-left">
                                <div className="flex items-center gap-2">
                                    <Crown className="w-4 h-4 text-amber-400" />
                                    <p className="text-sm font-bold text-white">解锁更多投资模式与监控池表现</p>
                                </div>
                                <p className="mt-2 text-[11px] leading-5 text-slate-400">
                                    当前可查看平衡模式的通用表现。升级 Pro 后，可按自己的投资风格切换更多模式，并查看监控池表现。
                                </p>
                                <button
                                    type="button"
                                    onClick={onUpgrade}
                                    className="mt-3 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-indigo-500"
                                >
                                    升级 Pro
                                </button>
                            </div>
                        ) : (
                            <p className="text-[11px] leading-5 text-slate-500">
                                模式切换只影响后续新结论，历史记录保持不变。
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
