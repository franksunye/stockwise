'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    ArrowLeft,
    Calculator,
    CheckCircle2,
    ChevronDown,
    Loader2,
    RefreshCcw,
    Wand2,
    X,
} from 'lucide-react';

import {
    buildPositionBudgetVerdict,
    computePositionBudget,
    type PositionBudgetRMode,
    type PositionBudgetVerdictStatus,
} from '@/lib/position-budget';
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
    fetchPositionBudgetPriceHistory,
    fetchPositionBudgetSnapshots,
    fetchPositionBudgetStockIdentity,
    savePositionBudgetPreferences,
    savePositionBudgetSnapshot,
    type PositionBudgetPricePoint,
    type PositionBudgetSetupType,
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

const SETUP_TYPE_OPTIONS: PositionBudgetSetupType[] = [
    'breakout',
    'pullback',
    'trend_continuation',
    'reversal',
    'earnings',
    'swing',
    'scalping',
    'other',
];

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

function fmtRelativeTime(value: string | null | undefined, appLocale: AppLocale): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fmtDate(value, appLocale);
    const diffMs = Date.now() - date.getTime();
    const absMs = Math.abs(diffMs);
    const rtf = new Intl.RelativeTimeFormat(appLocale === 'en' ? 'en-US' : 'zh-CN', {
        numeric: 'auto',
        style: 'short',
    });
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
        ['year', 1000 * 60 * 60 * 24 * 365],
        ['month', 1000 * 60 * 60 * 24 * 30],
        ['day', 1000 * 60 * 60 * 24],
        ['hour', 1000 * 60 * 60],
        ['minute', 1000 * 60],
    ];
    for (const [unit, unitMs] of units) {
        if (absMs >= unitMs) {
            return rtf.format(Math.round(-diffMs / unitMs), unit);
        }
    }
    return rtf.format(0, 'minute');
}

function snapshotRMultiple(snapshot: PositionBudgetSnapshot): number | null {
    if (snapshot.target_price == null || snapshot.risk_per_share <= 0) return null;
    const multiple = (snapshot.target_price - snapshot.entry_price) / snapshot.risk_per_share;
    return Number.isFinite(multiple) ? multiple : null;
}

function snapshotPositionValue(snapshot: PositionBudgetSnapshot): number {
    return snapshot.position_size * snapshot.entry_price;
}

function snapshotExposurePercent(snapshot: PositionBudgetSnapshot): number {
    if (snapshot.account_size <= 0) return 0;
    return (snapshotPositionValue(snapshot) / snapshot.account_size) * 100;
}

function snapshotStatusTone(snapshot: PositionBudgetSnapshot): 'valid' | 'warning' | 'invalid' {
    const exposure = snapshotExposurePercent(snapshot);
    const multiple = snapshotRMultiple(snapshot);
    if (exposure > 100 || snapshot.position_size <= 0) return 'invalid';
    if (exposure > 30 || (multiple !== null && multiple < 2) || snapshot.risk_ratio > 0.02) {
        return 'warning';
    }
    return 'valid';
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
const POSITION_BUDGET_HOME_URL = 'https://ziso.cc';

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
    const [priceHistory, setPriceHistory] = useState<PositionBudgetPricePoint[]>([]);
    const [loadingPriceHistory, setLoadingPriceHistory] = useState(false);

    const [selected, setSelected] = useState<SelectedStock | null>(null);

    const [entryPrice, setEntryPrice] = useState('');
    const [targetPrice, setTargetPrice] = useState('');
    const [systemStopLossPrice, setSystemStopLossPrice] = useState('');
    const [fixedStopLossPrice, setFixedStopLossPrice] = useState('');
    const [accountSize, setAccountSize] = useState('');
    const [riskRatioPercent, setRiskRatioPercent] = useState('1');
    const [stopPercent, setStopPercent] = useState('5');
    const [setupType, setSetupType] = useState<PositionBudgetSetupType | ''>('');
    const [rMode, setRMode] = useState<PositionBudgetRMode>('system_followed');
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const prefillAbortRef = useRef<AbortController | null>(null);
    const prefillSeqRef = useRef(0);
    const priceHistorySeqRef = useRef(0);

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

    useEffect(() => {
        const symbol = selected?.symbol;
        if (!symbol) {
            setPriceHistory([]);
            setLoadingPriceHistory(false);
            return;
        }
        const requestSeq = priceHistorySeqRef.current + 1;
        priceHistorySeqRef.current = requestSeq;
        setLoadingPriceHistory(true);
        void fetchPositionBudgetPriceHistory(symbol, 30)
            .then((rows) => {
                if (requestSeq !== priceHistorySeqRef.current) return;
                setPriceHistory(rows);
            })
            .catch((error) => {
                if (requestSeq !== priceHistorySeqRef.current) return;
                console.warn('Price history fetch failed:', error);
                setPriceHistory([]);
            })
            .finally(() => {
                if (requestSeq === priceHistorySeqRef.current) {
                    setLoadingPriceHistory(false);
                }
            });
    }, [selected?.symbol]);

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
                shortLabel: t(`rMode.${value}.shortLabel` as MessageKey<'positionBudget'>),
                hint: t(`rMode.${value}.hint` as MessageKey<'positionBudget'>),
            })),
        [t],
    );
    const activeRModeOption = rModeOptions.find((option) => option.value === rMode) ?? rModeOptions[0];
    const activeRModeHint = activeRModeOption?.hint ?? '';

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
            setSetupType(snapshot.setup_type ?? '');
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
                setup_type: setupType || null,
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
    const verdict = useMemo(() => buildPositionBudgetVerdict(budget), [budget]);
    const stickyRMultiple = budget.rMultiple === null ? '—' : `${fmt(budget.rMultiple, 2, locale)}R`;
    const snapshotStopModeLabels = useMemo(
        () => ({
            system_followed: t('rMode.system_followed.shortLabel' as MessageKey<'positionBudget'>),
            fixed_stop: t('rMode.fixed_stop.shortLabel' as MessageKey<'positionBudget'>),
            percent_stop: t('rMode.percent_stop.shortLabel' as MessageKey<'positionBudget'>),
        }),
        [t],
    );
    const setupTypeLabels = useMemo(
        () =>
            SETUP_TYPE_OPTIONS.reduce(
                (acc, value) => {
                    acc[value] = t(`setupTypes.${value}` as MessageKey<'positionBudget'>);
                    return acc;
                },
                {} as Record<PositionBudgetSetupType, string>,
            ),
        [t],
    );
    const setupTypeLabelsShort = useMemo(
        () =>
            SETUP_TYPE_OPTIONS.reduce(
                (acc, value) => {
                    acc[value] = t(`setupTypesShort.${value}` as MessageKey<'positionBudget'>);
                    return acc;
                },
                {} as Record<PositionBudgetSetupType, string>,
            ),
        [t],
    );
    const advancedCollapsedSummary = useMemo(() => {
        const parts: string[] = [];
        if (setupType) {
            parts.push(setupTypeLabelsShort[setupType]);
        }
        const targetNum = Number(targetPrice);
        if (targetPrice.trim() !== '' && Number.isFinite(targetNum) && targetNum > 0) {
            parts.push(t('advancedSummaryTarget'));
        }
        return parts.join(' · ');
    }, [setupType, setupTypeLabelsShort, targetPrice, t]);

    return (
        <div className="min-h-[100dvh] bg-[#050508] text-white font-sans">
            <div className="fixed inset-0 opacity-[0.04] pointer-events-none bg-indigo-500 blur-[140px] scale-150" />

            {/* Header */}
            <header className="sticky top-0 z-30 bg-[#050508]/95 backdrop-blur-sm border-b border-white/5">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-5">
                    <div className="flex items-center justify-between sm:hidden">
                        <Link
                            href={POSITION_BUDGET_HOME_URL}
                            className="p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-slate-400"
                            aria-label={tg('common.back')}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
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
                                中
                            </button>
                            <button
                                type="button"
                                onClick={() => setLocale('en')}
                                className={`px-2.5 py-1.5 transition-colors ${locale === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                EN
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 sm:mt-0 flex items-center justify-center sm:justify-between gap-3">
                        <Link
                            href={POSITION_BUDGET_HOME_URL}
                            className="hidden sm:inline-flex p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-slate-400"
                            aria-label={tg('common.back')}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[14px] sm:rounded-[18px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-xl font-black italic tracking-tighter text-white uppercase leading-tight text-left">
                                    {t('titleLine')}{' '}
                                    <span className="text-indigo-500 underline decoration-2 underline-offset-4">
                                        {t('titleWordmark')}
                                    </span>
                                </h1>
                                <p className="text-[10px] text-slate-500 font-bold tracking-[0.16em] uppercase mt-1 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="w-1 h-1 rounded-full bg-indigo-500" />
                                    {t('subtitle')}
                                </p>
                            </div>
                        </div>
                        <div
                            className="hidden sm:flex rounded-full border border-white/10 overflow-hidden text-[10px] font-black uppercase shrink-0"
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
                </div>
            </header>

            <main className="relative mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-52 sm:pb-56">
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

                {/* Market Context */}
                <section className="glass-card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {t('marketContext')}
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
                                    <p className="text-lg sm:text-xl font-black italic tracking-tighter text-white truncate">
                                        {selected.symbol}
                                        <span className="ml-2 text-xs not-italic tracking-normal text-slate-500">
                                            {selectedDisplayName === selected.symbol ? '' : selectedDisplayName}
                                        </span>
                                    </p>
                                    <p className="text-[10px] text-slate-500 mono uppercase tracking-widest mt-0.5 flex flex-wrap items-center gap-2">
                                        <span>{selectedBadge?.suffix || selected.market || t('marketFallback')}</span>
                                        {selected.lastClose ? (
                                            <span className="text-slate-400">
                                                {t('selectedClose')}{' '}
                                                {fmt(selected.lastClose, 2, locale)}
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                            </div>
                            <MiniTrendSparkline
                                loading={loadingPrefill || loadingPriceHistory}
                                points={priceHistory}
                            />
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

                <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)] lg:items-start">
                {/* Parameters section */}
                <section className="glass-card !p-4 sm:!p-5 lg:sticky lg:top-28">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {t('riskModelInputs')}
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        <FieldNumber
                            label={t('fieldAccountSize')}
                            value={accountSize}
                            onChange={setAccountSize}
                            placeholder="100000"
                        />
                        <FieldNumber
                            label={t('fieldRiskPct')}
                            value={riskRatioPercent}
                            onChange={setRiskRatioPercent}
                            placeholder="1"
                        />
                        <FieldNumber
                            label={t('fieldEntry')}
                            value={entryPrice}
                            onChange={setEntryPrice}
                            placeholder="0.00"
                        />
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

                    {/* Stop style selector */}
                    <div className="mt-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                            {t('stopModeHeading')}
                        </p>
                        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/5 bg-black/20 p-1 sm:hidden">
                            {rModeOptions.map((opt) => {
                                const active = rMode === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setRMode(opt.value)}
                                        title={opt.hint}
                                        className={`min-w-0 px-2 py-2 rounded-xl border transition-all active:scale-95 text-center ${
                                            active
                                                ? 'bg-indigo-500/15 border-indigo-500/40 shadow-[0_0_18px_rgba(99,102,241,0.12)]'
                                                : 'bg-transparent border-transparent hover:bg-white/5'
                                        }`}
                                    >
                                        <p
                                            className={`truncate text-[10px] font-black uppercase tracking-widest ${active ? 'text-indigo-300' : 'text-slate-400'}`}
                                        >
                                            {opt.shortLabel}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500 sm:hidden">
                            {activeRModeHint}
                        </p>

                        <div className="hidden sm:grid sm:grid-cols-3 gap-2.5">
                            {rModeOptions.map((opt) => {
                                const active = rMode === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setRMode(opt.value)}
                                        className={`min-w-0 rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                                            active
                                                ? 'bg-indigo-500/15 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.14)]'
                                                : 'bg-black/20 border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                                        }`}
                                    >
                                        <span
                                            className={`block text-xs font-black uppercase tracking-widest ${active ? 'text-indigo-300' : 'text-slate-300'}`}
                                        >
                                            {opt.label}
                                        </span>
                                        <span className="mt-1.5 block text-[10px] font-medium leading-relaxed text-slate-500">
                                            {opt.hint}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-3 rounded-2xl border border-white/5 bg-black/20">
                            <button
                                type="button"
                                onClick={() => setAdvancedOpen((next) => !next)}
                                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050508] rounded-2xl"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                        {t('advancedHeading')}
                                    </span>
                                    <span className="mt-0.5 hidden sm:block text-[10px] text-slate-600">
                                        {t('advancedHint')}
                                    </span>
                                    {!advancedOpen && advancedCollapsedSummary ? (
                                        <span className="mt-1 block truncate text-[10px] font-bold text-slate-400 sm:hidden">
                                            {advancedCollapsedSummary}
                                        </span>
                                    ) : null}
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                    {!advancedOpen && advancedCollapsedSummary ? (
                                        <span className="hidden sm:inline truncate max-w-[200px] text-[10px] font-bold uppercase tracking-wide text-indigo-300/90">
                                            {advancedCollapsedSummary}
                                        </span>
                                    ) : null}
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                                        {advancedOpen ? t('collapse') : t('expand')}
                                    </span>
                                </span>
                            </button>
                            {advancedOpen ? (
                                <div className="space-y-3 border-t border-white/5 p-3">
                                    <label className="block">
                                        <p className="mb-1 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 truncate">
                                            {t('fieldSetupType')}
                                        </p>
                                        <div className="relative">
                                            <select
                                                value={setupType}
                                                onChange={(event) =>
                                                    setSetupType(event.target.value as PositionBudgetSetupType | '')
                                                }
                                                className="w-full appearance-none bg-black/40 border border-white/5 rounded-xl py-2.5 pl-3 pr-10 text-sm font-bold text-white focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 focus-visible:ring-2 focus-visible:ring-indigo-500/40 transition-colors cursor-pointer"
                                            >
                                                <option value="">{t('setupTypePlaceholder')}</option>
                                                {SETUP_TYPE_OPTIONS.map((value) => (
                                                    <option key={value} value={value}>
                                                        {setupTypeLabels[value]}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown
                                                aria-hidden
                                                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                                            />
                                        </div>
                                    </label>
                                    <FieldNumber
                                        label={t('fieldTarget')}
                                        value={targetPrice}
                                        onChange={setTargetPrice}
                                        placeholder="0.00"
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>

                {/* Result section */}
                <section className="glass-card border-indigo-500/20 bg-indigo-500/[0.03]">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {t('liveResult')}
                        </h2>
                        <div
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${verdictPillClass(verdict.status)}`}
                        >
                            <span className="w-1 h-1 rounded-full bg-current" />
                            {t(`verdictStatus.${verdict.status}` as MessageKey<'positionBudget'>)}
                        </div>
                    </div>

                    {loadingPref ? (
                        <p className="text-xs text-slate-500 font-medium">{t('loadingPreferences')}</p>
                    ) : null}

                    <div className="rounded-[28px] border border-white/10 bg-black/30 p-5 sm:p-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {t('resultPositionSize')}
                        </p>
                        <div className="mt-2 flex items-end gap-2">
                            <p className="text-5xl sm:text-6xl font-black mono tracking-tighter text-white">
                                {fmt(budget.positionSize, 0, locale)}
                            </p>
                            <p className="pb-2 text-sm font-black uppercase tracking-widest text-slate-500">
                                {t('sharesUnit')}
                            </p>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <ResultCell
                                label={t('resultExpectedLoss')}
                                value={fmt(budget.expectedLoss, 2, locale)}
                                tone="risk"
                            />
                            <ResultCell
                                label={t('resultRiskPerShare')}
                                value={fmt(budget.riskPerShare, 2, locale)}
                                tone="primary"
                            />
                            <ResultCell
                                label={t('resultStop')}
                                value={fmt(budget.resolvedStopLossPrice, 2, locale)}
                            />
                            <ResultCell
                                label={t('resultRMultiple')}
                                value={stickyRMultiple}
                                tone="primary"
                            />
                        </div>
                    </div>

                    <div className={`mt-4 rounded-[24px] border p-4 ${verdictCardClass(verdict.status)}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
                                    {t('smartVerdict')}
                                </p>
                                <h3 className="mt-2 text-lg font-black tracking-tight">
                                    {t(`verdictTitle.${verdict.status}` as MessageKey<'positionBudget'>)}
                                </h3>
                                <p className="mt-1 text-xs font-medium opacity-80">
                                    {t(`verdictSummary.${verdict.status}` as MessageKey<'positionBudget'>)}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-black/20 px-3 py-2 mono text-sm font-black">
                                {verdict.grade}
                            </div>
                        </div>
                        <div className="mt-4 grid gap-2">
                            {verdict.checks.map((check) => (
                                <div
                                    key={check.key}
                                    className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 border border-white/5 px-3 py-2"
                                >
                                    <span className="text-xs font-bold">
                                        {t(`verdictChecks.${check.key}` as MessageKey<'positionBudget'>)}
                                    </span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${checkStatusClass(check.status)}`}>
                                        {t(`checkStatus.${check.status}` as MessageKey<'positionBudget'>)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {budget.errors.length > 0 ? (
                        <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">
                                {t('fieldAlerts')}
                            </p>
                            <p className="mt-1 text-xs text-rose-100 leading-relaxed">
                                {budget.errors
                                    .slice(0, 2)
                                    .map((error) => BUDGET_ERROR_KEYS[error] ? t(BUDGET_ERROR_KEYS[error]) : error)
                                    .join(' · ')}
                            </p>
                        </div>
                    ) : budget.warnings.length > 0 ? (
                        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                            <p className="text-xs text-amber-100 leading-relaxed">
                                {budget.warnings
                                    .map((warning) => BUDGET_WARNING_KEYS[warning] ? t(BUDGET_WARNING_KEYS[warning]) : warning)
                                    .join(' · ')}
                            </p>
                        </div>
                    ) : null}

                    <p className="mt-5 text-[10px] text-slate-600 leading-relaxed">
                        {t('disclaimer')}
                    </p>
                </section>
                </div>

                {/* Recent snapshots section */}
                <section className="glass-card">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                {t('recentSnapshots')}
                            </h2>
                            <p className="mt-1 text-[10px] text-slate-600 font-medium">
                                {t('recentSnapshotsHint')}
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
                        <div className="-mx-4 overflow-x-auto scroll-px-4 px-4 pb-2 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] sm:snap-none sm:mx-0 sm:scroll-px-0 sm:px-0">
                            <div className="flex gap-3 sm:grid sm:grid-cols-3">
                            {snapshots.map((snapshot) => {
                                const tone = snapshotStatusTone(snapshot);
                                const rMultiple = snapshotRMultiple(snapshot);
                                const rMultipleText = rMultiple === null ? '—' : `${fmt(rMultiple, 2, locale)}R`;
                                const setupHeading = snapshot.setup_type
                                    ? setupTypeLabelsShort[snapshot.setup_type] ?? snapshot.setup_type
                                    : t('snapshotPlanType');
                                const stopModeLabel =
                                    snapshotStopModeLabels[snapshot.r_mode] ?? snapshot.r_mode;
                                const snapshotAriaPieces = [
                                    t('loadSnapshot'),
                                    snapshot.symbol,
                                    `${t('snapshotStopType')} ${stopModeLabel}`,
                                    ...(snapshot.setup_type
                                        ? [setupTypeLabelsShort[snapshot.setup_type] ?? snapshot.setup_type]
                                        : []),
                                    `${fmt(snapshot.position_size, 0, locale)} ${t('sharesUnitCompact')}`,
                                    `${t('snapshotRisk')} ${fmt(snapshot.expected_loss, 2, locale)}`,
                                    `${t('snapshotCreated')} ${fmtRelativeTime(snapshot.created_at, locale)}`,
                                ];
                                return (
                                    <button
                                        key={snapshot.snapshot_id}
                                        type="button"
                                        onClick={() => loadSnapshotAsCurrent(snapshot)}
                                        className="min-w-[230px] sm:min-w-0 shrink-0 snap-start text-left rounded-[24px] border border-white/10 bg-white/[0.035] hover:bg-white/[0.07] active:scale-[0.99] transition-all p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050508]"
                                        title={t('loadSnapshot')}
                                        aria-label={snapshotAriaPieces.join('. ')}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                                    {setupHeading}
                                                </p>
                                                <p className="mt-1 truncate text-lg font-black italic tracking-tighter text-white">
                                                    {snapshot.symbol}
                                                </p>
                                            </div>
                                            <span className={`h-2 w-2 shrink-0 rounded-full ${snapshotDotClass(tone)}`} />
                                        </div>

                                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                                {t('snapshotStopType')}
                                            </span>
                                            <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-300">
                                                {stopModeLabel}
                                            </span>
                                        </div>

                                        <div className="mt-4 flex items-end justify-between gap-4">
                                            <div>
                                                <p className="mono text-3xl font-black tracking-tighter text-indigo-200 leading-none">
                                                    {rMultipleText}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="mono text-sm font-black text-white">
                                                    {fmt(snapshot.position_size, 0, locale)}
                                                </p>
                                                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    {t('sharesUnitCompact')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 border-t border-white/5 pt-3">
                                            <div className="flex items-center justify-between gap-3 text-[11px] font-bold">
                                                <span className="text-slate-500">{t('snapshotRisk')}</span>
                                                <span className="mono text-rose-200">
                                                    {fmt(snapshot.expected_loss, 2, locale)}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-bold">
                                                <span className="text-slate-500">{t('snapshotCreated')}</span>
                                                <span className="text-slate-300">
                                                    {fmtRelativeTime(snapshot.created_at, locale)}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                            </div>
                        </div>
                    )}
                </section>
            </main>

            {/* Sticky action bar */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#050508]/95 backdrop-blur-sm border-t border-white/5">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                            {t('stickyResult')}
                        </p>
                        <p className="mt-1 truncate text-xs sm:text-sm font-black mono text-white">
                            {fmt(budget.positionSize, 0, locale)} {t('sharesUnit')} ·{' '}
                            {fmt(budget.expectedLoss, 2, locale)} {t('maxLossShort')} · {stickyRMultiple}
                        </p>
                    </div>
                    <button
                        onClick={() => void saveAll()}
                        disabled={!canSave}
                        className="shrink-0 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_10px_25px_rgba(99,102,241,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050508]"
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
}: {
    label: string;
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="block">
            <p className="mb-1 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 truncate">
                {label}
            </p>
            <input
                inputMode="decimal"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 mono text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-colors placeholder:text-slate-600"
            />
        </label>
    );
}

function buildSparklinePath(points: PositionBudgetPricePoint[], width: number, height: number, padding: number): string {
    if (points.length < 2) return '';
    const closes = points.map((point) => point.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    return points
        .map((point, index) => {
            const x = padding + (index / (points.length - 1)) * (width - padding * 2);
            const y = padding + ((max - point.close) / range) * (height - padding * 2);
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ');
}

function MiniTrendSparkline({
    loading,
    points,
}: {
    loading: boolean;
    points: PositionBudgetPricePoint[];
}) {
    const width = 132;
    const height = 42;
    const padding = 4;
    const hasRealPoints = points.length >= 2;
    const realPath = buildSparklinePath(points, width, height, padding);
    const firstClose = hasRealPoints ? points[0].close : null;
    const lastClose = hasRealPoints ? points[points.length - 1].close : null;
    const positive = firstClose !== null && lastClose !== null ? lastClose >= firstClose : true;
    const gradientId = positive ? 'position-budget-sparkline-up' : 'position-budget-sparkline-down';
    const glowId = positive ? 'position-budget-sparkline-up-glow' : 'position-budget-sparkline-down-glow';
    const fallbackPath = 'M3 34 C 14 32, 18 27, 27 29 S 40 34, 50 27 S 61 16, 72 20 S 84 29, 95 21 S 111 8, 129 4';

    return (
        <div
            className={`flex h-12 w-28 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/[0.03] px-1.5 sm:w-36 ${loading ? 'animate-pulse' : ''}`}
            aria-hidden="true"
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full overflow-visible">
                <defs>
                    <linearGradient id="position-budget-sparkline-up" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="rgb(74 222 128)" stopOpacity="0.18" />
                        <stop offset="42%" stopColor="rgb(34 197 94)" stopOpacity="0.72" />
                        <stop offset="100%" stopColor="rgb(134 239 172)" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="position-budget-sparkline-down" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="rgb(248 113 113)" stopOpacity="0.2" />
                        <stop offset="48%" stopColor="rgb(239 68 68)" stopOpacity="0.76" />
                        <stop offset="100%" stopColor="rgb(251 113 133)" stopOpacity="1" />
                    </linearGradient>
                    <filter id="position-budget-sparkline-up-glow" x="-20%" y="-80%" width="140%" height="260%">
                        <feGaussianBlur stdDeviation="2.4" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="position-budget-sparkline-down-glow" x="-20%" y="-80%" width="140%" height="260%">
                        <feGaussianBlur stdDeviation="2.4" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <path
                    d={hasRealPoints ? realPath : fallbackPath}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={hasRealPoints ? 1 : 0.45}
                    strokeWidth={hasRealPoints ? 2.6 : 2.4}
                    filter={`url(#${glowId})`}
                />
                <path
                    d="M3 38 C 21 35, 42 36, 59 32 S 90 26, 129 17"
                    fill="none"
                    stroke={positive ? 'rgb(52 211 153)' : 'rgb(248 113 113)'}
                    strokeLinecap="round"
                    strokeOpacity={hasRealPoints ? 0.12 : 0.08}
                    strokeWidth="1.2"
                />
                {hasRealPoints && realPath ? (
                    <circle
                        cx={(
                            padding +
                            ((points.length - 1) / (points.length - 1)) * (width - padding * 2)
                        ).toFixed(2)}
                        cy={(() => {
                            const closes = points.map((point) => point.close);
                            const min = Math.min(...closes);
                            const max = Math.max(...closes);
                            const range = max - min || 1;
                            return (
                                padding +
                                ((max - points[points.length - 1].close) / range) * (height - padding * 2)
                            ).toFixed(2);
                        })()}
                        r="2.2"
                        fill={positive ? 'rgb(134 239 172)' : 'rgb(251 113 133)'}
                    />
                ) : (
                    <circle cx="129" cy="4" r="2.2" fill="rgb(134 239 172)" opacity="0.5" />
                )}
            </svg>
        </div>
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
    tone?: 'primary' | 'warning' | 'risk';
}) {
    const accent =
        tone === 'primary'
            ? 'text-indigo-300'
            : tone === 'warning'
              ? 'text-amber-300'
              : tone === 'risk'
                ? 'text-rose-300'
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

function verdictPillClass(status: PositionBudgetVerdictStatus): string {
    if (status === 'VALID') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
    if (status === 'WARNING') return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
    if (status === 'INVALID') return 'bg-rose-500/10 border-rose-500/30 text-rose-300';
    return 'bg-slate-500/10 border-slate-500/30 text-slate-300';
}

function verdictCardClass(status: PositionBudgetVerdictStatus): string {
    if (status === 'VALID') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-50';
    if (status === 'WARNING') return 'border-amber-500/20 bg-amber-500/10 text-amber-50';
    if (status === 'INVALID') return 'border-rose-500/20 bg-rose-500/10 text-rose-50';
    return 'border-slate-500/20 bg-slate-500/10 text-slate-100';
}

function checkStatusClass(status: 'PASS' | 'WARN' | 'FAIL' | 'PENDING'): string {
    if (status === 'PASS') return 'text-emerald-300';
    if (status === 'WARN') return 'text-amber-300';
    if (status === 'FAIL') return 'text-rose-300';
    return 'text-slate-400';
}

function snapshotDotClass(tone: 'valid' | 'warning' | 'invalid'): string {
    if (tone === 'valid') return 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.35)]';
    if (tone === 'warning') return 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)]';
    return 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.35)]';
}
