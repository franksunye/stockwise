export type DashboardRefreshEvent =
    | 'watchlist_changed'
    | 'history_limit_upgraded'
    | 'resume_visible'
    | 'network_online'
    | 'post_market_poll';

export type DashboardRefreshPlan = {
    profile: 'none' | 'silent';
    dashboard: 'none' | 'silent' | 'force' | 'remap';
    prices: 'none' | 'refresh';
    checkPredictionDrift: boolean;
};

export type DashboardRefreshState = {
    hasWatchlist: boolean;
    loadingWatchlist: boolean;
    hasMissingSymbols: boolean;
    shouldPollBatch: boolean;
    shouldCheckPredictionDrift: boolean;
    historySatisfied: boolean;
    priceOnlyRefresh: boolean;
};

export function getDashboardRefreshPlan(
    event: DashboardRefreshEvent,
    state: DashboardRefreshState,
): DashboardRefreshPlan {
    if (event === 'watchlist_changed') {
        if (!state.hasWatchlist && !state.loadingWatchlist) {
            return {
                profile: 'silent',
                dashboard: 'remap',
                prices: 'none',
                checkPredictionDrift: false,
            };
        }

        return {
            profile: 'silent',
            dashboard: state.hasMissingSymbols ? 'force' : 'remap',
            prices: 'none',
            checkPredictionDrift: false,
        };
    }

    if (event === 'history_limit_upgraded') {
        return {
            profile: 'none',
            dashboard: state.hasWatchlist && !state.historySatisfied ? 'silent' : 'none',
            prices: 'none',
            checkPredictionDrift: false,
        };
    }

    if (event === 'post_market_poll') {
        return {
            profile: 'none',
            dashboard: !state.priceOnlyRefresh && state.shouldPollBatch ? 'silent' : 'none',
            prices: 'none',
            checkPredictionDrift: false,
        };
    }

    if (event === 'resume_visible' || event === 'network_online') {
        return {
            profile: 'none',
            dashboard: !state.priceOnlyRefresh && state.shouldPollBatch ? 'silent' : 'none',
            prices: state.hasWatchlist ? 'refresh' : 'none',
            checkPredictionDrift:
                !state.priceOnlyRefresh &&
                !state.shouldPollBatch &&
                state.shouldCheckPredictionDrift,
        };
    }

    return {
        profile: 'none',
        dashboard: 'none',
        prices: 'none',
        checkPredictionDrift: false,
    };
}
