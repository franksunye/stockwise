import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getDbClient } from '@/lib/db';
import {
    querySeoSearchPerformanceForPath,
    upsertSeoSearchPerformanceRows,
    type SeoSearchChannel,
    type SeoSearchPerformanceUpsertRow,
} from '@/lib/seo-search-performance';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_UPSERT_ROWS = 8000;

function parseSourcesParam(searchParams: URLSearchParams): SeoSearchChannel[] | undefined {
    const raw = searchParams.get('sources');
    if (!raw?.trim()) return undefined;
    const out: SeoSearchChannel[] = [];
    for (const part of raw.split(',')) {
        const p = part.trim();
        if (p === 'gsc' || p === 'bing') out.push(p);
    }
    return out.length ? Array.from(new Set(out)) : undefined;
}

function isChannel(x: unknown): x is SeoSearchChannel {
    return x === 'gsc' || x === 'bing';
}

function isGranularity(x: unknown): x is 'page' | 'query' {
    return x === 'page' || x === 'query';
}

/** Validate and coerce one ingest row (throws with message). */
function parseUpsertRow(input: unknown, index: number): SeoSearchPerformanceUpsertRow {
    if (!input || typeof input !== 'object') {
        throw new Error(`rows[${index}]: expected object`);
    }
    const o = input as Record<string, unknown>;
    const report_date = typeof o.report_date === 'string' ? o.report_date.trim() : '';
    if (!DATE_RE.test(report_date)) {
        throw new Error(`rows[${index}].report_date: expected YYYY-MM-DD`);
    }
    if (!isChannel(o.source)) {
        throw new Error(`rows[${index}].source: expected gsc | bing`);
    }
    if (!isGranularity(o.granularity)) {
        throw new Error(`rows[${index}].granularity: expected page | query`);
    }
    const site_scope =
        typeof o.site_scope === 'string' ? o.site_scope.trim() : String(o.site_scope ?? '').trim();
    const page_path = typeof o.page_path === 'string' ? o.page_path : '';
    if (!page_path.trim()) {
        throw new Error(`rows[${index}].page_path: required`);
    }

    const impressions = Number(o.impressions);
    const clicks = Number(o.clicks);
    if (!Number.isFinite(impressions) || impressions < 0 || !Number.isInteger(impressions)) {
        throw new Error(`rows[${index}].impressions: expected non-negative integer`);
    }
    if (!Number.isFinite(clicks) || clicks < 0 || !Number.isInteger(clicks)) {
        throw new Error(`rows[${index}].clicks: expected non-negative integer`);
    }

    let ctr: number | null = null;
    if (o.ctr !== null && o.ctr !== undefined) {
        ctr = Number(o.ctr);
        if (!Number.isFinite(ctr) || ctr < 0 || ctr > 1) {
            throw new Error(`rows[${index}].ctr: expected null or number in [0, 1] (fraction)`);
        }
    }

    let position: number | null = null;
    if (o.position !== null && o.position !== undefined) {
        position = Number(o.position);
        if (!Number.isFinite(position) || position < 0) {
            throw new Error(`rows[${index}].position: expected null or number >= 0`);
        }
    }

    let ingest_run_id: string | null = null;
    if (o.ingest_run_id !== null && o.ingest_run_id !== undefined) {
        ingest_run_id = String(o.ingest_run_id).trim() || null;
    }

    let raw_json: string | null = null;
    if (o.raw_json !== null && o.raw_json !== undefined) {
        raw_json =
            typeof o.raw_json === 'string'
                ? o.raw_json
                : JSON.stringify(o.raw_json);
    }

    let search_query = '';
    if (o.granularity === 'query') {
        const q = typeof o.search_query === 'string' ? o.search_query.trim().toLowerCase() : '';
        if (!q) {
            throw new Error(`rows[${index}]: granularity query requires non-empty search_query`);
        }
        search_query = q;
    }

    return {
        report_date,
        source: o.source,
        granularity: o.granularity,
        site_scope,
        page_path,
        search_query,
        impressions: Math.round(impressions),
        clicks: Math.round(clicks),
        ctr,
        position,
        ingest_run_id,
        raw_json,
    };
}

export async function GET(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    const url = new URL(request.url);
    const pathRaw = url.searchParams.get('path') ?? '';
    if (!pathRaw.trim()) {
        return NextResponse.json({ error: 'Missing required query parameter: path' }, { status: 400 });
    }

    const days = Math.min(Math.max(Number(url.searchParams.get('days') || 56), 1), 400);
    const queryLimit = Math.min(Math.max(Number(url.searchParams.get('query_limit') || 120), 1), 2000);
    const sources = parseSourcesParam(url.searchParams);

    const client = getDbClient();
    const strategy = client.$type;
    try {
        const payload = await querySeoSearchPerformanceForPath(client, strategy, {
            pathRaw,
            days,
            sources,
            queryLimit,
        });
        return NextResponse.json({
            generated_at: new Date().toISOString(),
            db_strategy: strategy,
            ...payload,
        });
    } catch (error) {
        console.error('seo-search GET:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    } finally {
        if (strategy === 'local') {
            (client as Database.Database).close();
        }
    }
}

export async function POST(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    const client = getDbClient();
    const strategy = client.$type;
    try {
        const raw = await request.json();
        if (!raw || typeof raw !== 'object') {
            return NextResponse.json({ error: 'Expected JSON body' }, { status: 400 });
        }
        const body = raw as { rows?: unknown };
        const rawRows = body.rows;
        if (!Array.isArray(rawRows)) {
            return NextResponse.json({ error: 'Body must include rows: []' }, { status: 400 });
        }
        if (!rawRows.length) {
            return NextResponse.json({ error: 'rows must not be empty' }, { status: 400 });
        }
        if (rawRows.length > MAX_UPSERT_ROWS) {
            return NextResponse.json(
                { error: `Too many rows (max ${MAX_UPSERT_ROWS} per request)` },
                { status: 400 },
            );
        }

        const rows: SeoSearchPerformanceUpsertRow[] = [];
        for (let i = 0; i < rawRows.length; i += 1) {
            rows.push(parseUpsertRow(rawRows[i], i));
        }

        const { upserted } = await upsertSeoSearchPerformanceRows(client, strategy, rows);
        return NextResponse.json({ ok: true, upserted, db_strategy: strategy });
    } catch (error) {
        const msg = (error as Error).message || 'Invalid body';
        const isClient = /^rows\[\d+]/.test(msg) || /^Body/.test(msg) || /^Expected /.test(msg);
        console.error('seo-search POST:', error);
        return NextResponse.json({ error: msg }, { status: isClient ? 400 : 500 });
    } finally {
        if (strategy === 'local') {
            (client as Database.Database).close();
        }
    }
}
