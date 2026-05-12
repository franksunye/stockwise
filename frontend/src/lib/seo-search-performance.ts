import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

type DbStrategy = 'cloud' | 'local';

/** Ingest identifiers must match upstream APIs (examples: Google Search Console property string, Bing site URL). */
export type SeoSearchChannel = 'gsc' | 'bing';

/** `page` = aggregated row without query breakdown; `query` = breakdown row (requires non-empty normalized query text). */
export type SeoSearchGranularity = 'page' | 'query';

export type SeoSearchPerformanceUpsertRow = {
    report_date: string;
    source: SeoSearchChannel;
    granularity: SeoSearchGranularity;
    site_scope: string;
    page_path: string;
    /** Use empty string when `granularity === 'page'`. Lowercased trimmed query otherwise. */
    search_query?: string | null;
    impressions: number;
    clicks: number;
    /** Stored as fractional 0..1 (matches Google Search Analytics field shape). Bing pipeline must normalize percentages into this band. */
    ctr: number | null;
    /** Average position where applicable (1-based). Null when vendor omits metric. */
    position: number | null;
    ingest_run_id?: string | null;
    raw_json?: string | null;
};

export type SeoSearchPageDailyPoint = {
    report_date: string;
    source: SeoSearchChannel;
    site_scope: string;
    impressions: number;
    clicks: number;
    ctr: number | null;
    position: number | null;
};

export type SeoSearchQueryRow = {
    report_date: string;
    source: SeoSearchChannel;
    site_scope: string;
    search_query: string;
    impressions: number;
    clicks: number;
    ctr: number | null;
    position: number | null;
};

export type SeoSearchPathQueryResult = {
    normalized_path: string;
    days: number;
    sources: SeoSearchChannel[];
    scopes_for_path: string[];
    page_daily: SeoSearchPageDailyPoint[];
    query_rows: SeoSearchQueryRow[];
};

let _schemaEnsuredSeoPerf = false;

async function exec(
    client: Client | Database.Database,
    strategy: DbStrategy,
    sql: string,
    args: Array<string | number | null> = [],
): Promise<void> {
    if (strategy === 'cloud') {
        await (client as Client).execute({ sql, args });
        return;
    }
    (client as Database.Database).prepare(sql).run(...args);
}

async function execQuery<Row extends Record<string, unknown>>(
    client: Client | Database.Database,
    strategy: DbStrategy,
    sql: string,
    args: Array<string | number | null>,
): Promise<Row[]> {
    if (strategy === 'cloud') {
        const rs = await (client as Client).execute({ sql, args });
        return rs.rows as unknown as Row[];
    }
    return (client as Database.Database).prepare(sql).all(...args) as Row[];
}

/**
 * Normalize URL paths stored for SEO reporting.
 *
 * Rules:
 * - Canonical key is pathname only (no hostname, fragment, query string).
 * - Leading slash required; trailing slash stripped except `/`.
 * - Full URLs are parsed and only pathname is retained.
 */
export function normalizeCanonicalPath(raw: string): string {
    const t = raw.trim();
    if (!t) return '/';

    try {
        if (t.includes('://')) {
            const u = new URL(t);
            return normalizeCanonicalPath(u.pathname || '/');
        }
    } catch {
        // fallthrough
    }

    const noQuery = t.split(/[?#]/)[0] ?? '';
    let p = noQuery.startsWith('/') ? noQuery : `/${noQuery}`;
    if (p.length > 1) {
        p = p.replace(/\/+$/, '');
    }
    return p === '' ? '/' : p;
}

function coercePageRowQuery(granularity: SeoSearchGranularity, query: string | null | undefined): string {
    const q = query == null ? '' : query.trim().toLowerCase();
    return granularity === 'page' ? '' : q;
}

export async function ensureSeoSearchPerformanceSchema(
    client: Client | Database.Database,
    strategy: DbStrategy,
): Promise<void> {
    if (_schemaEnsuredSeoPerf) return;

    await exec(client, strategy, `
    CREATE TABLE IF NOT EXISTS seo_search_performance (
      report_date TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('gsc', 'bing')),
      granularity TEXT NOT NULL CHECK (granularity IN ('page', 'query')),
      site_scope TEXT NOT NULL,
      page_path TEXT NOT NULL,
      search_query TEXT NOT NULL,
      impressions INTEGER NOT NULL DEFAULT 0 CHECK (impressions >= 0),
      clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
      ctr REAL CHECK (ctr IS NULL OR (ctr >= 0 AND ctr <= 1)),
      position REAL CHECK (position IS NULL OR position >= 0),
      ingest_run_id TEXT,
      raw_json TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
      PRIMARY KEY (report_date, source, granularity, site_scope, page_path, search_query)
    )
    `);

    await exec(
        client,
        strategy,
        `CREATE INDEX IF NOT EXISTS idx_seo_search_perf_path_date
       ON seo_search_performance(page_path, report_date DESC)`
    );

    await exec(
        client,
        strategy,
        `CREATE INDEX IF NOT EXISTS idx_seo_search_perf_scope_date
       ON seo_search_performance(site_scope, report_date DESC)`
    );

    _schemaEnsuredSeoPerf = true;
}

export async function upsertSeoSearchPerformanceRows(
    client: Client | Database.Database,
    strategy: DbStrategy,
    rows: SeoSearchPerformanceUpsertRow[],
): Promise<{ upserted: number }> {
    await ensureSeoSearchPerformanceSchema(client, strategy);
    let count = 0;
    const sql = `
      INSERT INTO seo_search_performance (
        report_date, source, granularity, site_scope, page_path, search_query,
        impressions, clicks, ctr, position, ingest_run_id, raw_json, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours')
      )
      ON CONFLICT(report_date, source, granularity, site_scope, page_path, search_query)
      DO UPDATE SET
        impressions = excluded.impressions,
        clicks = excluded.clicks,
        ctr = excluded.ctr,
        position = excluded.position,
        ingest_run_id = excluded.ingest_run_id,
        raw_json = excluded.raw_json,
        updated_at = datetime('now', '+8 hours')
    `;

    for (const r of rows) {
        const pagePath = normalizeCanonicalPath(r.page_path);
        if (r.granularity === 'query' && !(r.search_query || '').trim()) {
            continue;
        }
        const searchQuery = coercePageRowQuery(r.granularity, r.search_query);
        const scoped = String(r.site_scope || '').trim() || 'unset';
        const args = [
            r.report_date,
            r.source,
            r.granularity,
            scoped,
            pagePath,
            searchQuery,
            Math.round(r.impressions ?? 0),
            Math.round(r.clicks ?? 0),
            r.ctr ?? null,
            r.position ?? null,
            r.ingest_run_id ?? null,
            r.raw_json ?? null,
        ];
        if (strategy === 'cloud') {
            await (client as Client).execute({ sql, args });
        } else {
            (client as Database.Database).prepare(sql).run(...args);
        }
        count += 1;
    }

    return { upserted: count };
}

function dateNdAgo(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
}

/** Read page-level daily series + optional query-detail rows within window. */
export async function querySeoSearchPerformanceForPath(
    client: Client | Database.Database,
    strategy: DbStrategy,
    options: {
        pathRaw: string;
        days: number;
        sources?: SeoSearchChannel[];
        /** Max rows returned from query-granularity table (heavy). Default 120. */
        queryLimit?: number;
    },
): Promise<SeoSearchPathQueryResult> {
    await ensureSeoSearchPerformanceSchema(client, strategy);

    const normalized = normalizeCanonicalPath(options.pathRaw);
    const safeDays = Math.min(Math.max(options.days || 56, 1), 400);
    const since = dateNdAgo(safeDays);
    const sources =
        options.sources && options.sources.length > 0 ? options.sources : (['gsc', 'bing'] as SeoSearchChannel[]);

    const srcIn = sources.map(() => '?').join(', ');
    const argsBase: Array<string | number | null> = [normalized, since, ...sources];

    type ScopeRow = { site_scope: string };
    const scopeSql = `
      SELECT DISTINCT site_scope FROM seo_search_performance
      WHERE page_path = ?
        AND report_date >= ?
        AND source IN (${srcIn})
    `;
    const scopeRows = await execQuery<ScopeRow>(client, strategy, scopeSql, argsBase);

    const pageSeriesSql = `
      SELECT report_date, source, site_scope,
             SUM(impressions) AS impressions,
             SUM(clicks) AS clicks,
             CASE WHEN SUM(impressions) > 0 THEN 1.0 * SUM(clicks) / SUM(impressions) ELSE NULL END AS ctr,
             CASE WHEN SUM(impressions) > 0
               THEN CAST(SUM(COALESCE(position, 0) * impressions) AS REAL) / SUM(impressions)
               ELSE NULL END AS position
      FROM seo_search_performance
      WHERE page_path = ?
        AND granularity = 'page'
        AND report_date >= ?
        AND source IN (${srcIn})
      GROUP BY report_date, source, site_scope
      ORDER BY report_date ASC, source ASC, site_scope ASC
    `;
    const pageRows: SeoSearchPageDailyPoint[] = (await execQuery<Record<string, unknown>>(
        client,
        strategy,
        pageSeriesSql,
        argsBase,
    )).map((row) => ({
        report_date: String(row.report_date),
        source: row.source as SeoSearchChannel,
        site_scope: String(row.site_scope),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        ctr: row.ctr === null || row.ctr === undefined ? null : Number(row.ctr),
        position: row.position === null || row.position === undefined ? null : Number(row.position),
    }));

    const qLimit = Math.min(Math.max(options.queryLimit ?? 120, 1), 2000);
    const querySql = `
      SELECT report_date, source, site_scope, search_query,
             impressions, clicks, ctr, position
      FROM seo_search_performance
      WHERE page_path = ?
        AND granularity = 'query'
        AND search_query <> ''
        AND report_date >= ?
        AND source IN (${srcIn})
      ORDER BY impressions DESC
      LIMIT ?
    `;
    const queryArgs = [...argsBase, qLimit];

    type QRow = Record<string, unknown>;
    const qRowsRaw = await execQuery<QRow>(client, strategy, querySql, queryArgs);
    const query_rows: SeoSearchQueryRow[] = qRowsRaw.map((row) => ({
        report_date: String(row.report_date),
        source: row.source as SeoSearchChannel,
        site_scope: String(row.site_scope),
        search_query: String(row.search_query ?? ''),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        ctr: row.ctr === null || row.ctr === undefined ? null : Number(row.ctr),
        position:
            row.position === null || row.position === undefined ? null : Number(row.position),
    }));

    return {
        normalized_path: normalized,
        days: safeDays,
        sources,
        scopes_for_path: scopeRows.map((s) => s.site_scope),
        page_daily: pageRows,
        query_rows,
    };
}
