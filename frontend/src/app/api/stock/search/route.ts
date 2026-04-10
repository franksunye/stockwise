import { getDbClient } from '../../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 1) {
        return NextResponse.json({ results: [] });
    }

    const db = getDbClient();
    try {
        let rows;
        const sql = `
            SELECT symbol, name, name_en, market, pinyin_abbr,
            (CASE 
                WHEN symbol = ? THEN 100
                WHEN LOWER(pinyin_abbr) = ? THEN 95
                WHEN name = ? THEN 90
                WHEN name_en IS NOT NULL AND LOWER(name_en) = ? THEN 87
                WHEN name_en IS NOT NULL AND LOWER(name_en) LIKE ? THEN 84
                WHEN symbol LIKE ? THEN 80
                WHEN LOWER(pinyin_abbr) LIKE ? THEN 70
                WHEN name LIKE ? THEN 60
                WHEN name_en IS NOT NULL AND LOWER(name_en) LIKE ? THEN 58
                ELSE 10
            END) as score
            FROM stock_meta 
            WHERE symbol LIKE ? 
               OR name LIKE ? 
               OR LOWER(pinyin_abbr) LIKE ? 
               OR LOWER(pinyin) LIKE ?
               OR (name_en IS NOT NULL AND LOWER(name_en) LIKE ?)
            ORDER BY score DESC,
                     CASE WHEN name_en IS NOT NULL AND TRIM(name_en) != '' THEN 1 ELSE 0 END DESC,
                     CASE WHEN name_en IS NOT NULL AND name_en NOT LIKE '%-%' THEN 1 ELSE 0 END DESC,
                     CASE WHEN market = 'HK' AND symbol LIKE '8____' THEN 0 ELSE 1 END DESC,
                     LENGTH(COALESCE(name_en, name)) ASC,
                     LENGTH(name) ASC
            LIMIT 10
        `;

        const normalizedQuery = query.toLowerCase();
        const startMatch = `${normalizedQuery}%`;
        const containsMatch = `%${normalizedQuery}%`;
        const args = [
            query, normalizedQuery, query, normalizedQuery,
            startMatch, startMatch, startMatch, startMatch, startMatch,
            containsMatch, containsMatch, containsMatch, containsMatch, containsMatch,
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
