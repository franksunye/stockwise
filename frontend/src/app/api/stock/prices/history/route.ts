import { NextResponse } from 'next/server';

import { isValidPositionBudgetSymbol } from '@/lib/position-budget';
import { getPriceHistory } from '@/lib/stock-cache';
import { requireUserSession } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

function applyNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('X-Accel-Buffering', 'no');
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = String(searchParams.get('symbol') || '').trim().toUpperCase();
  const parsedLimit = Number.parseInt(searchParams.get('limit') || '30', 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 2), 90) : 30;

  if (!symbol || !isValidPositionBudgetSymbol(symbol)) {
    return applyNoStoreHeaders(
      NextResponse.json({ error: 'Invalid symbol' }, { status: 400 }),
    );
  }

  const auth = requireUserSession(request);
  if ('response' in auth) {
    return applyNoStoreHeaders(auth.response);
  }

  try {
    const rows = await getPriceHistory(symbol, limit);
    const prices = rows.map((row) => {
      const close = Number(row.close);
      const changePercent = Number(row.change_percent);
      return {
        date: row.date ? String(row.date) : null,
        close: Number.isFinite(close) ? close : null,
        change_percent: Number.isFinite(changePercent) ? changePercent : null,
      };
    }).filter((row) => row.close !== null);

    return applyNoStoreHeaders(
      NextResponse.json({
        symbol,
        prices,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error('[PriceHistory] Failed to load price history:', error);
    return applyNoStoreHeaders(
      NextResponse.json({ error: 'Price history fetch error' }, { status: 500 }),
    );
  }
}
