import { NextRequest, NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    try {
        // Get user ID from custom header (set by middleware or client)
        const headersList = await headers()
        const userId = headersList.get('x-user-id')

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 })
        }

        const db = getDbClient()

        // Check if db is Turso (async) or SQLite (sync)
        if ('execute' in db) {
            // Turso/libsql
            const result = await db.execute({
                sql: `SELECT date, content, push_hook, created_at FROM daily_briefs WHERE user_id = ? AND date = ?`,
                args: [userId, date]
            })

            if (result.rows.length === 0) {
                return NextResponse.json({ brief: null })
            }

            const row = result.rows[0]
            return NextResponse.json({
                brief: {
                    date: row.date,
                    content: row.content,
                    push_hook: row.push_hook,
                    created_at: row.created_at
                }
            })
        } else {
            // Local SQLite (better-sqlite3)
            const stmt = db.prepare(`SELECT date, content, push_hook, created_at FROM daily_briefs WHERE user_id = ? AND date = ?`)
            const row = stmt.get(userId, date) as { date: string; content: string; push_hook: string; created_at: string } | undefined

            if (!row) {
                return NextResponse.json({ brief: null })
            }

            return NextResponse.json({
                brief: {
                    date: row.date,
                    content: row.content,
                    push_hook: row.push_hook,
                    created_at: row.created_at
                }
            })
        }
    } catch (error) {
        console.error('Brief API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
