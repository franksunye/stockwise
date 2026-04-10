import { getHKTime, getLastTradingDay, getMarketFromSymbol, getMarketScene, normalizeToTradingDate } from '@/lib/date-utils';
import type { AIPrediction, StockData } from '@/lib/types';

type DashboardPredictionSource = Pick<StockData, 'symbol' | 'prediction' | 'previousPrediction'>;

export interface DashboardPredictionView {
  todayPrediction: AIPrediction | null;
  displayPrediction: AIPrediction | null;
}

export function getDashboardPredictionView(data: DashboardPredictionSource): DashboardPredictionView {
  const marketType = getMarketFromSymbol(data.symbol);
  const scene = getMarketScene(marketType);
  const isPostMarket = scene === 'post_market';
  const today = getHKTime();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const normalizeTargetDate = (targetDate?: string) => normalizeToTradingDate(targetDate, marketType);

  const todayPrediction =
    [data.prediction, data.previousPrediction].find((prediction) => normalizeTargetDate(prediction?.target_date) === todayStr) || null;

  let thresholdDateStr = todayStr;
  if (isPostMarket) {
    const lastTrading = getLastTradingDay(undefined, marketType);
    const y = lastTrading.getFullYear();
    const m = String(lastTrading.getMonth() + 1).padStart(2, '0');
    const d = String(lastTrading.getDate()).padStart(2, '0');
    thresholdDateStr = `${y}-${m}-${d}`;
  }

  const candidate = isPostMarket ? data.prediction : (todayPrediction || data.prediction);
  const displayPrediction =
    candidate && normalizeTargetDate(candidate.target_date) >= thresholdDateStr
      ? candidate
      : null;

  return {
    todayPrediction,
    displayPrediction,
  };
}
