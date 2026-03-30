'use client';

import useSWR from 'swr';

import {
  fetchTradeManagementData,
  getTradeManagementMemorySnapshot,
  getTradeManagementSWRKey,
  readTradeManagementSessionSnapshot,
  setTradeManagementMemorySnapshot,
  writeTradeManagementSessionSnapshot,
  type TradeManagementSnapshot,
} from '@/lib/trade-management-surface';

const CACHE_TTL = 1000 * 60 * 5;

async function tradeManagementFetcher([
  ,
  symbol,
]: readonly [string, string]): Promise<TradeManagementSnapshot> {
  return fetchTradeManagementData(symbol);
}

interface UseTradeManagementSurfaceOptions {
  symbol: string;
  enabled: boolean;
}

export function useTradeManagementSurface({ symbol, enabled }: UseTradeManagementSurfaceOptions) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const memorySnapshot = normalizedSymbol
    ? getTradeManagementMemorySnapshot(normalizedSymbol)
    : null;
  const sessionSnapshot = !memorySnapshot && normalizedSymbol
    ? readTradeManagementSessionSnapshot(normalizedSymbol)
    : null;
  const fallbackSnapshot = memorySnapshot || sessionSnapshot || undefined;
  const hasSessionSnapshot = !!sessionSnapshot;
  const isFreshMemory = memorySnapshot
    ? Date.now() - memorySnapshot.fetchedAt < CACHE_TTL
    : false;
  const shouldRevalidateOnMount = enabled && !hasSessionSnapshot && !isFreshMemory;

  const swrKey = enabled && normalizedSymbol
    ? getTradeManagementSWRKey(normalizedSymbol)
    : null;

  const swr = useSWR(swrKey, tradeManagementFetcher, {
    fallbackData: fallbackSnapshot,
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateIfStale: shouldRevalidateOnMount,
    revalidateOnMount: shouldRevalidateOnMount,
    dedupingInterval: 10 * 1000,
    onSuccess: (snapshot) => {
      if (!normalizedSymbol) return;
      setTradeManagementMemorySnapshot(normalizedSymbol, snapshot);
      writeTradeManagementSessionSnapshot(normalizedSymbol, snapshot);
    },
  });

  return {
    ...swr,
    payload: swr.data?.data,
  };
}
