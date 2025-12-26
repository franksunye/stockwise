import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> }
) {
    try {
        const { symbol } = await params;
        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        if (strategy === 'cloud') {
            await (client as any).execute({
                sql: 'DELETE FROM global_stock_pool WHERE symbol = ?',
                args: [symbol]
            });
        } else {
            const db = client as any;
            db.prepare('DELETE FROM global_stock_pool WHERE symbol = ?').run(symbol);
            db.close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete stock:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
