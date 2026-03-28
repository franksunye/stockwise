import { NextResponse } from 'next/server';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getDbClient } from '@/lib/db';
import { queryTradeAdviceLogs } from '@/lib/admin-trade-positions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ positionId: string }> }
) {
  const unauthorized = requireAdminAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { positionId } = await params;
    const client = getDbClient();
    const strategy = (process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local') as 'cloud' | 'local';
    const advice = await queryTradeAdviceLogs(client as Client | Database.Database, strategy, positionId);
    if ('$type' in client && client.$type === 'local') {
      (client as Database.Database).close();
    }
    return NextResponse.json({ advice });
  } catch (error) {
    console.error('Failed to fetch trade advice logs:', error);
    return NextResponse.json({ error: 'Failed to fetch trade advice logs' }, { status: 500 });
  }
}
