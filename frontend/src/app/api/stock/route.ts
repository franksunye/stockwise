import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbClient } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const history = searchParams.get('history');

    try {
        const client = getDbClient();

        if (!symbol) {
            let rowObjects;
            if ('execute' in client) {
                const rs = await client.execute('SELECT DISTINCT symbol FROM daily_prices');
                rowObjects = rs.rows;
            } else {
                rowObjects = client.prepare('SELECT DISTINCT symbol FROM daily_prices').all();
                client.close();
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
                client.close();
            }
            return NextResponse.json({ prices: rows });
        }

        // 获取最新价格和 AI 预测
        // latestPrediction: 今日生成的预测（预测明日），用于显示信号
        // prevPrediction: 昨日生成的预测（预测今日），用于显示 "昨日验证" 的验证结果
        let row, latestPrediction, prevPrediction;
        if ('execute' in client) {
            const rsPrice = await client.execute({
                sql: 'SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1',
                args: [symbol]
            });
            const rsPred = await client.execute({
                sql: `
                    SELECT p.*, d.close as close_price
                    FROM ai_predictions p
                    LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.date = d.date
                    WHERE p.symbol = ? 
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
                SELECT p.*, d.close as close_price
                FROM ai_predictions p
                LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.date = d.date
                WHERE p.symbol = ? 
                ORDER BY p.date DESC 
                LIMIT 2
            `).all(symbol) as Record<string, unknown>[];
            latestPrediction = predictions[0];
            prevPrediction = predictions[1];
            client.close();
        }

        if (!row) {
            return NextResponse.json({ error: '未找到该股票数据' }, { status: 404 });
        }

        // 计算客观的最后更新时间
        // 规则：
        // 1. 交易时间 (09:30-12:00, 13:00-16:00): 向下取整到最近的 10 分钟
        // 2. 午休 (12:00-13:00): 固定显示 12:00
        // 3. 收盘后 (>16:00): 固定显示 16:00
        // 4. 开盘前 (<09:30): 显示 16:00 (前一日收盘)
        const getLastUpdateTime = () => {
            const now = new Date();
            // 转换为 UTC+8 (北京/香港时间)
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const hkTime = new Date(utc + (3600000 * 8));

            const hours = hkTime.getHours();
            const minutes = hkTime.getMinutes();
            const totalMinutes = hours * 60 + minutes;

            // 收盘后 (> 16:00 = 960m)
            if (totalMinutes >= 960) return "16:00";

            // 开盘前 (< 09:30 = 570m)
            if (totalMinutes < 570) return "16:00";

            // 午休 (12:00-13:00 / 720m-780m)
            if (totalMinutes >= 720 && totalMinutes < 780) return "12:00";

            // 交易中 -> 向下取整到 10 分钟
            const roundedMinutes = Math.floor(minutes / 10) * 10;
            return `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
        };

        return NextResponse.json({
            price: row,
            prediction: latestPrediction || null,
            previousPrediction: prevPrediction || null,
            last_update_time: getLastUpdateTime()
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
}
