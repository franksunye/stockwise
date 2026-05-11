import type { AppTier } from '@/lib/user-server';

type BatchRow = Record<string, unknown>;

type PriceRow = Record<string, unknown>;

type ShortMetricsRow = Record<string, unknown>;

const SIGNAL_ONLY_TIERS = new Set<AppTier>(['free', 'go', 'plus']);

const PRICE_TECHNICAL_KEYS = [
    'ma5', 'ma10', 'ma20', 'ma60',
    'macd', 'macd_signal', 'macd_hist',
    'boll_upper', 'boll_mid', 'boll_lower',
    'kdj_k', 'kdj_d', 'kdj_j', 'ai_summary',
];

const INTERNAL_PREDICTION_KEYS = [
    'llm_reasoning',
    'rn_daily',
    'rn_history',
    'decision_semantic',
    'effective_decision_semantic',
    'effective_layer1_status',
    'mode_id',
    'producer_outcome_view',
];

export function getBatchUiSignalModeForTier(tier: AppTier): 'signal' | 'layer1_status' {
    return SIGNAL_ONLY_TIERS.has(tier) ? 'signal' : 'layer1_status';
}

export function projectPredictionForTier(
    row: BatchRow | null | undefined,
    tier: AppTier,
): BatchRow | null {
    if (!row) return null;

    const projected = { ...row };

    for (const key of INTERNAL_PREDICTION_KEYS) {
        delete projected[key];
    }

    if (getBatchUiSignalModeForTier(tier) === 'signal') {
        if (projected.canonical_signal != null) {
            projected.signal = projected.canonical_signal;
        }
        if (projected.layer1_signal != null) {
            projected.layer1_status = projected.layer1_signal;
        }
    }

    return projected;
}

export function stripPriceRow(price: PriceRow): PriceRow {
    const out = { ...price };
    for (const key of PRICE_TECHNICAL_KEYS) delete out[key];
    return out;
}

export function stripPredictionRow(row: BatchRow, tier: AppTier): BatchRow {
    return projectPredictionForTier(row, tier) || {};
}

export function isAllNullMetrics(metrics: ShortMetricsRow | null): boolean {
    if (!metrics) return true;
    return Object.entries(metrics).every(
        ([k, v]) => k === 'symbol' || v === null || v === undefined,
    );
}

export function buildStockFacts(params: {
    symbols: string[];
    latestPrices: PriceRow[];
    shortMetricsRows: ShortMetricsRow[];
    allHistory: BatchRow[];
    historyLimit: number;
    tier: AppTier;
    lastUpdated: string;
    validDateThreshold: string;
}): Array<Record<string, unknown>> {
    const {
        symbols,
        latestPrices,
        shortMetricsRows,
        allHistory,
        historyLimit,
        tier,
        lastUpdated,
        validDateThreshold,
    } = params;

    const priceMap = new Map(latestPrices.map((p) => [p.symbol as string, p]));
    const shortMetricsMap = new Map(shortMetricsRows.map((m) => [m.symbol as string, m]));
    const historyBySymbol = new Map<string, BatchRow[]>();

    for (const hist of allHistory) {
        const sym = hist.symbol as string;
        if (!historyBySymbol.has(sym)) historyBySymbol.set(sym, []);
        historyBySymbol.get(sym)!.push(hist);
    }

    const isLite = historyLimit <= 1;

    return symbols.map((sym) => {
        const rawHistory = historyBySymbol.get(sym) || [];
        const price = priceMap.get(sym);
        const validPreds = rawHistory.filter((row) => {
            const raw = row.date ?? row.target_date;
            const date =
                raw == null || raw === ''
                    ? ''
                    : typeof raw === 'string'
                      ? raw.split('T')[0]
                      : String(raw).split('T')[0];
            return date >= validDateThreshold;
        });
        const strippedHistory = rawHistory.map((row) => stripPredictionRow(row, tier));
        const shortMetrics = shortMetricsMap.get(sym) || null;

        const entry: Record<string, unknown> = {
            symbol: sym,
            price: price && isLite ? stripPriceRow(price) : (price || null),
            prediction: validPreds[0] ? stripPredictionRow(validPreds[0], tier) : null,
            previousPrediction: validPreds[1] ? stripPredictionRow(validPreds[1], tier) : null,
            lastUpdated,
        };

        if (!isLite) {
            entry.history = strippedHistory;
            entry.hasMoreHistory = strippedHistory.length >= historyLimit;
        }

        if (!isAllNullMetrics(shortMetrics)) {
            entry.shortMetrics = shortMetrics;
        }

        return entry;
    });
}
