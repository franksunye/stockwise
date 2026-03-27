import type { AIPrediction, StockData, TacticalData } from './types';

export interface DashboardTacticalSelection {
    symbol: string;
    prediction: AIPrediction;
}

type StockLike = Pick<StockData, 'symbol'> & Partial<Pick<StockData, 'name' | 'rule' | 'price' | 'shortMetrics'>> & {
    isAlmanac?: boolean;
};

export function getDashboardContentStock<T extends StockLike>(currentStock: T | null | undefined): T | null {
    if (!currentStock || currentStock.isAlmanac) return null;
    return currentStock;
}

export function getBriefDrawerSymbol(currentStock: StockLike | null | undefined): string | undefined {
    return getDashboardContentStock(currentStock)?.symbol;
}

export function createDashboardTacticalSelection(symbol: string, prediction: AIPrediction): DashboardTacticalSelection {
    return { symbol, prediction };
}

export function findDashboardSelectedStock<T extends Pick<StockData, 'symbol'>>(stocks: T[], symbol: string | null | undefined): T | null {
    if (!symbol) return null;
    return stocks.find((stock) => stock.symbol === symbol) || null;
}

export function parseDashboardSelectedTactics(selection: DashboardTacticalSelection | null): TacticalData | null {
    if (!selection?.prediction?.ai_reasoning) return null;
    try {
        return JSON.parse(selection.prediction.ai_reasoning) as TacticalData;
    } catch {
        return null;
    }
}

export function getDashboardActiveModal(modals: {
    userCenterOpen: boolean;
    briefOpen: boolean;
    selectedTactics: DashboardTacticalSelection | null;
    profileStock: StockData | null;
}): 'tactics' | 'profile' | 'brief' | 'user-center' | 'none' {
    if (modals.selectedTactics) return 'tactics';
    if (modals.profileStock) return 'profile';
    if (modals.briefOpen) return 'brief';
    if (modals.userCenterOpen) return 'user-center';
    return 'none';
}
