'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Normalized row from `/api/stock/search`. */
export type StockSearchHit = {
    symbol: string;
    name: string;
    name_en?: string | null;
    market?: string;
};

const DEFAULT_DEBOUNCE_MS = 300;

async function fetchStockSearch(
    q: string,
    signal: AbortSignal,
): Promise<StockSearchHit[]> {
    const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`, {
        signal,
    });
    if (!res.ok) throw new Error('Search request failed');
    const data = await res.json();
    return (data.results || []) as StockSearchHit[];
}

/**
 * Debounced stock symbol search against `/api/stock/search`, with immediate
 * refresh via {@link runSearchNow} (e.g. Enter) so dashboard and tools stay aligned.
 */
export function useStockSymbolSearch(options?: { debounceMs?: number }) {
    const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<StockSearchHit[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searching, setSearching] = useState(false);
    const searchAbortRef = useRef<AbortController | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestSeqRef = useRef(0);
    const queryRef = useRef(query);
    queryRef.current = query;

    const performSearch = useCallback(async (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) {
            searchAbortRef.current?.abort();
            searchAbortRef.current = null;
            setSearchResults([]);
            setShowSuggestions(false);
            setSearching(false);
            return;
        }
        const requestSeq = requestSeqRef.current + 1;
        requestSeqRef.current = requestSeq;
        try {
            searchAbortRef.current?.abort();
            const controller = new AbortController();
            searchAbortRef.current = controller;
            setSearching(true);
            const results = await fetchStockSearch(trimmed, controller.signal);
            if (requestSeq !== requestSeqRef.current) return;
            setSearchResults(results);
            setShowSuggestions(true);
        } catch (e) {
            if ((e as Error).name !== 'AbortError') {
                console.error('Search failed', e);
            }
        } finally {
            if (requestSeq === requestSeqRef.current) {
                setSearching(false);
            }
        }
    }, []);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            searchAbortRef.current?.abort();
            setSearchResults([]);
            setShowSuggestions(false);
            setSearching(false);
            return;
        }
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        const timer = setTimeout(() => {
            debounceTimerRef.current = null;
            void performSearch(query);
        }, debounceMs);
        debounceTimerRef.current = timer;
        return () => {
            if (debounceTimerRef.current === timer) {
                debounceTimerRef.current = null;
            }
            clearTimeout(timer);
            searchAbortRef.current?.abort();
        };
    }, [query, debounceMs, performSearch]);

    const runSearchNow = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        void performSearch(queryRef.current);
    }, [performSearch]);

    const resetSearch = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        searchAbortRef.current?.abort();
        requestSeqRef.current += 1;
        setQuery('');
        setSearchResults([]);
        setShowSuggestions(false);
        setSearching(false);
    }, []);

    return {
        query,
        setQuery,
        searchResults,
        showSuggestions,
        setShowSuggestions,
        searching,
        runSearchNow,
        resetSearch,
    };
}
