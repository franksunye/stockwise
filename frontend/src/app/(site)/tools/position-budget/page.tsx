'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    Calculator,
    CheckCircle2,
    Loader2,
    RefreshCcw,
    Target,
    Wand2,
    X,
} from 'lucide-react';

import { computePositionBudget, type PositionBudgetRMode } from '@/lib/position-budget';
import { parseTacticalData } from '@/lib/tactical-brief-content';
import { getCurrentUser } from '@/lib/user';
import { useGlobalT, useLocale, useT } from '@/context/LocaleContext';
import type { AppLocale, MessageKey } from '@/lib/i18n';
import { getLocalizedStockName } from '@/lib/stock-name';
import { getMarketBadge } from '@/lib/market-badge';
import { useWatchlist } from '@/hooks/useWatchlist';
import { StockSymbolSearchField } from '@/components/stock/StockSymbolSearchField';
import { useStockSymbolSearch } from '@/hooks/useStockSymbolSearch';
import {
    fetchPositionBudgetPreferences,
    fetchPositionBudgetSnapshots,
    fetchPositionBudgetStockIdentity,
    savePositionBudgetPreferences,
    savePositionBudgetSnapshot,
    type PositionBudgetSnapshot,
} from '@/lib/position-budget-client';

type SelectedStock = {
    symbol: string;
    name?: string;
    name_en?: string | null;
    market?: string;
    lastClose?: number | null;
};

type Banner =
    | { tone: 'info'; text: string }
    | { tone: 'success'; text: string }
    | { tone: 'error'; text: string };

function toNumber(value: unknown): number | null {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function parseMaybePrice(raw: unknown): number | null {
    if (Array.isArray(raw)) {
        for (const item of raw) {
            const parsed = toNumber(item);
            if (parsed !== null && parsed > 0) return parsed;
        }
        return null;
    }
    const parsed = toNumber(raw);
    return parsed !== null && parsed > 0 ? parsed : null;
}

function fmt(value: number | null | undefined, digits = 2, appLocale: AppLocale = 'cn'): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const tag = appLocale === 'en' ? 'en-US' : 'zh-CN';
    return Number(value).toLocaleString(tag, {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
    });
}

function fmtDate(value: string | null | undefined, appLocale: AppLocale): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(appLocale === 'en' ? 'en-US' : 'zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function snapshotRMultiple(snapshot: PositionBudgetSnapshot): number | null {
    if (snapshot.target_price == null || snapshot.risk_per_share <= 0) return null;
    const multiple = (snapshot.target_price - snapshot.entry_price) / snapshot.risk_per_share;
    return Number.isFinite(multiple) ? multiple : null;
}

const BUDGET_ERROR_KEYS: Record<string, MessageKey<'positionBudget'>> = {
    'Invalid account size': 'budgetErrors.invalidAccountSize',
    'Invalid risk ratio': 'budgetErrors.invalidRiskRatio',
    'Risk ratio must be at least 0.1%': 'budgetErrors.riskRatioMin',
    'Risk ratio must not exceed 5%': 'budgetErrors.riskRatioMax',
    'Invalid entry price': 'budgetErrors.invalidEntryPrice',
    'Missing stop percent': 'budgetErrors.missingStopPercent',
    'Stop percent must be between 1% and 10%': 'budgetErrors.stopPercentRange',
    'Invalid stop loss price': 'budgetErrors.invalidStopLossPrice',
    'Entry price must be greater than stop loss price': 'budgetErrors.entryAboveStop',
    'Position size is zero under current parameters': 'budgetErrors.positionSizeZero',
    'Position notional exceeds account size': 'budgetErrors.notionalExceedsAccount',
};

const BUDGET_WARNING_KEYS: Record<string, MessageKey<'positionBudget'>> = {
    'Risk ratio is above 2%': 'budgetWarnings.riskRatioHigh',
};

export default function PositionBudgetToolPage() {
    const t = useT('positionBudget');
    const tg = useGlobalT();
    const { locale, setLocale } = useLocale();
    const stockLocale = locale === 'en' ? 'en' : 'cn';

    const {
        query,
        setQuery,
        searchResults,
        showSuggestions,
        setShowSuggestions,
        searching,
        runSearchNow,
        resetSearch,
    } = useStockSymbolSearch();

    const [bootstrapped, setBootstrapped] = useState(false);
    const [loadingPref, setLoadingPref] = useState(false);
    const [loadingPrefill, setLoadingPrefill] = useState(false);
    const [saving, setSaving] = useState(false);
    const [banner, setBanner] = useState<Banner | null>(null);
    const [snapshots, setSnapshots] = useState<PositionBudgetSnapshot[]>([]);
    const [loadingSnapshots, setLoadingSnapshots] = useState(false);

    const [selected, setSelected] = useState<SelectedStock | null>(null);

    const [entryPrice, setEntryPrice] = useState('');
    const [targetPrice, setTargetPrice] = useState('');
    const [systemStopLossPrice, setSystemStopLossPrice] = useState('');
    const [fixedStopLossPrice, setFixedStopLossPrice] = useState('');
    const [accountSize, setAccountSize] = useState('');
    const [riskRatioPercent, setRiskRatioPercent] = useState('1');
    const [stopPercent, setStopPercent] = useState('5');
    const [rMode, setRMode] = useState<PositionBudgetRMode>('system_followed');
    const prefillAbortRef = useRef<AbortController | null>(null);
    const prefillSeqRef = useRef(0);

    const { watchlist, loading: watchlistLoading } = useWatchlist();

    const refreshSnapshots = useCallback(async () => {
        setLoadingSnapshots(true);
        try {
            const rows = await fetchPositionBudgetSnapshots({ limit: 8 });
            setSnapshots(rows);
        } finally {
            setLoadingSnapshots(false);
        }
    }, []);

    // Bootstrap: ensure anonymous user + load preferences
    useEffect(() => {
        let active = true;
        async function bootstrap() {
            setLoadingPref(true);
            try {
                await getCurrentUser();
                const preferences = await fetchPositionBudgetPreferences();
                if (!active) return;
                void refreshSnapshots();
                if (!preferences) return;
                if (preferences.default_account_size != null) {
                    setAccountSize(String(preferences.default_account_size));
                }
                if (preferences.default_risk_ratio != null) {
                    setRiskRatioPercent(
                        String((Number(preferences.default_risk_ratio) * 100).toFixed(2)),
                    );
                }
                if (preferences.default_r_mode) {
                    setRMode(preferences.default_r_mode);
                }
            } finally {
                if (active) {
                    setLoadingPref(false);
                    setBootstrapped(true);
                }
            }
        }
        void bootstrap();
        return () => {
            active = false;
            prefillAbortRef.current?.abort();
        };
    }, [refreshSnapshots]);

    // Auto-dismiss banner
    useEffect(() => {
        if (!banner) return;
        const t = setTimeout(() => setBanner(null), banner.tone === 'error' ? 4000 : 3000);
        return () => clearTimeout(t);
    }, [banner]);

    const budget = useMemo(() => {
        const riskRatio = Number(riskRatioPercent) / 100;
        return computePositionBudget({
            accountSize: Number(accountSize),
            riskRatio,
            entryPrice: Number(entryPrice),
            targetPrice: targetPrice === '' ? null : Number(targetPrice),
            rMode,
            systemStopLossPrice: systemStopLossPrice === '' ? null : Number(systemStopLossPrice),
            fixedStopLossPrice: fixedStopLossPrice === '' ? null : Number(fixedStopLossPrice),
            stopPercent: Number(stopPercent) / 100,
        });
    }, [
        accountSize,
        entryPrice,
        fixedStopLossPrice,
        rMode,
        riskRatioPercent,
        stopPercent,
        systemStopLossPrice,
        targetPrice,
    ]);

    const rModeOptions = useMemo(
        () =>
            (['system_followed', 'fixed_stop', 'percent_stop'] as const).map((value) => ({
                value,
                label: t(`rMode.${value}.label` as MessageKey<'positionBudget'>),
                hint: t(`rMode.${value}.hint` as MessageKey<'positionBudget'>),
            })),
        [t],
    );

    const stopInputLabel = useMemo(() => {
        if (rMode === 'system_followed') return t('fieldSystemStop');
        if (rMode === 'fixed_stop') return t('fieldFixedStop');
        return '';
    }, [rMode, t]);

    const runPrefill = useCallback(
        async (target: SelectedStock) => {
            if (!target.symbol) return;
            prefillAbortRef.current?.abort();
            const controller = new AbortController();
            prefillAbortRef.current = controller;
            const requestSeq = prefillSeqRef.current + 1;
            prefillSeqRef.current = requestSeq;
            setLoadingPrefill(true);
            setBanner(null);
            try {
                const qs = new URLSearchParams({
                    symbols: target.symbol,
                    historyLimit: '1',
                    contentLocale: stockLocale,
                });
                const response = await fetch(`/api/stock/batch?${qs.toString()}`, {
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => ({}));
                if (requestSeq !== prefillSeqRef.current) return;
                if (!response.ok) {
                    setBanner({
                        tone: 'error',
                        text: data?.error || t('errLoadStockProfile'),
                    });
                    return;
                }

                const stock = data?.stocks?.[0];
                const prediction = stock?.prediction || stock?.history?.[0] || null;
                const tactical = parseTacticalData(prediction?.ai_reasoning);
                const emptyTactic = tactical?.tactics?.empty?.[0];
                const keyLevels = tactical?.key_levels;
                const closePrice = toNumber(stock?.price?.close);

                const entryCandidate =
                    parseMaybePrice(emptyTactic?.buy_zone_price) || closePrice;
                const stopCandidate =
                    parseMaybePrice(keyLevels?.stop_loss_reference) ||
                    parseMaybePrice(emptyTactic?.stop_loss_price);
                const targetCandidate =
                    parseMaybePrice(emptyTactic?.target_price) ||
                    parseMaybePrice(keyLevels?.strong_resistance);

                if (entryCandidate !== null) setEntryPrice(String(entryCandidate));
                if (stopCandidate !== null) {
                    setSystemStopLossPrice(String(stopCandidate));
                    setFixedStopLossPrice(String(stopCandidate));
                }
                if (targetCandidate !== null) setTargetPrice(String(targetCandidate));

                setSelected((prev) => ({
                    ...(prev || target),
                    symbol: target.symbol,
                    name: stock?.name ?? prev?.name ?? target.name,
                    name_en: stock?.name_en ?? prev?.name_en ?? target.name_en ?? null,
                    market: stock?.market ?? prev?.market ?? target.market,
                    lastClose: closePrice,
                }));

                if (entryCandidate === null && stopCandidate === null && targetCandidate === null) {
                    setBanner({
                        tone: 'info',
                        text: t('infoNoTactical'),
                    });
                } else {
                    setBanner({ tone: 'success', text: t('successPrefilled') });
                }
            } catch (error) {
                if ((error as Error).name === 'AbortError') return;
                console.error('Prefill failed:', error);
                setBanner({ tone: 'error', text: t('errPrefill') });
            } finally {
                if (requestSeq === prefillSeqRef.current) {
                    setLoadingPrefill(false);
                }
            }
        },
        [stockLocale, t],
    );

    const handlePickStock = useCallback(
        (hit: { symbol: string; name?: string; name_en?: string | null; market?: string }) => {
            const normalized = hit.symbol.trim().toUpperCase();
            const next: SelectedStock = {
                symbol: normalized,
                name: hit.name,
                name_en: hit.name_en ?? undefined,
                market: hit.market,
            };
            setSelected(next);
            resetSearch();
            void runPrefill(next);
        },
        [runPrefill, resetSearch],
    );

    const handleManualEntry = useCallback(() => {
        const normalized = query.trim().toUpperCase();
        if (!normalized) return;
        handlePickStock({ symbol: normalized });
    }, [query, handlePickStock]);

    const selectedDisplayName = useMemo(() => {
        if (!selected) return '';
        if (stockLocale === 'en') {
            return selected.name_en?.trim() || selected.name?.trim() || selected.symbol;
        }
        return selected.name?.trim() || selected.name_en?.trim() || selected.symbol;
    }, [selected, stockLocale]);

    const loadSnapshotAsCurrent = useCallback(
        (snapshot: PositionBudgetSnapshot) => {
            setSelected({ symbol: snapshot.symbol });
            void fetchPositionBudgetStockIdentity(snapshot.symbol).then((identity) => {
                if (!identity) return;
                setSelected((current) => {
                    if (!current || current.symbol !== snapshot.symbol) return current;
                    return {
                        ...current,
                        name: identity.name,
                        name_en: identity.name_en,
                        market: identity.market,
                    };
                });
            });
            setAccountSize(String(snapshot.account_size));
            setRiskRatioPercent(String((snapshot.risk_ratio * 100).toFixed(2)));
            setEntryPrice(String(snapshot.entry_price));
            setTargetPrice(snapshot.target_price == null ? '' : String(snapshot.target_price));
            setSystemStopLossPrice(String(snapshot.stop_loss_price));
            setFixedStopLossPrice(String(snapshot.stop_loss_price));
            setRMode(snapshot.r_mode);
            if (snapshot.r_mode === 'percent_stop' && snapshot.entry_price > 0) {
                const derivedStopPercent =
                    ((snapshot.entry_price - snapshot.stop_loss_price) / snapshot.entry_price) * 100;
                if (Number.isFinite(derivedStopPercent)) {
                    setStopPercent(String(Number(derivedStopPercent.toFixed(2))));
                }
            }
            resetSearch();
            setBanner({ tone: 'info', text: t('snapshotLoaded') });
        },
        [resetSearch, t],
    );

    async function saveAll(): Promise<void> {
        if (!selected) {
            setBanner({ tone: 'error', text: t('errSelectStock') });
            return;
        }
        if (!budget.ok || budget.resolvedStopLossPrice === null) {
            setBanner({ tone: 'error', text: t('errInvalidParams') });
            return;
        }
        setSaving(true);
        setBanner(null);
        try {
            const prefResp = await savePositionBudgetPreferences({
                default_account_size: accountSize === '' ? null : Number(accountSize),
                default_risk_ratio: Number(riskRatioPercent) / 100,
                default_r_mode: rMode,
            });
            if (!prefResp.ok) {
                setBanner({ tone: 'error', text: prefResp.error || t('errSavePref') });
                return;
            }

            const snapshotResp = await savePositionBudgetSnapshot({
                symbol: selected.symbol,
                entry_price: Number(entryPrice),
                stop_loss_price: budget.resolvedStopLossPrice,
                target_price: targetPrice === '' ? null : Number(targetPrice),
                account_size: Number(accountSize),
                risk_ratio: Number(riskRatioPercent) / 100,
                risk_amount: budget.riskAmount,
                position_size: budget.positionSize,
                expected_loss: budget.expectedLoss,
                stop_percent: Number(stopPercent) / 100,
                r_mode: rMode,
            });
            if (!snapshotResp.ok) {
                setBanner({ tone: 'error', text: snapshotResp.error || t('errSaveSnapshot') });
                return;
            }
            void refreshSnapshots();
            setBanner({ tone: 'success', text: t('successSaved') });
        } catch (error) {
            console.error('Save failed:', error);
            setBanner({ tone: 'error', text: t('errSaveGeneric') });
        } finally {
            setSaving(false);
        }
    }

    const watchlistChips = useMemo(() => watchlist.slice(0, 8), [watchlist]);
    const selectedBadge = selected ? getMarketBadge(selected.market, 'compact', locale) : null;
    const stopInputValue = rMode === 'system_followed' ? systemStopLossPrice : fixedStopLossPrice;
    const canSave = bootstrapped && !!selected && budget.ok && !saving;

    return (
        <div className="min-h-[100dvh] bg-[#050508] text-white font-sans">
            <div className="fixed inset-0 opacity-[0.04] pointer-events-none bg-indigo-500 blur-[140px] scale-150" />

            {/* Header */}
            <header className="sticky top-0 z-30 bg-[#050508]/95 backdrop-blur-sm border-b border-white/5">
                <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
                    <Link
                        href="/"
                        className="p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-slate-400"
                        aria-label={tg('common.back')}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[18px] bg-white/5 border border-white/10 flex items-center justify-center">
                            <Calculator className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div className="text-center">
                            <h1 className="text-xl font-black italic tracking-tighter text-white uppercase">
                                {t('titleLine')}{' '}
                                <span className="text-indigo-500 underline decoration-2 underline-offset-4">
                                    {t('titleWordmark')}
                                </span>
                            </h1>
                            <p className="text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase mt-1 flex items-center justify-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-indigo-500" />
                                {t('subtitle')}
                            </p>
                        </div>
                    </div>
                    <div
                        className="flex rounded-full border border-white/10 overflow-hidden text-[10px] font-black uppercase shrink-0"
                        role="group"
                        aria-label={tg('user.language.title')}
                    >
                        <button
                            type="button"
                            onClick={() => setLocale('cn')}
                            className={`px-2.5 py-1.5 transition-colors ${locale === 'cn' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {tg('user.language.cn')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setLocale('en')}
                            className={`px-2.5 py-1.5 transition-colors ${locale === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {tg('user.language.en')}
                        </button>
                    </div>
                </div>
            </header>

            <main className="relative mx-auto max-w-4xl px-6 py-8 space-y-6 pb-32">
                {/* Banner */}
                {banner ? (
                    <div
                        className={`glass-card !py-3 !px-4 flex items-start gap-3 border ${
                            banner.tone === 'success'
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : banner.tone === 'error'
                                  ? 'border-rose-500/30 bg-rose-500/5'
                                  : 'border-indigo-500/30 bg-indigo-500/5'
                        }`}
                    >
                        {banner.tone === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        ) : banner.tone === 'error' ? (
                            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                        ) : (
                            <Wand2 className="w-4 h-4 text-indigo-300 mt-0.5 shrink-0" />
                        )}
                        <p className="text-xs font-medium text-slate-200 leading-relaxed">
                            {banner.text}
                        </p>
                    </div>
                ) : null}

                {/* Stock picker section */}
                <section className="glass-card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {t('stepSelect')}
                        </h2>
                        {selected ? (
                            <button
                                onClick={() => {
                                    setSelected(null);
                                    setEntryPrice('');
                                    setTargetPrice('');
                                    setSystemStopLossPrice('');
                                    setFixedStopLossPrice('');
                                }}
                                className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1"
                            >
                                <X className="w-3 h-3" />
                                {t('clear')}
                            </button>
                        ) : null}
                    </div>

                    {selected ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                    className={`w-12 h-12 rounded-[18px] flex items-center justify-center text-[11px] font-black border ${selectedBadge?.className}`}
                                >
                                    {selectedBadge?.label}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-base font-black italic tracking-tighter text-white truncate">
                                        {selectedDisplayName}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mono uppercase tracking-widest mt-0.5">
                                        {selected.symbol}
                                        {selectedBadge?.suffix}
                                        {selected.lastClose ? (
                                            <span className="ml-2 text-slate-400">
                                                · {t('selectedClose')}{' '}
                                                {fmt(selected.lastClose, 2, locale)}
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => void runPrefill(selected)}
                                disabled={loadingPrefill}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {loadingPrefill ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                ) : (
                                    <RefreshCcw className="w-3.5 h-3.5 text-indigo-400" />
                                )}
                                {t('rePrefill')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <StockSymbolSearchField
                                query={query}
                                onQueryChange={setQuery}
                                searchResults={searchResults}
                                showSuggestions={showSuggestions}
                                onShowSuggestionsChange={setShowSuggestions}
                                searching={searching}
                                runSearchNow={runSearchNow}
                                locale={locale}
                                stockLocale={stockLocale}
                                onSelect={handlePickStock}
                                placeholder={t('searchPlaceholder')}
                                noResultsText={t('searchNoResults')}
                                continueAsCodeText={t('searchContinueAsCode', {
                                    code: query.trim().toUpperCase(),
                                })}
                                onContinueAsCode={handleManualEntry}
                            />

                            {watchlistLoading ? null : watchlistChips.length > 0 ? (
                                <div className="mt-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-2">
                                        {t('watchlistHeading')}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {watchlistChips.map((item) => {
                                            const badge = getMarketBadge(
                                                undefined,
                                                'compact',
                                                locale,
                                            );
                                            return (
                                                <button
                                                    key={item.symbol}
                                                    onClick={() =>
                                                        handlePickStock({
                                                            symbol: item.symbol,
                                                            name: item.name,
                                                            name_en: item.name_en,
                                                        })
                                                    }
                                                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-xs"
                                                >
                                                    <span className="text-white font-bold truncate max-w-[120px]">
                                                        {getLocalizedStockName(
                                                            item,
                                                            stockLocale,
                                                        )}
                                                    </span>
                                                    <span
                                                        className={`mono text-[10px] uppercase tracking-widest text-slate-500`}
                                                    >
                                                        {item.symbol}
                                                        {badge.suffix}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-4 text-[10px] font-medium text-slate-600 leading-relaxed">
                                    {t('watchlistEmpty')}
                                </p>
                            )}
                        </>
                    )}
                </section>

                {/* Parameters section */}
                <section className="glass-card">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
                        {t('stepRisk')}
                    </h2>

                    <div className="grid gap-4 md:grid-cols-2">
                        <FieldNumber
                            label={t('fieldAccountSize')}
                            value={accountSize}
                            onChange={setAccountSize}
                            placeholder="100000"
                            hint={t('fieldAccountSizeHint')}
                        />
                        <FieldNumber
                            label={t('fieldRiskPct')}
                            value={riskRatioPercent}
                            onChange={setRiskRatioPercent}
                            placeholder="1"
                            hint={t('fieldRiskPctHint')}
                        />
                        <FieldNumber
                            label={t('fieldEntry')}
                            value={entryPrice}
                            onChange={setEntryPrice}
                            placeholder="0.00"
                            hint={t('fieldEntryHint')}
                        />
                        <FieldNumber
                            label={t('fieldTarget')}
                            value={targetPrice}
                            onChange={setTargetPrice}
                            placeholder="0.00"
                            hint={t('fieldTargetHint')}
                        />
                    </div>

                    {/* R mode segmented control */}
                    <div className="mt-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                            {t('stopModeHeading')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {rModeOptions.map((opt) => {
                                const active = rMode === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setRMode(opt.value)}
                                        className={`flex-1 min-w-[120px] px-4 py-3 rounded-2xl border transition-all active:scale-95 text-left ${
                                            active
                                                ? 'bg-indigo-500/15 border-indigo-500/40'
                                                : 'bg-white/5 border-white/5 hover:bg-white/10'
                                        }`}
                                    >
                                        <p
                                            className={`text-xs font-black uppercase tracking-widest ${active ? 'text-indigo-300' : 'text-slate-300'}`}
                                        >
                                            {opt.label}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-1 font-medium leading-tight">
                                            {opt.hint}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-4">
                            {rMode === 'percent_stop' ? (
                                <FieldNumber
                                    label={t('fieldStopPct')}
                                    value={stopPercent}
                                    onChange={setStopPercent}
                                    placeholder="5"
                                />
                            ) : (
                                <FieldNumber
                                    label={stopInputLabel}
                                    value={stopInputValue}
                                    onChange={(v) =>
                                        rMode === 'system_followed'
                                            ? setSystemStopLossPrice(v)
                                            : setFixedStopLossPrice(v)
                                    }
                                    placeholder="0.00"
                                />
                            )}
                        </div>
                    </div>
                </section>

                {/* Result section */}
                <section className="glass-card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {t('stepResult')}
                        </h2>
                        <div
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                                budget.ok
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                            }`}
                        >
                            <span
                                className={`w-1 h-1 rounded-full ${budget.ok ? 'bg-emerald-400' : 'bg-rose-400'}`}
                            />
                            {budget.ok ? t('statusOk') : t('statusIncomplete')}
                        </div>
                    </div>

                    {loadingPref ? (
                        <p className="text-xs text-slate-500 font-medium">{t('loadingPreferences')}</p>
                    ) : null}

                    {budget.errors.length > 0 ? (
                        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="w-4 h-4 text-rose-400" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">
                                    {t('paramsIncomplete')}
                                </p>
                            </div>
                            <ul className="space-y-1 pl-1 text-sm text-rose-200">
                                {budget.errors.map((error) => (
                                    <li key={error} className="leading-relaxed">
                                        ·{' '}
                                        {BUDGET_ERROR_KEYS[error]
                                            ? t(BUDGET_ERROR_KEYS[error])
                                            : error}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            <ResultCell
                                icon={<Target className="w-3.5 h-3.5" />}
                                label={t('resultRisk1R')}
                                value={fmt(budget.riskAmount, 2, locale)}
                                tone="primary"
                            />
                            <ResultCell
                                label={t('resultRiskPerShare')}
                                value={fmt(budget.riskPerShare, 4, locale)}
                            />
                            <ResultCell
                                label={t('resultShares')}
                                value={fmt(budget.positionSize, 0, locale)}
                                tone="primary"
                            />
                            <ResultCell
                                label={t('resultExpectedLoss')}
                                value={fmt(budget.expectedLoss, 2, locale)}
                                tone="warning"
                            />
                            <ResultCell
                                label={t('resultStop')}
                                value={fmt(budget.resolvedStopLossPrice, 4, locale)}
                            />
                            <ResultCell
                                label={t('resultRMultiple')}
                                value={
                                    budget.rMultiple === null
                                        ? '—'
                                        : `${fmt(budget.rMultiple, 2, locale)}R`
                                }
                            />
                        </div>
                    )}

                    {budget.warnings.length > 0 ? (
                        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                                    {t('noticeHeading')}
                                </p>
                            </div>
                            <ul className="space-y-1 text-sm text-amber-100">
                                {budget.warnings.map((warning) => (
                                    <li key={warning} className="leading-relaxed">
                                        ·{' '}
                                        {BUDGET_WARNING_KEYS[warning]
                                            ? t(BUDGET_WARNING_KEYS[warning])
                                            : warning}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    <p className="mt-5 text-[10px] text-slate-600 leading-relaxed">
                        {t('disclaimer')}
                    </p>
                </section>

                {/* Recent snapshots section */}
                <section className="glass-card">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                {t('recentHeading')}
                            </h2>
                            <p className="mt-1 text-[10px] text-slate-600 font-medium">
                                {t('recentHint')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void refreshSnapshots()}
                            disabled={loadingSnapshots}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <RefreshCcw
                                className={`w-3.5 h-3.5 text-indigo-400 ${loadingSnapshots ? 'animate-spin' : ''}`}
                            />
                            {t('recentRefresh')}
                        </button>
                    </div>

                    {loadingSnapshots && snapshots.length === 0 ? (
                        <p className="text-xs text-slate-500 font-medium">
                            {t('recentLoading')}
                        </p>
                    ) : snapshots.length === 0 ? (
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                            {t('recentEmpty')}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {snapshots.map((snapshot) => {
                                const multiple = snapshotRMultiple(snapshot);
                                return (
                                    <button
                                        key={snapshot.snapshot_id}
                                        type="button"
                                        onClick={() => loadSnapshotAsCurrent(snapshot)}
                                        className="w-full text-left rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] active:scale-[0.99] transition-all p-4"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-black italic tracking-tighter text-white">
                                                    {snapshot.symbol}
                                                </p>
                                                <p className="mt-1 text-[10px] text-slate-500 mono uppercase tracking-widest">
                                                    {fmtDate(snapshot.created_at, locale)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-indigo-300 mono">
                                                    {fmt(snapshot.position_size, 0, locale)}
                                                </p>
                                                <p className="mt-1 text-[10px] text-slate-500 uppercase tracking-widest">
                                                    {t('resultShares')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                                            <SnapshotMetric
                                                label={t('fieldEntry')}
                                                value={fmt(snapshot.entry_price, 4, locale)}
                                            />
                                            <SnapshotMetric
                                                label={t('resultStop')}
                                                value={fmt(snapshot.stop_loss_price, 4, locale)}
                                            />
                                            <SnapshotMetric
                                                label={t('resultExpectedLoss')}
                                                value={fmt(snapshot.expected_loss, 2, locale)}
                                            />
                                            <SnapshotMetric
                                                label={t('resultRMultiple')}
                                                value={multiple == null ? '—' : `${fmt(multiple, 2, locale)}R`}
                                            />
                                        </div>
                                        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                            {t('loadSnapshot')}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>

            {/* Sticky action bar */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#050508]/95 backdrop-blur-sm border-t border-white/5">
                <div className="mx-auto max-w-4xl px-6 py-4 flex items-center gap-3">
                    <button
                        onClick={() => void saveAll()}
                        disabled={!canSave}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_10px_25px_rgba(99,102,241,0.25)]"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4" />
                        )}
                        {saving ? t('saveBusy') : t('saveCta')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function FieldNumber({
    label,
    value,
    onChange,
    placeholder,
    hint,
}: {
    label: string;
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    hint?: string;
}) {
    return (
        <label className="block">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">
                {label}
            </p>
            <input
                inputMode="decimal"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 mono text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-colors placeholder:text-slate-600"
            />
            {hint ? (
                <p className="mt-1.5 text-[10px] text-slate-600 font-medium leading-relaxed">
                    {hint}
                </p>
            ) : null}
        </label>
    );
}

function ResultCell({
    label,
    value,
    icon,
    tone,
}: {
    label: string;
    value: string;
    icon?: React.ReactNode;
    tone?: 'primary' | 'warning';
}) {
    const accent =
        tone === 'primary'
            ? 'text-indigo-300'
            : tone === 'warning'
              ? 'text-amber-300'
              : 'text-white';
    return (
        <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                {icon}
                {label}
            </p>
            <p className={`mt-2 text-2xl font-black mono tracking-tighter ${accent}`}>{value}</p>
        </div>
    );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2">
            <p className="text-slate-600 font-black uppercase tracking-widest truncate">
                {label}
            </p>
            <p className="mt-1 mono text-slate-200 font-bold truncate">{value}</p>
        </div>
    );
}
