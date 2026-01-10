import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbClient } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const history = searchParams.get('history');

    try {
        const client = getDbClient();

        try {
            if (!symbol) {
                let rowObjects;
                if ('execute' in client) {
                    const rs = await client.execute('SELECT DISTINCT symbol FROM daily_prices');
                    rowObjects = rs.rows;
                } else {
                    rowObjects = client.prepare('SELECT DISTINCT symbol FROM daily_prices').all();
                }
                return NextResponse.json({ symbols: (rowObjects as { symbol: string }[]).map((r) => r.symbol) });
            }

            if (history) {
                const limit = parseInt(history) || 30;
                let rows;
                if ('execute' in client) {
                    const rs = await client.execute({
                        sql: 'SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?',
                        args: [symbol, limit]
                    });
                    rows = rs.rows;
                } else {
                    rows = client.prepare('SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?').all(symbol, limit);
                }
                return NextResponse.json({ prices: rows });
            }

            // 获取最新价格和 AI 预测
            let row, latestPrediction, prevPrediction;
            if ('execute' in client) {
                const rsPrice = await client.execute({
                    sql: 'SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1',
                    args: [symbol]
                });
                const rsPred = await client.execute({
                    sql: `
                        SELECT p.*, d.close as close_price, m.display_name as model
                        FROM ai_predictions_v2 p
                        LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.date = d.date
                        LEFT JOIN prediction_models m ON p.model_id = m.model_id
                        WHERE p.symbol = ? AND p.is_primary = 1
                        ORDER BY p.date DESC 
                        LIMIT 2
                    `,
                    args: [symbol]
                });
                row = rsPrice.rows[0];
                latestPrediction = rsPred.rows[0];
                prevPrediction = rsPred.rows[1];
            } else {
                row = client.prepare('SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1').get(symbol);
                const predictions = client.prepare(`
                    SELECT p.*, d.close as close_price, m.display_name as model
                    FROM ai_predictions_v2 p
                    LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.date = d.date
                    LEFT JOIN prediction_models m ON p.model_id = m.model_id
                    WHERE p.symbol = ? AND p.is_primary = 1
                    ORDER BY p.date DESC 
                    LIMIT 2
                `).all(symbol) as Record<string, unknown>[];
                latestPrediction = predictions[0];
                prevPrediction = predictions[1];
            }

            if (!row) {
                return NextResponse.json({ error: '未找到该股票数据' }, { status: 404 });
            }

            // 计算客观的最后更新时间
            const getLastUpdateTime = () => {
                const now = new Date();
                const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const hkTime = new Date(utc + (3600000 * 8));

                const hours = hkTime.getHours();
                const minutes = hkTime.getMinutes();
                const totalMinutes = hours * 60 + minutes;

                if (totalMinutes >= 960) return "16:00";
                if (totalMinutes < 570) return "16:00";
                if (totalMinutes >= 720 && totalMinutes < 780) return "12:00";

                const roundedMinutes = Math.floor(minutes / 10) * 10;
                return `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
            };

            return NextResponse.json({
                price: row,
                prediction: latestPrediction || null,
                previousPrediction: prevPrediction || null,
                last_update_time: getLastUpdateTime()
            });
        } finally {
            if (client && !('execute' in client)) {
                client.close();
            }
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
}
