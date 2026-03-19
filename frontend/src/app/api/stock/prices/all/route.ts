import { NextResponse } from 'next/server';
import { getCachedBroadcastPrices } from '@/lib/stock-cache';

export const dynamic = 'force-dynamic';

type BroadcastPriceItem = {
  symbol: string;
  lastPrice: number | null;
  change: number | null;
  changePct: number | null;
  updatedAt: string | null;
};

function parseLimit(raw: string | null): number {
  if (!raw) return 200;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 200;
  return Math.min(Math.max(parsed, 1), 1000);
}

function toItem(row: Record<string, unknown>): BroadcastPriceItem {
  const close = typeof row.close === 'number' ? row.close : null;
  const changePct = typeof row.change_percent === 'number' ? row.change_percent : null;
  return {
    symbol: String(row.symbol ?? ''),
    lastPrice: close,
    change: close != null && changePct != null ? (close * changePct) / 100 : null,
    changePct,
    updatedAt: row.date ? String(row.date) : null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = (searchParams.get('market') || 'all').toLowerCase();
  if (market !== 'hk' && market !== 'cn' && market !== 'all') {
    return NextResponse.json({ error: 'Invalid market' }, { status: 400 });
  }

  const limit = parseLimit(searchParams.get('limit'));

  try {
    const rows = await getCachedBroadcastPrices(market, limit);
    const items = rows
      .map((row) => toItem(row as Record<string, unknown>))
      .filter((item) => item.symbol.length > 0);

    const response = NextResponse.json({
      market,
      asOf: new Date().toISOString(),
      items,
    });
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30');
    return response;
  } catch (error) {
    console.error('[PricesAll] Failed to load broadcast prices:', error);
    return NextResponse.json(
      { error: 'Broadcast price fetch error' },
      { status: 500 },
    );
  }
}
