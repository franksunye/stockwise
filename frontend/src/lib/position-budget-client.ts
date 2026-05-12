'use client';

import type { PositionBudgetRMode } from '@/lib/position-budget';
import type { StockSearchHit } from '@/hooks/useStockSymbolSearch';

export type PositionBudgetSetupType =
  | 'breakout'
  | 'pullback'
  | 'trend_continuation'
  | 'reversal'
  | 'earnings'
  | 'swing'
  | 'scalping'
  | 'other';

export type PositionBudgetPreferences = {
  default_account_size: number | null;
  default_risk_ratio: number;
  default_r_mode: PositionBudgetRMode;
};

export type PositionBudgetSnapshotInput = {
  symbol: string;
  setup_type: PositionBudgetSetupType | null;
  entry_price: number;
  stop_loss_price: number;
  target_price: number | null;
  account_size: number;
  risk_ratio: number;
  risk_amount: number;
  position_size: number;
  expected_loss: number;
  stop_percent: number;
  r_mode: PositionBudgetRMode;
};

export type PositionBudgetSnapshot = {
  snapshot_id: string;
  symbol: string;
  setup_type: PositionBudgetSetupType | null;
  entry_price: number;
  stop_loss_price: number;
  target_price: number | null;
  account_size: number;
  risk_ratio: number;
  risk_amount: number;
  risk_per_share: number;
  position_size: number;
  expected_loss: number;
  r_mode: PositionBudgetRMode;
  created_at: string;
};

export type PositionBudgetPricePoint = {
  date: string | null;
  close: number;
  change_percent: number | null;
};

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export async function fetchPositionBudgetPreferences(): Promise<PositionBudgetPreferences | null> {
  const response = await fetch('/api/user/trade-management/preferences');
  if (!response.ok) return null;
  const data = await readJson(response);
  return (data.preferences || null) as PositionBudgetPreferences | null;
}

export async function fetchPositionBudgetSnapshots(params?: {
  symbol?: string;
  limit?: number;
}): Promise<PositionBudgetSnapshot[]> {
  const qs = new URLSearchParams();
  if (params?.symbol) qs.set('symbol', params.symbol);
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await fetch(`/api/user/trade-management/position-budget/snapshots${suffix}`);
  if (!response.ok) return [];
  const data = await readJson(response);
  return Array.isArray(data.snapshots) ? (data.snapshots as PositionBudgetSnapshot[]) : [];
}

export async function fetchPositionBudgetStockIdentity(
  symbol: string,
): Promise<Pick<StockSearchHit, 'symbol' | 'name' | 'name_en' | 'market'> | null> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;
  const response = await fetch(`/api/stock/search?q=${encodeURIComponent(normalized)}`);
  if (!response.ok) return null;
  const data = await readJson(response);
  const rows = Array.isArray(data.results) ? (data.results as StockSearchHit[]) : [];
  return rows.find((row) => row.symbol?.toUpperCase() === normalized) ?? rows[0] ?? null;
}

export async function fetchPositionBudgetPriceHistory(
  symbol: string,
  limit: number = 30,
): Promise<PositionBudgetPricePoint[]> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return [];
  const qs = new URLSearchParams({
    symbol: normalized,
    limit: String(limit),
  });
  const response = await fetch(`/api/stock/prices/history?${qs.toString()}`);
  if (!response.ok) return [];
  const data = await readJson(response);
  const rows = Array.isArray(data.prices) ? data.prices : [];
  return rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      const close = Number(item.close);
      const changePercent = Number(item.change_percent);
      return {
        date: item.date == null ? null : String(item.date),
        close,
        change_percent: Number.isFinite(changePercent) ? changePercent : null,
      };
    })
    .filter((row): row is PositionBudgetPricePoint => Number.isFinite(row.close));
}

export async function savePositionBudgetPreferences(
  preferences: PositionBudgetPreferences,
): Promise<{ ok: true; preferences: PositionBudgetPreferences } | { ok: false; error: string }> {
  const response = await fetch('/api/user/trade-management/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: String(data.error || 'Failed to update preferences') };
  }
  return {
    ok: true,
    preferences: (data.preferences || preferences) as PositionBudgetPreferences,
  };
}

export async function savePositionBudgetSnapshot(
  snapshot: PositionBudgetSnapshotInput,
): Promise<{ ok: true; snapshotId: string | null } | { ok: false; error: string }> {
  const response = await fetch('/api/user/trade-management/position-budget/snapshots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: String(data.error || 'Failed to save snapshot') };
  }
  return {
    ok: true,
    snapshotId: typeof data.snapshot_id === 'string' ? data.snapshot_id : null,
  };
}
