import { NextResponse } from 'next/server';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getDbClient } from '@/lib/db';
import { DEFAULT_MODE_ID, getModeDefinition } from '@/lib/investment-mode';

export const dynamic = 'force-dynamic';

type DbRow = Record<string, string | number | null>;
type AlertState = 'ok' | 'warn' | 'critical';
type GateStatus = 'PASS' | 'FAIL' | 'HOLD';

type ResearchMetric = {
    strategy_version: string;
    sample_count: number;
    triggered_count: number;
    watch_count: number;
    riskoff_count: number;
    triggered_coverage_pct: number;
    watch_coverage_pct: number;
    riskoff_coverage_pct: number;
    avg_opportunity_score: number;
    latest_date: string | null;
};

type ResearchPoolSummary = {
    manifest_path: string;
    pool_name: string;
    target_size: number;
    actual_size: number;
    latest_reference_date: string | null;
    latest_price_coverage_count: number;
    latest_signal_coverage_count: number;
    board_groups: Array<{ key: string; label: string; count: number }>;
    price_bands: Array<{ key: string; label: string; count: number }>;
    board_group_metrics: Array<{
        key: string;
        label: string;
        count: number;
        sample_count: number;
        triggered_coverage_pct: number;
        watch_coverage_pct: number;
        riskoff_coverage_pct: number;
        avg_opportunity_score: number;
    }>;
    price_band_metrics: Array<{
        key: string;
        label: string;
        count: number;
        sample_count: number;
        triggered_coverage_pct: number;
        watch_coverage_pct: number;
        riskoff_coverage_pct: number;
        avg_opportunity_score: number;
    }>;
};

function num(value: unknown, fallback = 0): number {
    if (value === null || value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function quantile(values: number[], q: number): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
    return sorted[idx];
}

async function queryRows(client: Client, sql: string, args: Array<string | number> = []): Promise<DbRow[]> {
    const res = await client.execute({ sql, args });
    return res.rows as DbRow[];
}

function queryRowsLocal(db: Database.Database, sql: string, args: Array<string | number> = []): DbRow[] {
    return db.prepare(sql).all(...args) as DbRow[];
}

function queryOneLocal(db: Database.Database, sql: string, args: Array<string | number> = []): DbRow | null {
    return (db.prepare(sql).get(...args) as DbRow | undefined) ?? null;
}

async function queryOne(client: Client, sql: string, args: Array<string | number> = []): Promise<DbRow | null> {
    const rows = await queryRows(client, sql, args);
    return rows[0] ?? null;
}

function resolveRepoPath(relativePath: string): string {
    const cwd = process.cwd();
    const repoRoot = cwd.endsWith('/frontend') ? path.resolve(cwd, '..') : cwd;
    return path.resolve(repoRoot, relativePath);
}

function loadManifestSymbols(manifestPath: string): { pool_name: string; target_size: number; actual_size: number; latest_reference_date: string | null; symbols: string[] } {
    const raw = fs.readFileSync(resolveRepoPath(manifestPath), 'utf-8');
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const symbols = Array.isArray(payload.symbols)
        ? payload.symbols
            .map((item) => {
                if (!item || typeof item !== 'object') return null;
                const symbol = (item as Record<string, unknown>).symbol;
                return typeof symbol === 'string' ? symbol : null;
            })
            .filter((item): item is string => Boolean(item))
        : [];
    return {
        pool_name: typeof payload.pool_name === 'string' ? payload.pool_name : 'research_pool',
        target_size: typeof payload.target_size === 'number' ? payload.target_size : symbols.length,
        actual_size: typeof payload.actual_size === 'number' ? payload.actual_size : symbols.length,
        latest_reference_date: typeof payload.latest_reference_date === 'string' ? payload.latest_reference_date : null,
        symbols,
    };
}

function labelBoardGroup(key: string): string {
    if (key === 'sh_main') return '沪市主板';
    if (key === 'sz_main') return '深市主板';
    if (key === 'sz_growth') return '深市成长';
    if (key === 'chinext') return '创业板';
    if (key === 'star') return '科创板';
    return key;
}

function labelPriceBand(key: string): string {
    if (key === 'lt10') return '10 元以下';
    if (key === '10to30') return '10-30 元';
    if (key === '30to80') return '30-80 元';
    if (key === 'ge80') return '80 元以上';
    return key;
}

function summarizeManifestDistribution(manifestPath: string): Pick<ResearchPoolSummary, 'board_groups' | 'price_bands'> {
    const raw = fs.readFileSync(resolveRepoPath(manifestPath), 'utf-8');
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const symbols = Array.isArray(payload.symbols) ? payload.symbols : [];
    const boardCounts = new Map<string, number>();
    const bandCounts = new Map<string, number>();
    for (const item of symbols) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;
        const board = typeof row.board_group === 'string' ? row.board_group : 'unknown';
        const band = typeof row.price_band === 'string' ? row.price_band : 'unknown';
        boardCounts.set(board, (boardCounts.get(board) || 0) + 1);
        bandCounts.set(band, (bandCounts.get(band) || 0) + 1);
    }
    return {
        board_groups: [...boardCounts.entries()]
            .map(([key, count]) => ({ key, label: labelBoardGroup(key), count }))
            .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
        price_bands: [...bandCounts.entries()]
            .map(([key, count]) => ({ key, label: labelPriceBand(key), count }))
            .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    };
}

type SegmentMetric = {
    key: string;
    label: string;
    count: number;
    sample_count: number;
    triggered_coverage_pct: number;
    watch_coverage_pct: number;
    riskoff_coverage_pct: number;
    avg_opportunity_score: number;
};

function loadSegmentManifestMap(dirPath: string): Record<string, { label: string; count: number; symbols: string[] }> {
    const absDir = resolveRepoPath(dirPath);
    if (!fs.existsSync(absDir)) return {};
    const files = fs.readdirSync(absDir).filter((name) => name.endsWith('.json'));
    const output: Record<string, { label: string; count: number; symbols: string[] }> = {};
    for (const file of files) {
        const raw = fs.readFileSync(path.join(absDir, file), 'utf-8');
        const payload = JSON.parse(raw) as Record<string, unknown>;
        const dimension = typeof payload.dimension === 'string' ? payload.dimension : '';
        const segment = typeof payload.segment === 'string' ? payload.segment : '';
        const symbols = Array.isArray(payload.symbols)
            ? payload.symbols
                .map((item) => {
                    if (!item || typeof item !== 'object') return null;
                    const symbol = (item as Record<string, unknown>).symbol;
                    return typeof symbol === 'string' ? symbol : null;
                })
                .filter((item): item is string => Boolean(item))
            : [];
        const label = dimension === 'board_group' ? labelBoardGroup(segment) : labelPriceBand(segment);
        output[file.replace(/\.json$/, '')] = { label, count: symbols.length, symbols };
    }
    return output;
}

async function querySegmentMetricCloud(client: Client, market: string, latestDate: string | null, strategyVersion: string, symbols: string[]): Promise<Omit<SegmentMetric, 'key' | 'label' | 'count'>> {
    if (!latestDate || !symbols.length) {
        return { sample_count: 0, triggered_coverage_pct: 0, watch_coverage_pct: 0, riskoff_coverage_pct: 0, avg_opportunity_score: 0 };
    }
    const placeholders = symbols.map(() => '?').join(',');
    const row = await queryOne(
        client,
        `SELECT
            COUNT(*) AS sample_count,
            SUM(CASE WHEN setup_state = 'TriggeredLong' THEN 1 ELSE 0 END) AS triggered_count,
            SUM(CASE WHEN setup_state = 'Watch' THEN 1 ELSE 0 END) AS watch_count,
            SUM(CASE WHEN setup_state = 'RiskOff' THEN 1 ELSE 0 END) AS riskoff_count,
            AVG(opportunity_score) AS avg_opportunity_score
         FROM quant_tradeability_signals
         WHERE market = ?
           AND date = ?
           AND strategy_version = ?
           AND symbol IN (${placeholders})`,
        [market, latestDate, strategyVersion, ...symbols],
    );
    const sample = num(row?.sample_count);
    const triggered = num(row?.triggered_count);
    const watch = num(row?.watch_count);
    const riskoff = num(row?.riskoff_count);
    return {
        sample_count: sample,
        triggered_coverage_pct: sample ? triggered / sample : 0,
        watch_coverage_pct: sample ? watch / sample : 0,
        riskoff_coverage_pct: sample ? riskoff / sample : 0,
        avg_opportunity_score: num(row?.avg_opportunity_score, 0),
    };
}

function querySegmentMetricLocal(db: Database.Database, market: string, latestDate: string | null, strategyVersion: string, symbols: string[]): Omit<SegmentMetric, 'key' | 'label' | 'count'> {
    if (!latestDate || !symbols.length) {
        return { sample_count: 0, triggered_coverage_pct: 0, watch_coverage_pct: 0, riskoff_coverage_pct: 0, avg_opportunity_score: 0 };
    }
    const placeholders = symbols.map(() => '?').join(',');
    const row = queryOneLocal(
        db,
        `SELECT
            COUNT(*) AS sample_count,
            SUM(CASE WHEN setup_state = 'TriggeredLong' THEN 1 ELSE 0 END) AS triggered_count,
            SUM(CASE WHEN setup_state = 'Watch' THEN 1 ELSE 0 END) AS watch_count,
            SUM(CASE WHEN setup_state = 'RiskOff' THEN 1 ELSE 0 END) AS riskoff_count,
            AVG(opportunity_score) AS avg_opportunity_score
         FROM quant_tradeability_signals
         WHERE market = ?
           AND date = ?
           AND strategy_version = ?
           AND symbol IN (${placeholders})`,
        [market, latestDate, strategyVersion, ...symbols],
    );
    const sample = num(row?.sample_count);
    const triggered = num(row?.triggered_count);
    const watch = num(row?.watch_count);
    const riskoff = num(row?.riskoff_count);
    return {
        sample_count: sample,
        triggered_coverage_pct: sample ? triggered / sample : 0,
        watch_coverage_pct: sample ? watch / sample : 0,
        riskoff_coverage_pct: sample ? riskoff / sample : 0,
        avg_opportunity_score: num(row?.avg_opportunity_score, 0),
    };
}

async function queryCountForSymbols(client: Client, table: 'daily_prices' | 'quant_tradeability_signals', market: string, dateColumn: string, latestDate: string | null, symbols: string[]): Promise<number> {
    if (!latestDate || !symbols.length) return 0;
    const placeholders = symbols.map(() => '?').join(',');
    const rows = await queryRows(
        client,
        `SELECT COUNT(DISTINCT dp.symbol) AS value
         FROM ${table} dp
         JOIN stock_meta sm ON sm.symbol = dp.symbol
         WHERE sm.market = ?
           AND dp.${dateColumn} = ?
           AND dp.symbol IN (${placeholders})`,
        [market, latestDate, ...symbols],
    );
    return num(rows[0]?.value);
}

function queryCountForSymbolsLocal(db: Database.Database, table: 'daily_prices' | 'quant_tradeability_signals', market: string, dateColumn: string, latestDate: string | null, symbols: string[]): number {
    if (!latestDate || !symbols.length) return 0;
    const placeholders = symbols.map(() => '?').join(',');
    const row = queryOneLocal(
        db,
        `SELECT COUNT(DISTINCT dp.symbol) AS value
         FROM ${table} dp
         JOIN stock_meta sm ON sm.symbol = dp.symbol
         WHERE sm.market = ?
           AND dp.${dateColumn} = ?
           AND dp.symbol IN (${placeholders})`,
        [market, latestDate, ...symbols],
    );
    return num(row?.value);
}

function parseSummaryJson(raw: unknown): Record<string, unknown> {
    if (typeof raw !== 'string' || !raw) return {};
    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return {};
    }
}

function stateHighBad(value: number, warn: number, critical: number): AlertState {
    if (value >= critical) return 'critical';
    if (value >= warn) return 'warn';
    return 'ok';
}

function stateLowBad(value: number, warn: number, critical: number): AlertState {
    if (value <= critical) return 'critical';
    if (value <= warn) return 'warn';
    return 'ok';
}

function mapOutcomeToGate(outcome: string | null, hasBlockingReasons: boolean): GateStatus {
    const normalized = (outcome || '').toLowerCase();
    if (normalized === 'pass') return 'PASS';
    if (normalized === 'fail') return 'FAIL';
    return hasBlockingReasons ? 'FAIL' : 'HOLD';
}

function formatResearchMetric(row: DbRow): ResearchMetric {
    const sampleCount = num(row.sample_count);
    const triggeredCount = num(row.triggered_count);
    const watchCount = num(row.watch_count);
    const riskoffCount = num(row.riskoff_count);
    return {
        strategy_version: String(row.strategy_version || ''),
        sample_count: sampleCount,
        triggered_count: triggeredCount,
        watch_count: watchCount,
        riskoff_count: riskoffCount,
        triggered_coverage_pct: sampleCount ? triggeredCount / sampleCount : 0,
        watch_coverage_pct: sampleCount ? watchCount / sampleCount : 0,
        riskoff_coverage_pct: sampleCount ? riskoffCount / sampleCount : 0,
        avg_opportunity_score: num(row.avg_opportunity_score),
        latest_date: row.latest_date ? String(row.latest_date) : null,
    };
}

export async function GET(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    const strategy = process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local';
    const client = getDbClient();
    const defaultMode = getModeDefinition(DEFAULT_MODE_ID);
    const configuredStrategyVersion = defaultMode?.strategy_mapping.strategy_version || 'tradeability_v2';
    const cnResearchManifestPath = 'backend/strategy_config/research_pool/cn_core_500.json';
    const cnResearchSegmentDir = 'backend/strategy_config/research_pool/cn_core_500_segments';
    const cnResearchPool = loadManifestSymbols(cnResearchManifestPath);
    const cnResearchDistribution = summarizeManifestDistribution(cnResearchManifestPath);
    const cnResearchSegments = loadSegmentManifestMap(cnResearchSegmentDir);

    const latencySeriesSql = `
        SELECT latency_ms
        FROM llm_traces
        WHERE latency_ms > 0 AND datetime(created_at) >= datetime('now', '-24 hours')
        ORDER BY created_at DESC
        LIMIT 2000
    `;
    const confidenceSeriesSql = `
        SELECT confidence
        FROM ai_predictions_v2
        WHERE confidence IS NOT NULL
          AND is_primary = 1
          AND date >= date('now', '-6 day')
    `;
    const modeDailySql = `
        SELECT date,
               COUNT(*) AS total_runs,
               SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_runs,
               SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_runs
        FROM task_logs
        WHERE date >= date('now', '-13 day')
          AND task_name = 'Investment Mode Pipeline'
        GROUP BY date
        ORDER BY date ASC
    `;

    const latestDatesSql = {
        prices: `SELECT MAX(date) AS value FROM daily_prices`,
        predictions: `SELECT MAX(date) AS value FROM ai_predictions_v2`,
        modeSnapshots: `SELECT MAX(as_of_date) AS value FROM mode_performance_snapshot`,
    };

    const latestVerdictSql = `
        SELECT market, candidate_version, baseline_version, outcome_status, actor, created_at, summary_json
        FROM promotion_audit_log
        WHERE event_type = 'verdict' AND market = ?
        ORDER BY created_at DESC
        LIMIT 1
    `;

    const auditTimelineSql = `
        SELECT event_type, market, candidate_version, baseline_version, outcome_status, actor, created_at, summary_json
        FROM promotion_audit_log
        WHERE (market = ? OR market IS NULL OR market = '')
        ORDER BY created_at DESC
        LIMIT 12
    `;

    const latestQtsDateSql = `
        SELECT MAX(date) AS latest_date
        FROM quant_tradeability_signals
        WHERE market = ?
    `;

    const researchMetricsSql = `
        SELECT strategy_version,
               COUNT(*) AS sample_count,
               SUM(CASE WHEN setup_state = 'TriggeredLong' THEN 1 ELSE 0 END) AS triggered_count,
               SUM(CASE WHEN setup_state = 'Watch' THEN 1 ELSE 0 END) AS watch_count,
               SUM(CASE WHEN setup_state = 'RiskOff' THEN 1 ELSE 0 END) AS riskoff_count,
               AVG(opportunity_score) AS avg_opportunity_score,
               MAX(date) AS latest_date
        FROM quant_tradeability_signals
        WHERE market = ?
          AND date >= ?
        GROUP BY strategy_version
        ORDER BY strategy_version ASC
    `;

    const primaryVersionsSql = `
        SELECT COALESCE(NULLIF(layer1_strategy_version, ''), 'tradeability_v2') AS strategy_version,
               COUNT(*) AS sample_count
        FROM ai_predictions_v2
        WHERE is_primary = 1
          AND date >= ?
        GROUP BY COALESCE(NULLIF(layer1_strategy_version, ''), 'tradeability_v2')
        ORDER BY sample_count DESC, strategy_version ASC
    `;

    const latestSnapshotsSql = `
        SELECT mode_id, scope, horizon, segment_key, coverage, hit_rate, max_drawdown, sample_size, payoff_ratio, stability_score, as_of_date
        FROM mode_performance_snapshot
        WHERE scope = 'universal'
          AND segment_key = 'all'
          AND as_of_date = ?
        ORDER BY
          CASE horizon WHEN '30d' THEN 0 WHEN '7d' THEN 1 ELSE 2 END,
          mode_id ASC
    `;

    try {
        let latencyRows: DbRow[] = [];
        let confidenceRows: DbRow[] = [];
        let modeRows: DbRow[] = [];
        let latestPricesRow: DbRow | null = null;
        let latestPredictionsRow: DbRow | null = null;
        let latestModeSnapshotsRow: DbRow | null = null;
        let cnVerdictRow: DbRow | null = null;
        let hkVerdictRow: DbRow | null = null;
        let cnAuditRows: DbRow[] = [];
        let hkAuditRows: DbRow[] = [];
        let cnLatestDateRow: DbRow | null = null;
        let hkLatestDateRow: DbRow | null = null;
        let primaryVersionRows: DbRow[] = [];
        let latestSnapshotRows: DbRow[] = [];
        let cnResearchPoolSummary: ResearchPoolSummary = {
            manifest_path: cnResearchManifestPath,
            pool_name: cnResearchPool.pool_name,
            target_size: cnResearchPool.target_size,
            actual_size: cnResearchPool.actual_size,
            latest_reference_date: cnResearchPool.latest_reference_date,
            latest_price_coverage_count: 0,
            latest_signal_coverage_count: 0,
            board_groups: cnResearchDistribution.board_groups,
            price_bands: cnResearchDistribution.price_bands,
            board_group_metrics: [],
            price_band_metrics: [],
        };

        if (strategy === 'cloud') {
            const db = client as Client;
            [
                latencyRows,
                confidenceRows,
                modeRows,
                latestPricesRow,
                latestPredictionsRow,
                latestModeSnapshotsRow,
                cnVerdictRow,
                hkVerdictRow,
                cnAuditRows,
                hkAuditRows,
                cnLatestDateRow,
                hkLatestDateRow,
            ] = await Promise.all([
                queryRows(db, latencySeriesSql),
                queryRows(db, confidenceSeriesSql),
                queryRows(db, modeDailySql),
                queryOne(db, latestDatesSql.prices),
                queryOne(db, latestDatesSql.predictions),
                queryOne(db, latestDatesSql.modeSnapshots),
                queryOne(db, latestVerdictSql, ['CN']),
                queryOne(db, latestVerdictSql, ['HK']),
                queryRows(db, auditTimelineSql, ['CN']),
                queryRows(db, auditTimelineSql, ['HK']),
                queryOne(db, latestQtsDateSql, ['CN']),
                queryOne(db, latestQtsDateSql, ['HK']),
            ]);

            const latestPredictionDate = String(latestPredictionsRow?.value || '');
            primaryVersionRows = latestPredictionDate
                ? await queryRows(db, primaryVersionsSql, [shiftDate(latestPredictionDate, -6)])
                : [];

            const latestSnapshotDate = String(latestModeSnapshotsRow?.value || '');
            latestSnapshotRows = latestSnapshotDate
                ? await queryRows(db, latestSnapshotsSql, [latestSnapshotDate])
                : [];

            const cnLatestDate = String(cnLatestDateRow?.latest_date || '');
            const hkLatestDate = String(hkLatestDateRow?.latest_date || '');
            const [cnResearchRows, hkResearchRows] = await Promise.all([
                cnLatestDate ? queryRows(db, researchMetricsSql, ['CN', shiftDate(cnLatestDate, -6)]) : Promise.resolve([]),
                hkLatestDate ? queryRows(db, researchMetricsSql, ['HK', shiftDate(hkLatestDate, -6)]) : Promise.resolve([]),
            ]);
            cnResearchPoolSummary = {
                ...cnResearchPoolSummary,
                latest_price_coverage_count: await queryCountForSymbols(db, 'daily_prices', 'CN', 'date', latestPricesRow?.value ? String(latestPricesRow.value) : null, cnResearchPool.symbols),
                latest_signal_coverage_count: await queryCountForSymbols(db, 'quant_tradeability_signals', 'CN', 'date', cnLatestDate || null, cnResearchPool.symbols),
                board_group_metrics: (await Promise.all(
                    Object.entries(cnResearchSegments)
                        .filter(([key]) => key.startsWith('board_group_'))
                        .map(async ([key, segment]) => ({
                            key,
                            label: segment.label,
                            count: segment.count,
                            ...(await querySegmentMetricCloud(db, 'CN', cnLatestDate || null, configuredStrategyVersion, segment.symbols)),
                        })),
                )).sort((a, b) => b.triggered_coverage_pct - a.triggered_coverage_pct || b.sample_count - a.sample_count),
                price_band_metrics: (await Promise.all(
                    Object.entries(cnResearchSegments)
                        .filter(([key]) => key.startsWith('price_band_'))
                        .map(async ([key, segment]) => ({
                            key,
                            label: segment.label,
                            count: segment.count,
                            ...(await querySegmentMetricCloud(db, 'CN', cnLatestDate || null, configuredStrategyVersion, segment.symbols)),
                        })),
                )).sort((a, b) => b.triggered_coverage_pct - a.triggered_coverage_pct || b.sample_count - a.sample_count),
            };

            return buildResponse({
                strategy,
                configuredStrategyVersion,
                defaultModeName: defaultMode?.name || DEFAULT_MODE_ID,
                defaultModeTagline: defaultMode?.tagline || '',
                latencyRows,
                confidenceRows,
                modeRows,
                latestPrices: latestPricesRow?.value ? String(latestPricesRow.value) : null,
                latestPredictions: latestPredictionsRow?.value ? String(latestPredictionsRow.value) : null,
                latestModeSnapshots: latestModeSnapshotsRow?.value ? String(latestModeSnapshotsRow.value) : null,
                latestSnapshotRows,
                primaryVersionRows,
                researchPool: cnResearchPoolSummary,
                markets: {
                    CN: { verdictRow: cnVerdictRow, auditRows: cnAuditRows, researchRows: cnResearchRows },
                    HK: { verdictRow: hkVerdictRow, auditRows: hkAuditRows, researchRows: hkResearchRows },
                },
            });
        }

        const db = client as Database.Database;
        latencyRows = queryRowsLocal(db, latencySeriesSql);
        confidenceRows = queryRowsLocal(db, confidenceSeriesSql);
        modeRows = queryRowsLocal(db, modeDailySql);
        latestPricesRow = queryOneLocal(db, latestDatesSql.prices);
        latestPredictionsRow = queryOneLocal(db, latestDatesSql.predictions);
        latestModeSnapshotsRow = queryOneLocal(db, latestDatesSql.modeSnapshots);
        cnVerdictRow = queryOneLocal(db, latestVerdictSql, ['CN']);
        hkVerdictRow = queryOneLocal(db, latestVerdictSql, ['HK']);
        cnAuditRows = queryRowsLocal(db, auditTimelineSql, ['CN']);
        hkAuditRows = queryRowsLocal(db, auditTimelineSql, ['HK']);
        cnLatestDateRow = queryOneLocal(db, latestQtsDateSql, ['CN']);
        hkLatestDateRow = queryOneLocal(db, latestQtsDateSql, ['HK']);

        const latestPredictionDate = String(latestPredictionsRow?.value || '');
        primaryVersionRows = latestPredictionDate ? queryRowsLocal(db, primaryVersionsSql, [shiftDate(latestPredictionDate, -6)]) : [];
        const latestSnapshotDate = String(latestModeSnapshotsRow?.value || '');
        latestSnapshotRows = latestSnapshotDate ? queryRowsLocal(db, latestSnapshotsSql, [latestSnapshotDate]) : [];

        const cnLatestDate = String(cnLatestDateRow?.latest_date || '');
        const hkLatestDate = String(hkLatestDateRow?.latest_date || '');
        const cnResearchRows = cnLatestDate ? queryRowsLocal(db, researchMetricsSql, ['CN', shiftDate(cnLatestDate, -6)]) : [];
        const hkResearchRows = hkLatestDate ? queryRowsLocal(db, researchMetricsSql, ['HK', shiftDate(hkLatestDate, -6)]) : [];
        cnResearchPoolSummary = {
            ...cnResearchPoolSummary,
            latest_price_coverage_count: queryCountForSymbolsLocal(db, 'daily_prices', 'CN', 'date', latestPricesRow?.value ? String(latestPricesRow.value) : null, cnResearchPool.symbols),
            latest_signal_coverage_count: queryCountForSymbolsLocal(db, 'quant_tradeability_signals', 'CN', 'date', cnLatestDate || null, cnResearchPool.symbols),
            board_group_metrics: Object.entries(cnResearchSegments)
                .filter(([key]) => key.startsWith('board_group_'))
                .map(([key, segment]) => ({
                    key,
                    label: segment.label,
                    count: segment.count,
                    ...querySegmentMetricLocal(db, 'CN', cnLatestDate || null, configuredStrategyVersion, segment.symbols),
                }))
                .sort((a, b) => b.triggered_coverage_pct - a.triggered_coverage_pct || b.sample_count - a.sample_count),
            price_band_metrics: Object.entries(cnResearchSegments)
                .filter(([key]) => key.startsWith('price_band_'))
                .map(([key, segment]) => ({
                    key,
                    label: segment.label,
                    count: segment.count,
                    ...querySegmentMetricLocal(db, 'CN', cnLatestDate || null, configuredStrategyVersion, segment.symbols),
                }))
                .sort((a, b) => b.triggered_coverage_pct - a.triggered_coverage_pct || b.sample_count - a.sample_count),
        };

        db.close();

        return buildResponse({
            strategy,
            configuredStrategyVersion,
            defaultModeName: defaultMode?.name || DEFAULT_MODE_ID,
            defaultModeTagline: defaultMode?.tagline || '',
            latencyRows,
            confidenceRows,
            modeRows,
            latestPrices: latestPricesRow?.value ? String(latestPricesRow.value) : null,
            latestPredictions: latestPredictionsRow?.value ? String(latestPredictionsRow.value) : null,
            latestModeSnapshots: latestModeSnapshotsRow?.value ? String(latestModeSnapshotsRow.value) : null,
            latestSnapshotRows,
            primaryVersionRows,
            researchPool: cnResearchPoolSummary,
            markets: {
                CN: { verdictRow: cnVerdictRow, auditRows: cnAuditRows, researchRows: cnResearchRows },
                HK: { verdictRow: hkVerdictRow, auditRows: hkAuditRows, researchRows: hkResearchRows },
            },
        });
    } catch (error) {
        console.error('Failed to fetch admin tradeability data:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

function shiftDate(date: string, deltaDays: number): string {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return date;
    parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
    return parsed.toISOString().slice(0, 10);
}

function buildResponse(input: {
    strategy: string;
    configuredStrategyVersion: string;
    defaultModeName: string;
    defaultModeTagline: string;
    latencyRows: DbRow[];
    confidenceRows: DbRow[];
    modeRows: DbRow[];
    latestPrices: string | null;
    latestPredictions: string | null;
    latestModeSnapshots: string | null;
    latestSnapshotRows: DbRow[];
    primaryVersionRows: DbRow[];
    researchPool: ResearchPoolSummary;
    markets: Record<string, { verdictRow: DbRow | null; auditRows: DbRow[]; researchRows: DbRow[] }>;
}) {
    const latencies = input.latencyRows.map((row) => num(row.latency_ms)).filter((value) => value > 0);
    const latencyP95 = quantile(latencies, 0.95);

    const confidenceValues = input.confidenceRows
        .map((row) => num(row.confidence, Number.NaN))
        .filter((value) => Number.isFinite(value));
    const confidenceLowRatio = confidenceValues.length
        ? confidenceValues.filter((value) => value < 0.6).length / confidenceValues.length
        : 0;

    const totalRuns = input.modeRows.reduce((acc, row) => acc + num(row.total_runs), 0);
    const successRuns = input.modeRows.reduce((acc, row) => acc + num(row.success_runs), 0);
    const modeSuccessRate = totalRuns ? successRuns / totalRuns : 0;

    const apiState = latencies.length < 20 ? 'warn' : stateHighBad(latencyP95, 5000, 8000);
    const confidenceState = confidenceValues.length < 50 ? 'warn' : stateHighBad(confidenceLowRatio, 0.35, 0.5);
    const modeState = totalRuns < 3 ? 'warn' : stateLowBad(modeSuccessRate, 0.95, 0.9);
    const overallState: AlertState = [apiState, confidenceState, modeState].includes('critical')
        ? 'critical'
        : ([apiState, confidenceState, modeState].includes('warn') ? 'warn' : 'ok');

    const mode30d = input.latestSnapshotRows
        .filter((row) => String(row.horizon || '') === '30d')
        .map((row) => ({
            mode_id: String(row.mode_id || ''),
            horizon: String(row.horizon || ''),
            hit_rate: num(row.hit_rate, Number.NaN),
            coverage: num(row.coverage, Number.NaN),
            max_drawdown: num(row.max_drawdown, Number.NaN),
            sample_size: num(row.sample_size),
            payoff_ratio: row.payoff_ratio === null ? null : num(row.payoff_ratio, Number.NaN),
            stability_score: row.stability_score === null ? null : num(row.stability_score, Number.NaN),
            as_of_date: row.as_of_date ? String(row.as_of_date) : null,
        }));

    const defaultModeHorizonRows = input.latestSnapshotRows
        .filter((row) => String(row.mode_id || '') === DEFAULT_MODE_ID)
        .map((row) => ({
            horizon: String(row.horizon || ''),
            hit_rate: num(row.hit_rate, Number.NaN),
            coverage: num(row.coverage, Number.NaN),
            max_drawdown: num(row.max_drawdown, Number.NaN),
            sample_size: num(row.sample_size),
            payoff_ratio: row.payoff_ratio === null ? null : num(row.payoff_ratio, Number.NaN),
            stability_score: row.stability_score === null ? null : num(row.stability_score, Number.NaN),
            as_of_date: row.as_of_date ? String(row.as_of_date) : null,
        }));

    const markets = Object.entries(input.markets).map(([market, payload]) => {
        const verdictSummary = parseSummaryJson(payload.verdictRow?.summary_json);
        const blockingReasons = Array.isArray(verdictSummary.blocking_reasons)
            ? verdictSummary.blocking_reasons.map((item) => String(item))
            : [];
        const gateStatus = mapOutcomeToGate(
            payload.verdictRow?.outcome_status ? String(payload.verdictRow.outcome_status) : null,
            blockingReasons.length > 0,
        );

        const researchMetrics = payload.researchRows.map(formatResearchMetric);
        const candidateVersion =
            String(payload.verdictRow?.candidate_version || verdictSummary.candidate_version || input.configuredStrategyVersion);
        const baselineVersion = String(payload.verdictRow?.baseline_version || verdictSummary.baseline_version || 'tradeability_v1');

        const recentActions = payload.auditRows.map((row) => {
            const summary = parseSummaryJson(row.summary_json);
            return {
                event_type: String(row.event_type || ''),
                market: row.market ? String(row.market) : '',
                outcome_status: String(row.outcome_status || ''),
                actor: row.actor ? String(row.actor) : null,
                created_at: row.created_at ? String(row.created_at) : null,
                candidate_version: row.candidate_version ? String(row.candidate_version) : null,
                baseline_version: row.baseline_version ? String(row.baseline_version) : null,
                reason: summary.reason ? String(summary.reason) : null,
                approval_id: summary.approval_id ? String(summary.approval_id) : null,
                rollback_to_version: summary.rollback_to_version ? String(summary.rollback_to_version) : null,
            };
        });

        return {
            market,
            verdict: {
                gate_status: gateStatus,
                candidate_version: candidateVersion,
                baseline_version: baselineVersion,
                pass_streak_weeks: num(verdictSummary.pass_streak_weeks),
                recommended_action: verdictSummary.recommended_action ? String(verdictSummary.recommended_action) : null,
                blocking_reasons: blockingReasons,
                latest_week_end: verdictSummary.latest_week_end ? String(verdictSummary.latest_week_end) : null,
                verdict_created_at: payload.verdictRow?.created_at ? String(payload.verdictRow.created_at) : null,
                default_mode_id: verdictSummary.default_mode_id ? String(verdictSummary.default_mode_id) : DEFAULT_MODE_ID,
                core_mode_gate_pass: Boolean(verdictSummary.core_mode_gate_pass),
                core_mode_governance: Object.entries((verdictSummary.core_mode_effects || {}) as Record<string, unknown>).map(
                    ([modeId, raw]) => {
                        const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
                        const effect = row.effect && typeof row.effect === 'object'
                            ? (row.effect as Record<string, unknown>)
                            : null;
                        const gates = row.gates && typeof row.gates === 'object'
                            ? (row.gates as Record<string, unknown>)
                            : {};
                        const modeBlockingReasons = Array.isArray(row.blocking_reasons)
                            ? row.blocking_reasons.map((item) => String(item))
                            : [];
                        return {
                            mode_id: modeId,
                            is_core_mode: Boolean(row.is_core_mode),
                            is_default_mode: Boolean(row.is_default_mode),
                            excluded_from_promotion: Boolean(row.excluded_from_promotion),
                            exclusion_reason: row.reason ? String(row.reason) : null,
                            gate_pass: Boolean(row.gate_pass),
                            blocking_reasons: modeBlockingReasons,
                            as_of_date: effect?.as_of_date ? String(effect.as_of_date) : null,
                            hit_rate: effect?.hit_rate == null ? null : num(effect.hit_rate, Number.NaN),
                            max_drawdown: effect?.max_drawdown == null ? null : num(effect.max_drawdown, Number.NaN),
                            sample_size: effect?.sample_size == null ? 0 : num(effect.sample_size),
                            payoff_ratio: effect?.payoff_ratio == null ? null : num(effect.payoff_ratio, Number.NaN),
                            stability_score: effect?.stability_score == null ? null : num(effect.stability_score, Number.NaN),
                            gates: Object.fromEntries(
                                Object.entries(gates).map(([key, value]) => [key, value === null ? null : Boolean(value)])
                            ),
                        };
                    }
                ).sort((a, b) => {
                    if (a.excluded_from_promotion !== b.excluded_from_promotion) return a.excluded_from_promotion ? 1 : -1;
                    if (a.is_default_mode !== b.is_default_mode) return a.is_default_mode ? -1 : 1;
                    return a.mode_id.localeCompare(b.mode_id);
                }),
            },
            research: {
                metrics_7d: researchMetrics,
                candidate_metric: researchMetrics.find((item) => item.strategy_version === candidateVersion) || null,
                baseline_metric: researchMetrics.find((item) => item.strategy_version === baselineVersion) || null,
            },
            promotion: {
                timeline: recentActions,
            },
        };
    });

    return NextResponse.json({
        generated_at: new Date().toISOString(),
        db_strategy: input.strategy,
        summary: {
            production_health: overallState,
            configured_strategy_version: input.configuredStrategyVersion,
            active_primary_versions_7d: input.primaryVersionRows.map((row) => ({
                strategy_version: String(row.strategy_version || ''),
                sample_count: num(row.sample_count),
            })),
            latest_prices_date: input.latestPrices,
            latest_prediction_date: input.latestPredictions,
            latest_mode_snapshot_date: input.latestModeSnapshots,
            api_latency_p95_ms_24h: Number(latencyP95.toFixed(2)),
            confidence_low_ratio_7d: Number(confidenceLowRatio.toFixed(4)),
            mode_pipeline_success_rate_14d: Number(modeSuccessRate.toFixed(4)),
            default_mode_id: DEFAULT_MODE_ID,
            research_pool: input.researchPool,
        },
        production: {
            default_mode_id: DEFAULT_MODE_ID,
            default_mode_name: input.defaultModeName,
            default_mode_tagline: input.defaultModeTagline,
            default_mode_horizons: defaultModeHorizonRows,
            latest_mode_30d: mode30d,
        },
        markets,
    });
}
