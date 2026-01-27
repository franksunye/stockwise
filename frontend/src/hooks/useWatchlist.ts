import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentUser } from '@/lib/user';

const WATCHLIST_STORAGE_KEY = 'STOCKWISE_WATCHLIST_V2'; // Version 2 for clean slate

export interface WatchlistItem {
    symbol: string;
    name: string;
    addedAt: number;
}

export function useWatchlist() {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const isSyncing = useRef(false);

    // 1. Init: Load from local storage immediately (Sync, synchronous if possible for speed, but useEffect is fine)
    useEffect(() => {
        try {
            const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setWatchlist(parsed);
                    setLoading(false);
                }
            }
        } catch (e) { console.error('Local watchlist load error', e); }
    }, []);

    // 2. Sync with server (Silent & Lazy)
    useEffect(() => {
        const sync = async () => {
            if (isSyncing.current) return;
            isSyncing.current = true;

            const user = await getCurrentUser();
            if (!user) {
                isSyncing.current = false;
                return;
            }

            try {
                // Fetch source of truth from server
                const res = await fetch(`/api/stock-pool?userId=${user.userId}`);
                if (res.ok) {
                    const data = await res.json();
                    // Map to our internal structure
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const remoteList: WatchlistItem[] = (data.stocks || []).map((s: any) => ({
                        symbol: s.symbol,
                        name: s.name,
                        addedAt: s.added_at ? new Date(s.added_at).getTime() : Date.now()
                    }));

                    // Compare and update if necessary (Remote wins in this simple strategy)
                    setWatchlist(current => {
                        const currentStr = JSON.stringify(current.map(i => i.symbol).sort());
                        const remoteStr = JSON.stringify(remoteList.map(i => i.symbol).sort());

                        if (currentStr !== remoteStr) {
                            console.log('🔄 Watchlist sync: updated from server');
                            localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(remoteList));
                            return remoteList;
                        }
                        return current;
                    });
                    setLoading(false);
                }
            } catch (e) {
                console.error('Watchlist sync error', e);
            } finally {
                isSyncing.current = false;
            }
        };

        // Execute after a short delay to prioritize UI painting
        const timer = setTimeout(sync, 500);
        return () => clearTimeout(timer);
    }, []);

    const addStock = useCallback(async (symbol: string, name: string) => {
        const user = await getCurrentUser();
        if (!user) return false;

        const newItem: WatchlistItem = { symbol, name, addedAt: Date.now() };

        // Optimistic Update
        setWatchlist(prev => {
            if (prev.find(p => p.symbol === symbol)) return prev; // Dedup
            const next = [...prev, newItem];
            localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
            return next;
        });

        // Background Sync
        try {
            await fetch('/api/stock-pool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.userId, symbol, name })
            });
            return true;
        } catch (e) {
            console.error('Add failed', e);
            // Rollback
            setWatchlist(prev => {
                const next = prev.filter(p => p.symbol !== symbol);
                localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
                return next;
            });
            return false;
        }
    }, []);

    const removeStock = useCallback(async (symbol: string) => {
        const user = await getCurrentUser();
        if (!user) return false;

        // Use a ref or local var to store the item for rollback? 
        // Since we are inside the callback, we can't easily access the *current* state at call time 
        // inside the catch block if we don't depend on it.
        // simpler strategy: fetch from state inside the updater to find what we are deleting.

        let itemToRestore: WatchlistItem | undefined;

        // Optimistic Update
        setWatchlist(prev => {
            itemToRestore = prev.find(p => p.symbol === symbol);
            const next = prev.filter(p => p.symbol !== symbol);
            localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
            return next;
        });

        // Background Sync
        try {
            await fetch(`/api/stock-pool?userId=${user.userId}&symbol=${symbol}`, {
                method: 'DELETE'
            });
            return true;
        } catch (e) {
            console.error('Delete failed', e);
            // Rollback
            if (itemToRestore) {
                setWatchlist(prev => {
                    const next = [...prev, itemToRestore!];
                    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
                    return next;
                });
            }
            return false;
        }
    }, []);

    return { watchlist, loading, addStock, removeStock };
}
