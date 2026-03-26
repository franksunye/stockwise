import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { getMarketAlmanacs } from '@/lib/db';
import {
  SHARED_ALMANAC_CACHE_TAG,
  SHARED_ALMANAC_REVALIDATE_SECONDS,
} from '@/lib/cache-tags';

export const dynamic = 'force-dynamic';

const getCachedSharedAlmanacs = unstable_cache(
  async () => getMarketAlmanacs(5),
  ['shared-almanac-v1'],
  {
    revalidate: SHARED_ALMANAC_REVALIDATE_SECONDS,
    tags: [SHARED_ALMANAC_CACHE_TAG],
  }
);

export async function GET() {
  try {
    // Cache the DB read itself so we keep server load low while still allowing
    // targeted invalidation immediately after a new almanac is generated.
    const almanacs = await getCachedSharedAlmanacs();
    const latestAlmanac = almanacs?.[0] || null;

    const response = NextResponse.json({
      success: true,
      almanacs: almanacs || [],
      almanac: latestAlmanac,
      lastUpdated: new Date().toISOString(),
      _cached: true,
    });
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    return response;
  } catch (error) {
    console.error('[API/Shared/Almanac] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch shared almanac' },
      { status: 500 }
    );
  }
}
