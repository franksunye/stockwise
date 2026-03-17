import { NextResponse } from 'next/server';
import { getLatestPrices } from '@/lib/stock-cache';
import { requireUserSession } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

function applyNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('X-Accel-Buffering', 'no');
  return response;
}

function formatPriceUpdateTag(hkTime: Date): string {
  const month = String(hkTime.getMonth() + 1).padStart(2, '0');
  const day = String(hkTime.getDate()).padStart(2, '0');
  const hours = String(hkTime.getHours()).padStart(2, '0');
  const minutes = String(hkTime.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols') || '';
  const symbols = symbolsParam
    ? symbolsParam.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    : [];

  if (symbols.length === 0) {
    return NextResponse.json({ prices: [] });
  }
  if (symbols.length > 100) {
    return NextResponse.json({ error: 'Too many symbols' }, { status: 400 });
  }

  // Reuse existing auth semantics: prices 仍要求登录态，以免泄露用户 universe。
  const auth = requireUserSession(request);
  if ('response' in auth) {
    return applyNoStoreHeaders(auth.response);
  }

  try {
    const normalizedSymbols = Array.from(new Set(symbols)).sort();
    const latestPrices = await getLatestPrices(normalizedSymbols);

    const hkTime = new Date(
      new Date().getTime() + new Date().getTimezoneOffset() * 60000 + 3600000 * 8,
    );
    const updateTag = formatPriceUpdateTag(hkTime);

    const prices = latestPrices.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        symbol: String(r.symbol),
        date: r.date ? String(r.date) : null,
        close: typeof r.close === 'number' ? r.close : null,
        change_percent:
          typeof r.change_percent === 'number' ? r.change_percent : null,
        lastUpdated: updateTag,
      };
    });

    const response = NextResponse.json({ prices, timestamp: new Date().toISOString() });
    return applyNoStoreHeaders(response);
  } catch (error) {
    // 对价量层的错误保持简单语义；调用方可选择保留旧价或展示占位。
    console.error('[Prices] Failed to load latest prices:', error);
    return applyNoStoreHeaders(
      NextResponse.json({ error: 'Price fetch error' }, { status: 500 }),
    );
  }
}

