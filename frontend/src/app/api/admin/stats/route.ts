import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export async function GET() {
    try {
        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        const stats: any = {
            strategy,
            counts: {},
            lastUpdates: {}
        };

        if (strategy === 'cloud') {
            const turso = client as any;

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

            stats.counts.global_stocks = results[0].rows[0].count;
            stats.counts.watchlists = results[1].rows[0].count;
            stats.counts.prices = results[2].rows[0].count;
            stats.counts.predictions = results[3].rows[0].count;
            stats.counts.users = results[4].rows[0].count;

            stats.lastUpdates.stocks = results[5].rows[0].last;
            stats.lastUpdates.prices = results[6].rows[0].last;
            stats.lastUpdates.predictions = results[7].rows[0].last;

        } else {
            const db = client as any;

            stats.counts.global_stocks = db.prepare('SELECT COUNT(*) as count FROM global_stock_pool').get().count;
            stats.counts.watchlists = db.prepare('SELECT COUNT(*) as count FROM user_watchlist').get().count;
            stats.counts.prices = db.prepare('SELECT COUNT(*) as count FROM daily_prices').get().count;
            stats.counts.predictions = db.prepare('SELECT COUNT(*) as count FROM ai_predictions').get().count;
            stats.counts.users = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

            stats.lastUpdates.stocks = db.prepare('SELECT MAX(last_synced_at) as last FROM global_stock_pool').get().last;
            stats.lastUpdates.prices = db.prepare('SELECT MAX(date) as last FROM daily_prices').get().last;
            stats.lastUpdates.predictions = db.prepare('SELECT MAX(date) as last FROM ai_predictions').get().last;

            db.close();
        }

        return NextResponse.json(stats);
    } catch (error: any) {
        console.error('Failed to fetch stats:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
