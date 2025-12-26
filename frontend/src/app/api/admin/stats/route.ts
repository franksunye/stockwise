import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

interface StatsResult {
    strategy: string;
    counts: Record<string, number>;
    lastUpdates: Record<string, string | null>;
}

interface DbResult {
    count: number | bigint;
}

interface LastSyncResult {
    last: string | null;
}

export async function GET() {
    try {
        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        const stats: StatsResult = {
            strategy,
            counts: {},
            lastUpdates: {}
        };

        if (strategy === 'cloud') {
            const turso = client as Client;

            // 并行查询各项统计数据
            const queries = [
                turso.execute('SELECT COUNT(*) as count FROM global_stock_pool'),
                turso.execute('SELECT COUNT(*) as count FROM user_watchlist'),
                turso.execute('SELECT COUNT(*) as count FROM daily_prices'),
                turso.execute('SELECT COUNT(*) as count FROM ai_predictions'),
                turso.execute('SELECT COUNT(*) as count FROM users'),
                turso.execute('SELECT MAX(last_synced_at) as last FROM global_stock_pool'),
                turso.execute('SELECT MAX(date) as last FROM daily_prices'),
                turso.execute('SELECT MAX(date) as last FROM ai_predictions')
            ];

            const results = await Promise.all(queries);

            stats.counts.global_stocks = Number(results[0].rows[0].count);
            stats.counts.watchlists = Number(results[1].rows[0].count);
            stats.counts.prices = Number(results[2].rows[0].count);
            stats.counts.predictions = Number(results[3].rows[0].count);
            stats.counts.users = Number(results[4].rows[0].count);

            stats.lastUpdates.stocks = results[5].rows[0].last as string | null;
            stats.lastUpdates.prices = results[6].rows[0].last as string | null;
            stats.lastUpdates.predictions = results[7].rows[0].last as string | null;

        } else {
            const db = client as Database.Database;

            stats.counts.global_stocks = Number((db.prepare('SELECT COUNT(*) as count FROM global_stock_pool').get() as DbResult).count);
            stats.counts.watchlists = Number((db.prepare('SELECT COUNT(*) as count FROM user_watchlist').get() as DbResult).count);
            stats.counts.prices = Number((db.prepare('SELECT COUNT(*) as count FROM daily_prices').get() as DbResult).count);
            stats.counts.predictions = Number((db.prepare('SELECT COUNT(*) as count FROM ai_predictions').get() as DbResult).count);
            stats.counts.users = Number((db.prepare('SELECT COUNT(*) as count FROM users').get() as DbResult).count);

            stats.lastUpdates.stocks = (db.prepare('SELECT MAX(last_synced_at) as last FROM global_stock_pool').get() as LastSyncResult).last;
            stats.lastUpdates.prices = (db.prepare('SELECT MAX(date) as last FROM daily_prices').get() as LastSyncResult).last;
            stats.lastUpdates.predictions = (db.prepare('SELECT MAX(date) as last FROM ai_predictions').get() as LastSyncResult).last;

            db.close();
        }

        return NextResponse.json(stats);
    } catch (error) {
        console.error('Failed to fetch stats:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
