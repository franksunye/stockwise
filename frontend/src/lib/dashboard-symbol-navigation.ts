export const DASHBOARD_NAV_INTENT_KEY = 'stockwise_dashboard_nav_intent';
export const DASHBOARD_NAV_INTENT_MAX_AGE_MS = 15 * 1000;

function readDashboardNavIntent(raw: string | null | undefined, now: number = Date.now()): { symbol?: string; timestamp: number } | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as { symbol?: string; timestamp?: number };
        if (typeof parsed?.timestamp !== 'number') return null;
        if (now - parsed.timestamp > DASHBOARD_NAV_INTENT_MAX_AGE_MS) return null;
        return {
            symbol: typeof parsed.symbol === 'string' ? parsed.symbol : undefined,
            timestamp: parsed.timestamp,
        };
    } catch {
        return null;
    }
}

export function normalizeDashboardSymbol(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = value.trim().toUpperCase();
    return normalized || null;
}

export function matchesDashboardSymbol(candidate: string | null | undefined, target: string | null | undefined): boolean {
    const normalizedCandidate = normalizeDashboardSymbol(candidate);
    const normalizedTarget = normalizeDashboardSymbol(target);
    if (!normalizedCandidate || !normalizedTarget) return false;
    return normalizedCandidate === normalizedTarget || normalizedCandidate.endsWith(normalizedTarget);
}

export function readDashboardSymbolFromSearchParams(searchParams: URLSearchParams | Pick<URLSearchParams, 'get'>): string | null {
    return normalizeDashboardSymbol(searchParams.get('symbol'));
}

export function readDashboardNavIntentSymbol(now: number = Date.now()): string | null {
    if (typeof window === 'undefined') return null;
    const intent = readDashboardNavIntent(window.sessionStorage.getItem(DASHBOARD_NAV_INTENT_KEY), now);
    return normalizeDashboardSymbol(intent?.symbol);
}

export function writeDashboardNavIntentSymbol(symbol: string, timestamp: number = Date.now()): void {
    if (typeof window === 'undefined') return;
    const normalized = normalizeDashboardSymbol(symbol);
    if (!normalized) return;
    window.sessionStorage.setItem(DASHBOARD_NAV_INTENT_KEY, JSON.stringify({
        symbol: normalized,
        timestamp,
    }));
}

export function clearDashboardNavIntentSymbol(): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(DASHBOARD_NAV_INTENT_KEY);
}

export function resolveDashboardPreferredSymbol({
    searchSymbol,
    navIntentSymbol,
    availableSymbols,
}: {
    searchSymbol?: string | null;
    navIntentSymbol?: string | null;
    availableSymbols: string[];
}): string | null {
    const normalizedAvailable = availableSymbols.map(symbol => normalizeDashboardSymbol(symbol)).filter(Boolean);
    const candidates = [normalizeDashboardSymbol(searchSymbol), normalizeDashboardSymbol(navIntentSymbol)];

    for (const candidate of candidates) {
        if (!candidate) continue;
        const matched = normalizedAvailable.find(symbol => matchesDashboardSymbol(symbol, candidate));
        if (matched) return matched;
    }

    return null;
}
