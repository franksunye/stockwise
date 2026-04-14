'use client';

export const WATCHLIST_STORAGE_KEY = 'STOCKWISE_WATCHLIST_V2';
export const WATCHLIST_SYNC_EVENT = 'stockwise-watchlist-sync';
export const WATCHLIST_LAST_SYNC_TS_KEY = 'STOCKWISE_WATCHLIST_LAST_SYNC_TS_V1';
export const WATCHLIST_BOOTSTRAP_TTL_MS = 5 * 60 * 1000;

export interface CachedWatchlistItem {
    symbol: string;
    name: string;
    name_en?: string | null;
    addedAt: number;
}

function normalizeCachedWatchlistItem(raw: unknown): CachedWatchlistItem | null {
    if (!raw || typeof raw !== 'object') return null;

    const item = raw as Record<string, unknown>;
    const symbol = typeof item.symbol === 'string' ? item.symbol.trim() : '';
    const name = typeof item.name === 'string' ? item.name.trim() : symbol;
    if (!symbol) return null;

    const addedAtRaw = item.addedAt;
    const addedAt =
        typeof addedAtRaw === 'number' && Number.isFinite(addedAtRaw)
            ? addedAtRaw
            : Date.now();

    return {
        symbol,
        name: name || symbol,
        name_en: typeof item.name_en === 'string' ? item.name_en : item.name_en === null ? null : undefined,
        addedAt,
    };
}

export function readCachedWatchlist(): CachedWatchlistItem[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item) => normalizeCachedWatchlistItem(item))
            .filter((item): item is CachedWatchlistItem => item !== null);
    } catch {
        return [];
    }
}

export function writeCachedWatchlist(
    items: CachedWatchlistItem[],
    options?: { syncedAt?: number; markSynced?: boolean },
): CachedWatchlistItem[] {
    if (typeof window === 'undefined') return items;

    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items));
    if (options?.markSynced !== false) {
        window.localStorage.setItem(WATCHLIST_LAST_SYNC_TS_KEY, String(options?.syncedAt ?? Date.now()));
    }
    return items;
}

export function markWatchlistSynced(syncedAt: number = Date.now()): number | null {
    if (typeof window === 'undefined') return null;
    window.localStorage.setItem(WATCHLIST_LAST_SYNC_TS_KEY, String(syncedAt));
    return syncedAt;
}

export function getWatchlistLastSyncedAt(): number {
    if (typeof window === 'undefined') return 0;
    const raw = Number(window.localStorage.getItem(WATCHLIST_LAST_SYNC_TS_KEY) || '0');
    return Number.isFinite(raw) ? raw : 0;
}

export function hasFreshBootstrapWatchlist(now: number = Date.now()): boolean {
    const lastSyncedAt = getWatchlistLastSyncedAt();
    return lastSyncedAt > 0 && now - lastSyncedAt < WATCHLIST_BOOTSTRAP_TTL_MS;
}
