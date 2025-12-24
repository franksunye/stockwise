import { getDbClient } from '../../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 1) {
        return NextResponse.json({ results: [] });
    }

    const db = getDbClient();
    try {
        let rows;
        const sql = `
            SELECT symbol, name, pinyin_abbr,
            (CASE 
                WHEN symbol = ? THEN 100
                WHEN pinyin_abbr = ? THEN 95
                WHEN name = ? THEN 90
                WHEN symbol LIKE ? THEN 80
                WHEN pinyin_abbr LIKE ? THEN 70
                WHEN name LIKE ? THEN 60
                ELSE 10
            END) as score
            FROM stock_meta 
            WHERE symbol LIKE ? 
               OR name LIKE ? 
               OR pinyin_abbr LIKE ? 
               OR pinyin LIKE ?
            ORDER BY score DESC, LENGTH(name) ASC
            LIMIT 10
        `;

        const rawQuery = query.toLowerCase();
        const startMatch = `${rawQuery}%`;
        const containsMatch = `%${rawQuery}%`;
        const args = [
            query, rawQuery, query, // 完全匹配
            startMatch, startMatch, startMatch, // 前缀匹配
            containsMatch, containsMatch, containsMatch, containsMatch // 包含匹配
        ];

        if ('execute' in db) {
            // Turso (libsql)
            const rs = await db.execute({ sql, args });
            rows = rs.rows;
        } else {
            // Local SQLite (better-sqlite3)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rows = (db as any).prepare(sql).all(...args);
        }

        return NextResponse.json({ results: rows });
    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
