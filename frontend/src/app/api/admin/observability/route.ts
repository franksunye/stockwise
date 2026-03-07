import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';

type NumRecord = Record<string, string | number | null>;
type AlertState = 'ok' | 'warn' | 'critical';

const OBS_THRESHOLDS = {
    api_latency_p95_ms: { warn: 5000, critical: 8000 },
    api_latency_min_samples_24h: 20,
    confidence_low_ratio_7d: { warn: 0.35, critical: 0.5 },
    confidence_min_samples_7d: 50,
    mode_pipeline_success_rate_14d: { warn: 0.95, critical: 0.9 },
    mode_pipeline_min_runs_14d: 3,
} as const;

const ANOMALY_DEFINITIONS = {
    api_latency_p95_ms: 'P95 latency exceeds threshold, indicating API degradation risk.',
    confidence_low_ratio_7d: 'Large share of low-confidence outputs (<0.6), indicating model confidence drift.',
    mode_pipeline_success_rate_14d: 'Mode pipeline success rate dropped, indicating production data pipeline instability.',
} as const;

function num(v: unknown, fallback = 0): number {
    if (v === null || v === undefined) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function quantile(values: number[], q: number): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
    return sorted[idx];
}

async function queryRows(client: Client, sql: string, args: Array<string | number> = []): Promise<NumRecord[]> {
    const res = await client.execute({ sql, args });
    return res.rows as NumRecord[];
}

function queryRowsLocal(db: Database.Database, sql: string, args: Array<string | number> = []): NumRecord[] {
    return db.prepare(sql).all(...args) as NumRecord[];
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

export async function GET(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    try {
        const strategy = process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local';
        const client = getDbClient();

        const latencySeriesSql = `
            SELECT latency_ms
            FROM llm_traces
            WHERE latency_ms > 0 AND datetime(created_at) >= datetime('now', '-24 hours')
            ORDER BY created_at DESC
            LIMIT 2000
        `;
        const latencyTrendSql = `
            SELECT date(created_at) AS date, AVG(latency_ms) AS avg_ms, MAX(latency_ms) AS p95_proxy_ms, COUNT(*) AS samples
            FROM llm_traces
            WHERE latency_ms > 0 AND date(created_at) >= date('now', '-6 day')
            GROUP BY date(created_at)
            ORDER BY date(created_at) ASC
        `;
        const confidenceSeriesSql = `
            SELECT date, confidence
            FROM ai_predictions_v2
            WHERE confidence IS NOT NULL
              AND is_primary = 1
              AND date >= date('now', '-6 day')
            ORDER BY date ASC
        `;
        const modeDailySql = `
            SELECT date,
                   COUNT(*) AS total_runs,
                   SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_runs,
                   SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_runs,
                   MAX(COALESCE(end_time, start_time, updated_at, created_at)) AS last_run_at
            FROM task_logs
            WHERE date >= date('now', '-13 day')
              AND (task_name LIKE '%Mode Pipeline%' OR task_name LIKE '%mode pipeline%')
            GROUP BY date
            ORDER BY date ASC
        `;

        let latencyRows: NumRecord[] = [];
        let latencyTrendRows: NumRecord[] = [];
        let confidenceRows: NumRecord[] = [];
        let modeRows: NumRecord[] = [];

        if (strategy === 'cloud') {
            const turso = client as Client;
            [latencyRows, latencyTrendRows, confidenceRows, modeRows] = await Promise.all([
                queryRows(turso, latencySeriesSql),
                queryRows(turso, latencyTrendSql),
                queryRows(turso, confidenceSeriesSql),
                queryRows(turso, modeDailySql),
            ]);
        } else {
            const db = client as Database.Database;
            latencyRows = queryRowsLocal(db, latencySeriesSql);
            latencyTrendRows = queryRowsLocal(db, latencyTrendSql);
            confidenceRows = queryRowsLocal(db, confidenceSeriesSql);
            modeRows = queryRowsLocal(db, modeDailySql);
            db.close();
        }

        const latencies = latencyRows.map(r => num(r.latency_ms)).filter(v => v > 0);
        const latencyAvg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
        const latencyP50 = quantile(latencies, 0.5);
        const latencyP95 = quantile(latencies, 0.95);

        const confidenceValues = confidenceRows.map(r => num(r.confidence, NaN)).filter(v => Number.isFinite(v));
        const confidenceAvg = confidenceValues.length ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length : 0;
        const confidenceHighRatio = confidenceValues.length ? confidenceValues.filter(v => v >= 0.8).length / confidenceValues.length : 0;
        const confidenceLowRatio = confidenceValues.length ? confidenceValues.filter(v => v < 0.6).length / confidenceValues.length : 0;

        const confidenceDailyMap: Record<string, number[]> = {};
        for (const row of confidenceRows) {
            const d = String(row.date || '');
            const c = num(row.confidence, NaN);
            if (!d || !Number.isFinite(c)) continue;
            if (!confidenceDailyMap[d]) confidenceDailyMap[d] = [];
            confidenceDailyMap[d].push(c);
        }
        const confidenceTrend = Object.keys(confidenceDailyMap).sort().map((d) => {
            const vals = confidenceDailyMap[d];
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            const hi = vals.filter(v => v >= 0.8).length / vals.length;
            const lo = vals.filter(v => v < 0.6).length / vals.length;
            return {
                date: d,
                avg_confidence: Number(avg.toFixed(4)),
                high_ratio: Number(hi.toFixed(4)),
                low_ratio: Number(lo.toFixed(4)),
                samples: vals.length,
            };
        });

        const totalRuns = modeRows.reduce((acc, row) => acc + num(row.total_runs), 0);
        const successRuns = modeRows.reduce((acc, row) => acc + num(row.success_runs), 0);
        const failedRuns = modeRows.reduce((acc, row) => acc + num(row.failed_runs), 0);
        const successRate = totalRuns > 0 ? successRuns / totalRuns : 0;
        const lastRunAt = modeRows.length ? String(modeRows[modeRows.length - 1].last_run_at || '') : null;

        const modeTrend = modeRows.map((row) => {
            const total = num(row.total_runs);
            const succ = num(row.success_runs);
            const fail = num(row.failed_runs);
            return {
                date: String(row.date || ''),
                total_runs: total,
                success_runs: succ,
                failed_runs: fail,
                success_rate: total > 0 ? Number((succ / total).toFixed(4)) : 0,
            };
        });

        const latencyState = stateHighBad(
            latencyP95,
            OBS_THRESHOLDS.api_latency_p95_ms.warn,
            OBS_THRESHOLDS.api_latency_p95_ms.critical,
        );
        const confidenceState = stateHighBad(
            confidenceLowRatio,
            OBS_THRESHOLDS.confidence_low_ratio_7d.warn,
            OBS_THRESHOLDS.confidence_low_ratio_7d.critical,
        );
        const modeState = stateLowBad(
            successRate,
            OBS_THRESHOLDS.mode_pipeline_success_rate_14d.warn,
            OBS_THRESHOLDS.mode_pipeline_success_rate_14d.critical,
        );
        const latencyStateFinal: AlertState = latencies.length < OBS_THRESHOLDS.api_latency_min_samples_24h ? 'warn' : latencyState;
        const confidenceStateFinal: AlertState = confidenceValues.length < OBS_THRESHOLDS.confidence_min_samples_7d ? 'warn' : confidenceState;
        const modeStateFinal: AlertState = totalRuns < OBS_THRESHOLDS.mode_pipeline_min_runs_14d ? 'warn' : modeState;
        const overallState: AlertState = [latencyStateFinal, confidenceStateFinal, modeStateFinal].includes('critical')
            ? 'critical'
            : ([latencyStateFinal, confidenceStateFinal, modeStateFinal].includes('warn') ? 'warn' : 'ok');

        const alerts = [
            {
                metric: 'api_latency_p95_ms',
                state: latencyStateFinal,
                value: Number(latencyP95.toFixed(2)),
                threshold: OBS_THRESHOLDS.api_latency_p95_ms,
                definition: ANOMALY_DEFINITIONS.api_latency_p95_ms,
                sample_guard: { min_samples: OBS_THRESHOLDS.api_latency_min_samples_24h, samples: latencies.length },
            },
            {
                metric: 'confidence_low_ratio_7d',
                state: confidenceStateFinal,
                value: Number(confidenceLowRatio.toFixed(4)),
                threshold: OBS_THRESHOLDS.confidence_low_ratio_7d,
                definition: ANOMALY_DEFINITIONS.confidence_low_ratio_7d,
                sample_guard: { min_samples: OBS_THRESHOLDS.confidence_min_samples_7d, samples: confidenceValues.length },
            },
            {
                metric: 'mode_pipeline_success_rate_14d',
                state: modeStateFinal,
                value: Number(successRate.toFixed(4)),
                threshold: OBS_THRESHOLDS.mode_pipeline_success_rate_14d,
                definition: ANOMALY_DEFINITIONS.mode_pipeline_success_rate_14d,
                sample_guard: { min_samples: OBS_THRESHOLDS.mode_pipeline_min_runs_14d, samples: totalRuns },
            },
        ];

        return NextResponse.json({
            generated_at: new Date().toISOString(),
            db_strategy: strategy,
            overall_state: overallState,
            thresholds: OBS_THRESHOLDS,
            anomaly_definitions: ANOMALY_DEFINITIONS,
            alerts,
            api_latency: {
                avg_ms_24h: Number(latencyAvg.toFixed(2)),
                p50_ms_24h: Number(latencyP50.toFixed(2)),
                p95_ms_24h: Number(latencyP95.toFixed(2)),
                samples_24h: latencies.length,
                trend_7d: latencyTrendRows.map((row) => ({
                    date: String(row.date || ''),
                    avg_ms: Number(num(row.avg_ms).toFixed(2)),
                    p95_proxy_ms: Number(num(row.p95_proxy_ms).toFixed(2)),
                    samples: num(row.samples),
                })),
            },
            ai_confidence: {
                avg_7d: Number(confidenceAvg.toFixed(4)),
                high_ratio_7d: Number(confidenceHighRatio.toFixed(4)),
                low_ratio_7d: Number(confidenceLowRatio.toFixed(4)),
                samples_7d: confidenceValues.length,
                trend_7d: confidenceTrend,
            },
            mode_pipeline: {
                success_rate_14d: Number(successRate.toFixed(4)),
                total_runs_14d: totalRuns,
                success_runs_14d: successRuns,
                failed_runs_14d: failedRuns,
                last_run_at: lastRunAt,
                trend_14d: modeTrend,
            },
        });
    } catch (error) {
        console.error('Failed to fetch observability metrics:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
