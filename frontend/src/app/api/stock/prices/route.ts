import { NextResponse } from 'next/server';
import { getCachedLatestPrices } from '@/lib/stock-cache';
import { requireUserSession } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

function applyNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('X-Accel-Buffering', 'no');
  return response;
}

function formatPriceUpdateTag(priceDate: unknown, todayDate: string): string {
  if (!priceDate) return '--';

  const normalizedPriceDate = String(priceDate);
  const shortDate = normalizedPriceDate.substring(5);

  // Dashboard 价量层展示的是日线级快照，而非逐笔行情。
  // 若仍为上一交易日数据，需在文案中显式标示“收盘”。
  if (normalizedPriceDate < todayDate) {
    return `${shortDate} 收盘`;
  }

  return `${shortDate} 已更新`;
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
    const latestPrices = await getCachedLatestPrices(normalizedSymbols);

    const hkTime = new Date(
      new Date().getTime() + new Date().getTimezoneOffset() * 60000 + 3600000 * 8,
    );
    const hkDateStr = hkTime.toISOString().split('T')[0];

    const prices = latestPrices.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        symbol: String(r.symbol),
        date: r.date ? String(r.date) : null,
        close: typeof r.close === 'number' ? r.close : null,
        change_percent:
          typeof r.change_percent === 'number' ? r.change_percent : null,
        lastUpdated: formatPriceUpdateTag(r.date, hkDateStr),
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

