import { NextResponse } from 'next/server';
import { getMarketAlmanacs } from '@/lib/db';

export const revalidate = 3600; // 1 hour shared cache

export async function GET() {
  try {
    // Only fetch common/global almanac data. No user filtering here.
    const almanacs = await getMarketAlmanacs(5);
    const latestAlmanac = almanacs?.[0] || null;

    return NextResponse.json({
      success: true,
      almanacs: almanacs || [],
      almanac: latestAlmanac,
      lastUpdated: new Date().toISOString(),
      _cached: true,
    });
  } catch (error) {
    console.error('[API/Shared/Almanac] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch shared almanac' },
      { status: 500 }
    );
  }
}
