'use client';

import { useEffect, useRef } from 'react';
import type { WatchlistItem } from '@/hooks/useWatchlist';
import type { UserProfile } from '@/hooks/useUserProfile';
import type { DashboardRefreshEvent } from '@/lib/dashboard-refresh-contract';

type RefreshProfile = (options?: { watchlist?: string[]; force?: boolean }) => Promise<UserProfile | null>;
type RunDashboardRefreshEvent = (event: DashboardRefreshEvent) => Promise<void>;

type UseDashboardRefreshContractArgs = {
    watchlist: WatchlistItem[];
    loadingWatchlist: boolean;
    historyLimit: number;
    refreshProfile: RefreshProfile;
    runDashboardRefreshEvent: RunDashboardRefreshEvent;
};

export function useDashboardRefreshContract({
    watchlist,
    loadingWatchlist,
    historyLimit,
    refreshProfile,
    runDashboardRefreshEvent,
}: UseDashboardRefreshContractArgs) {
    const prevWatchlistSignatureRef = useRef<string | null>(null);
    const prevHistoryLimitRef = useRef(historyLimit);
    const hasPrimedWatchlistRef = useRef(false);

    useEffect(() => {
        if (loadingWatchlist) return;

        const watchlistSymbols = watchlist.map((item) => item.symbol);
        const nextSignature = watchlistSymbols.join(',');
        const prevSignature = prevWatchlistSignatureRef.current;
        prevWatchlistSignatureRef.current = nextSignature;

        const didChange = prevSignature !== nextSignature;
        if (!didChange) return;

        void runDashboardRefreshEvent('watchlist_changed');

        if (hasPrimedWatchlistRef.current) {
            void refreshProfile({ watchlist: watchlistSymbols });
        } else {
            hasPrimedWatchlistRef.current = true;
        }
    }, [loadingWatchlist, refreshProfile, runDashboardRefreshEvent, watchlist]);

    useEffect(() => {
        if (historyLimit > prevHistoryLimitRef.current) {
            void runDashboardRefreshEvent('history_limit_upgraded');
        }
        prevHistoryLimitRef.current = historyLimit;
    }, [historyLimit, runDashboardRefreshEvent]);

    useEffect(() => {
        const handleResumeVisible = () => {
            if (document.visibilityState === 'visible') {
                void runDashboardRefreshEvent('resume_visible');
            }
        };

        const handleWindowResume = () => {
            void runDashboardRefreshEvent('resume_visible');
        };

        const handleOnline = () => {
            void runDashboardRefreshEvent('network_online');
        };

        document.addEventListener('visibilitychange', handleResumeVisible);
        window.addEventListener('focus', handleWindowResume);
        window.addEventListener('pageshow', handleWindowResume);
        window.addEventListener('online', handleOnline);

        return () => {
            document.removeEventListener('visibilitychange', handleResumeVisible);
            window.removeEventListener('focus', handleWindowResume);
            window.removeEventListener('pageshow', handleWindowResume);
            window.removeEventListener('online', handleOnline);
        };
    }, [runDashboardRefreshEvent]);

    useEffect(() => {
        // Debug seam for deterministic local/release smoke validation.
        (window as typeof window & {
            __stockwiseRunDashboardRefreshEvent?: RunDashboardRefreshEvent;
        }).__stockwiseRunDashboardRefreshEvent = runDashboardRefreshEvent;

        const handleDebugRefresh = (event: Event) => {
            const nextEvent = (event as CustomEvent<DashboardRefreshEvent | undefined>).detail;
            if (
                nextEvent === 'watchlist_changed' ||
                nextEvent === 'history_limit_upgraded' ||
                nextEvent === 'resume_visible' ||
                nextEvent === 'network_online' ||
                nextEvent === 'post_market_poll'
            ) {
                void runDashboardRefreshEvent(nextEvent);
            }
        };

        window.addEventListener('stockwise-dashboard-refresh-smoke', handleDebugRefresh);
        return () => {
            delete (window as typeof window & {
                __stockwiseRunDashboardRefreshEvent?: RunDashboardRefreshEvent;
            }).__stockwiseRunDashboardRefreshEvent;
            window.removeEventListener('stockwise-dashboard-refresh-smoke', handleDebugRefresh);
        };
    }, [runDashboardRefreshEvent]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            void runDashboardRefreshEvent('post_market_poll');
        }, 5 * 60 * 1000);

        return () => window.clearInterval(timer);
    }, [runDashboardRefreshEvent]);
}
