import type { Client } from '@libsql/client';
import type Database from 'better-sqlite3';
import {
    normalizeDecisionSemantic,
    normalizeLayer1Status,
    type DecisionSemantic,
    type SignalState,
} from '@/lib/semantic-registry';

export type UserTier = 'free' | 'pro';
export type RiskBand = 'low' | 'medium' | 'high';
export type Horizon = '7d' | '30d' | '90d';
export type PerformanceScope = 'universal' | 'pool';

export interface InvestmentModeDefinition {
    mode_id: string;
    name: string;
    tagline: string;
    risk_band: RiskBand;
    default_horizon: Horizon;
    strategy_mapping: {
        strategy_version: string;
        params_bundle: string;
    };
    display_policy: {
        primary_metrics: Array<'coverage' | 'hit_rate' | 'max_drawdown'>;
    };
    is_default: boolean;
    status: 'active' | 'shadow' | 'deprecated';
    effective_from: string;
    allowed_tiers: UserTier[];
}

export interface ModeCatalogItem extends InvestmentModeDefinition {
    is_available: boolean;
    is_locked: boolean;
}

export interface UserModeRecord {
    mode_id: string;
    updated_at: string | null;
    source: 'user_selection' | 'default_fallback';
}

export interface PerformanceSnapshotRecord {
    mode_id: string;
    scope: PerformanceScope;
    horizon: Horizon;
    segment_key: string;
    coverage: number | null;
    hit_rate: number | null;
    max_drawdown: number | null;
    sample_size: number;
    payoff_ratio: number | null;
    stability_score: number | null;
    as_of_date: string | null;
    computed_at: string | null;
}

export interface ModeLedgerItem {
    id: string;
    symbol: string;
    entry_date: string;
    exit_date: string | null;
    entry_price: number | null;
    exit_price: number | null;
    holding_days: number | null;
    trade_status: 'open' | 'closed';
    pnl_pct: number | null;
    max_drawdown_pct: number | null;
    rule_version: string | null;
}

export interface ModeDecisionItem {
    id: string;
    symbol: string;
    decision_date: string;
    decision_semantic: DecisionSemantic;
    strategy_version: string;
    layer1_status: SignalState | null;
    confidence: number | null;
    trigger_flags: string | null;
    reasoning_snapshot: string | null;
}

type DbClient = (Client | Database.Database) & { $type: 'cloud' | 'local' };

export const DEFAULT_MODE_ID = 'balanced_v1';
export const MODE_MIN_SAMPLE_SIZE = 30;
export const PERFORMANCE_DISCLAIMER =
    '历史表现不代表未来收益，模式仅提供决策参考，不构成个股买卖建议。';
export const INSUFFICIENT_SAMPLE_TEXT = '样本不足，不给结论';

const MODE_DEFINITIONS: InvestmentModeDefinition[] = [
    {
        mode_id: 'steady_v1',
        name: '稳健',
        tagline: '回撤优先，降低波动冲击',
        risk_band: 'low',
        default_horizon: '30d',
        strategy_mapping: { strategy_version: 'tradeability_v2', params_bundle: 'steady' },
        display_policy: { primary_metrics: ['coverage', 'hit_rate', 'max_drawdown'] },
        is_default: false,
        status: 'active',
        effective_from: '2026-03-07T00:00:00.000Z',
        allowed_tiers: ['pro'],
    },
    {
        mode_id: 'balanced_v1',
        name: '平衡',
        tagline: '覆盖与质量平衡，默认推荐',
        risk_band: 'medium',
        default_horizon: '30d',
        strategy_mapping: { strategy_version: 'tradeability_v2', params_bundle: 'balanced' },
        display_policy: { primary_metrics: ['coverage', 'hit_rate', 'max_drawdown'] },
        is_default: true,
        status: 'active',
        effective_from: '2026-03-07T00:00:00.000Z',
        allowed_tiers: ['free', 'pro'],
    },
    {
        mode_id: 'aggressive_v1',
        name: '进取',
        tagline: '覆盖优先，接受更高波动',
        risk_band: 'high',
        default_horizon: '30d',
        strategy_mapping: { strategy_version: 'tradeability_v2', params_bundle: 'aggressive' },
        display_policy: { primary_metrics: ['coverage', 'hit_rate', 'max_drawdown'] },
        is_default: false,
        status: 'active',
        effective_from: '2026-03-07T00:00:00.000Z',
        allowed_tiers: ['pro'],
    },
    {
        mode_id: 'observe_only_v1',
        name: '仅观察',
        tagline: '不提供进场建议，仅保留观察结论',
        risk_band: 'low',
        default_horizon: '30d',
        strategy_mapping: { strategy_version: 'tradeability_v2', params_bundle: 'observe_only' },
        display_policy: { primary_metrics: ['coverage', 'hit_rate', 'max_drawdown'] },
        is_default: false,
        status: 'active',
        effective_from: '2026-03-07T00:00:00.000Z',
        allowed_tiers: ['pro'],
    },
];

const MODES_BY_ID = new Map(MODE_DEFINITIONS.map(mode => [mode.mode_id, mode]));

function toNumber(input: unknown): number | null {
    if (input == null) return null;
    const value = Number(input);
    return Number.isFinite(value) ? value : null;
}

async function execute(db: DbClient, sql: string, args: (string | number | null)[] = []): Promise<void> {
    if (db.$type === 'cloud') {
        await (db as Client).execute({ sql, args });
        return;
    }
    (db as Database.Database).prepare(sql).run(...args);
}

async function queryOne<T extends Record<string, unknown>>(
    db: DbClient,
    sql: string,
    args: (string | number | null)[] = []
): Promise<T | null> {
    if (db.$type === 'cloud') {
        const rs = await (db as Client).execute({ sql, args });
        return (rs.rows[0] as unknown as T | undefined) || null;
    }
    return ((db as Database.Database).prepare(sql).get(...args) as T | undefined) || null;
}

async function queryRows<T extends Record<string, unknown>>(
    db: DbClient,
    sql: string,
    args: (string | number | null)[] = []
): Promise<T[]> {
    if (db.$type === 'cloud') {
        const rs = await (db as Client).execute({ sql, args });
        return rs.rows as unknown as T[];
    }
    return ((db as Database.Database).prepare(sql).all(...args) as T[]) || [];
}

export function parsePerformanceScope(value: string | null): PerformanceScope | null {
    if (value === 'universal' || value === 'pool') return value;
    return null;
}

export function parseHorizon(value: string | null): Horizon | null {
    if (value === '7d' || value === '30d' || value === '90d') return value;
    return null;
}

export function getRiskBandLabel(riskBand: RiskBand | null | undefined): string {
    if (riskBand === 'low') return '低波动';
    if (riskBand === 'high') return '高波动';
    return '均衡';
}

export function getModeDefinition(modeId: string): InvestmentModeDefinition | null {
    return MODES_BY_ID.get(modeId) || null;
}

export function isModeAllowedForTier(modeId: string, tier: UserTier): boolean {
    const mode = getModeDefinition(modeId);
    return !!mode && mode.allowed_tiers.includes(tier);
}

export function listModeCatalogForTier(tier: UserTier): ModeCatalogItem[] {
    return MODE_DEFINITIONS.map(mode => {
        const available = mode.allowed_tiers.includes(tier);
        return {
            ...mode,
            is_available: available,
            is_locked: !available,
        };
    });
}

let _schemaEnsured = false;

export async function ensureInvestmentModeSchema(db: DbClient): Promise<void> {
    if (_schemaEnsured) return;
    await execute(db, `
        CREATE TABLE IF NOT EXISTS user_investment_mode (
            user_id TEXT PRIMARY KEY,
            mode_id TEXT NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            updated_by TEXT DEFAULT 'user'
        )
    `);

    await execute(db, `
        CREATE TABLE IF NOT EXISTS mode_decision_log (
            id TEXT PRIMARY KEY,
            mode_id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            decision_date TEXT NOT NULL,
            strategy_version TEXT NOT NULL,
            decision_semantic TEXT NOT NULL,
            layer1_status TEXT,
            trigger_flags TEXT,
            reasoning_snapshot TEXT,
            confidence REAL,
            job_id TEXT,
            rule_version TEXT,
            triggered_by TEXT,
            created_at TIMESTAMP NOT NULL
        )
    `);
    await execute(db, `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mode_decision_unique
        ON mode_decision_log(mode_id, symbol, decision_date, strategy_version)
    `);

    await execute(db, `
        CREATE TABLE IF NOT EXISTS mode_simulated_trade_ledger (
            id TEXT PRIMARY KEY,
            mode_id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            entry_date TEXT NOT NULL,
            exit_date TEXT,
            entry_price REAL NOT NULL,
            exit_price REAL,
            holding_days INTEGER,
            trade_status TEXT NOT NULL,
            decision_source_id TEXT NOT NULL,
            pnl_pct REAL,
            max_drawdown_pct REAL,
            rule_version TEXT NOT NULL,
            job_id TEXT,
            triggered_by TEXT,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
        )
    `);
    await execute(db, `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mode_ledger_unique
        ON mode_simulated_trade_ledger(mode_id, symbol, entry_date, rule_version)
    `);
    await execute(db, `
        CREATE INDEX IF NOT EXISTS idx_mode_ledger_lookup
        ON mode_simulated_trade_ledger(mode_id, entry_date DESC)
    `);

    await execute(db, `
        CREATE TABLE IF NOT EXISTS mode_performance_snapshot (
            mode_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            horizon TEXT NOT NULL,
            segment_key TEXT DEFAULT 'all',
            coverage REAL,
            hit_rate REAL,
            max_drawdown REAL,
            sample_size INTEGER,
            payoff_ratio REAL,
            stability_score REAL,
            job_id TEXT,
            rule_version TEXT,
            triggered_by TEXT,
            as_of_date TEXT NOT NULL,
            computed_at TIMESTAMP NOT NULL,
            PRIMARY KEY (mode_id, scope, horizon, as_of_date, segment_key)
        )
    `);
    await execute(db, `
        CREATE INDEX IF NOT EXISTS idx_mode_perf_query
        ON mode_performance_snapshot(mode_id, scope, horizon, segment_key, as_of_date DESC)
    `);
    await execute(db, `
        CREATE TABLE IF NOT EXISTS promotion_audit_log (
            audit_id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            market TEXT,
            candidate_version TEXT,
            baseline_version TEXT,
            outcome_status TEXT NOT NULL,
            source_verdict_path TEXT,
            execution_mode TEXT,
            actor TEXT,
            summary_json TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL
        )
    `);
    await execute(db, `
        CREATE INDEX IF NOT EXISTS idx_promotion_audit_lookup
        ON promotion_audit_log(event_type, market, created_at DESC)
    `);

    try {
        await execute(db, 'ALTER TABLE ai_predictions_v2 ADD COLUMN mode_id TEXT');
    } catch (error) {
        const message = String(error).toLowerCase();
        if (
            !message.includes('duplicate column') &&
            !message.includes('already exists') &&
            !message.includes('duplicate') &&
            !message.includes('no such table')
        ) {
            throw error;
        }
    }
    for (const sql of [
        'ALTER TABLE mode_decision_log ADD COLUMN job_id TEXT',
        'ALTER TABLE mode_decision_log ADD COLUMN rule_version TEXT',
        'ALTER TABLE mode_decision_log ADD COLUMN triggered_by TEXT',
        'ALTER TABLE mode_simulated_trade_ledger ADD COLUMN job_id TEXT',
        'ALTER TABLE mode_simulated_trade_ledger ADD COLUMN triggered_by TEXT',
        'ALTER TABLE mode_performance_snapshot ADD COLUMN job_id TEXT',
        'ALTER TABLE mode_performance_snapshot ADD COLUMN rule_version TEXT',
        'ALTER TABLE mode_performance_snapshot ADD COLUMN triggered_by TEXT',
    ]) {
        try {
            await execute(db, sql);
        } catch (error) {
            const message = String(error).toLowerCase();
            if (!message.includes('duplicate column') && !message.includes('already exists')) {
                throw error;
            }
        }
    }
    _schemaEnsured = true;
}

const _modeCache = new Map<string, { record: UserModeRecord; ts: number }>();
const MODE_CACHE_TTL = 300_000; // 5 min

export async function getUserMode(db: DbClient, userId: string, tier: UserTier): Promise<UserModeRecord> {
    const cacheKey = `${userId}|${tier}`;
    const cached = _modeCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < MODE_CACHE_TTL) return cached.record;

    const row = await queryOne<{ mode_id?: string; updated_at?: string }>(
        db,
        'SELECT mode_id, updated_at FROM user_investment_mode WHERE user_id = ? LIMIT 1',
        [userId]
    );

    const modeId = row?.mode_id || DEFAULT_MODE_ID;
    let record: UserModeRecord;
    if (!isModeAllowedForTier(modeId, tier)) {
        record = {
            mode_id: DEFAULT_MODE_ID,
            updated_at: row?.updated_at || null,
            source: 'default_fallback',
        };
    } else {
        record = {
            mode_id: modeId,
            updated_at: row?.updated_at || null,
            source: row?.mode_id ? 'user_selection' : 'default_fallback',
        };
    }
    _modeCache.set(cacheKey, { record, ts: Date.now() });
    return record;
}

export async function setUserMode(
    db: DbClient,
    userId: string,
    requestedModeId: string,
    tier: UserTier
): Promise<{ ok: true } | { ok: false; code: 'invalid_mode' | 'tier_forbidden' }> {
    const mode = getModeDefinition(requestedModeId);
    if (!mode) {
        return { ok: false, code: 'invalid_mode' };
    }
    if (!isModeAllowedForTier(requestedModeId, tier)) {
        return { ok: false, code: 'tier_forbidden' };
    }

    const now = new Date().toISOString();
    await execute(db, `
        INSERT INTO user_investment_mode (user_id, mode_id, updated_at, updated_by)
        VALUES (?, ?, ?, 'user')
        ON CONFLICT(user_id) DO UPDATE SET
            mode_id = excluded.mode_id,
            updated_at = excluded.updated_at,
            updated_by = 'user'
    `, [userId, requestedModeId, now]);

    return { ok: true };
}

function getSegmentKey(scope: PerformanceScope, userId: string, segmentFromQuery: string | null): string {
    if (segmentFromQuery && segmentFromQuery.trim()) return segmentFromQuery.trim();
    if (scope === 'pool') return `user:${userId}`;
    return 'all';
}

export async function getLatestPerformanceSnapshot(
    db: DbClient,
    userId: string,
    modeId: string,
    scope: PerformanceScope,
    horizon: Horizon,
    segmentFromQuery: string | null
): Promise<PerformanceSnapshotRecord | null> {
    const segmentKey = getSegmentKey(scope, userId, segmentFromQuery);
    const row = await queryOne<Record<string, unknown>>(db, `
        SELECT mode_id, scope, horizon, segment_key, coverage, hit_rate, max_drawdown,
               sample_size, payoff_ratio, stability_score, as_of_date, computed_at
        FROM mode_performance_snapshot
        WHERE mode_id = ? AND scope = ? AND horizon = ? AND segment_key = ?
        ORDER BY as_of_date DESC, computed_at DESC
        LIMIT 1
    `, [modeId, scope, horizon, segmentKey]);

    if (!row) return null;

    return {
        mode_id: String(row.mode_id || modeId),
        scope,
        horizon,
        segment_key: String(row.segment_key || segmentKey),
        coverage: toNumber(row.coverage),
        hit_rate: toNumber(row.hit_rate),
        max_drawdown: toNumber(row.max_drawdown),
        sample_size: Number(row.sample_size || 0),
        payoff_ratio: toNumber(row.payoff_ratio),
        stability_score: toNumber(row.stability_score),
        as_of_date: row.as_of_date ? String(row.as_of_date) : null,
        computed_at: row.computed_at ? String(row.computed_at) : null,
    };
}

export async function getModeLedger(
    db: DbClient,
    modeId: string,
    horizon: Horizon,
    userId: string,
    page: number,
    pageSize: number,
    symbol: string | null,
    tradeStatus: string | null
): Promise<{ total: number; items: ModeLedgerItem[] }> {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - Number(horizon.replace('d', '')) + 1);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const filters: string[] = ['l.mode_id = ?', 'l.entry_date >= ?'];
    const args: (string | number | null)[] = [modeId, cutoffDate];
    if (symbol) {
        filters.push('l.symbol = ?');
        args.push(symbol);
    }
    if (tradeStatus === 'open' || tradeStatus === 'closed') {
        filters.push('l.trade_status = ?');
        args.push(tradeStatus);
    }
    filters.push('EXISTS (SELECT 1 FROM user_watchlist w WHERE w.user_id = ? AND w.symbol = l.symbol)');
    args.push(userId);

    const whereSql = filters.join(' AND ');
    const countRow = await queryOne<{ count?: number }>(
        db,
        `SELECT COUNT(*) as count FROM mode_simulated_trade_ledger l WHERE ${whereSql}`,
        args
    );
    const total = Number(countRow?.count || 0);

    const offset = Math.max(0, (page - 1) * pageSize);
    const rows = await queryRows<Record<string, unknown>>(
        db,
        `
        SELECT l.id, l.symbol, l.entry_date, l.exit_date, l.entry_price, l.exit_price,
               l.holding_days, l.trade_status, l.pnl_pct, l.max_drawdown_pct, l.rule_version
        FROM mode_simulated_trade_ledger l
        WHERE ${whereSql}
        ORDER BY l.entry_date DESC
        LIMIT ? OFFSET ?
        `,
        [...args, pageSize, offset]
    );

    return {
        total,
        items: rows.map((r) => ({
            id: String(r.id),
            symbol: String(r.symbol),
            entry_date: String(r.entry_date),
            exit_date: r.exit_date ? String(r.exit_date) : null,
            entry_price: toNumber(r.entry_price),
            exit_price: toNumber(r.exit_price),
            holding_days: r.holding_days == null ? null : Number(r.holding_days),
            trade_status: (r.trade_status === 'open' ? 'open' : 'closed'),
            pnl_pct: toNumber(r.pnl_pct),
            max_drawdown_pct: toNumber(r.max_drawdown_pct),
            rule_version: r.rule_version ? String(r.rule_version) : null,
        })),
    };
}

export async function getModeDecisions(
    db: DbClient,
    modeId: string,
    userId: string,
    dateFrom: string | null,
    dateTo: string | null,
    page: number,
    pageSize: number,
    symbol: string | null
): Promise<{ total: number; items: ModeDecisionItem[] }> {
    const filters: string[] = ['d.mode_id = ?'];
    const args: (string | number | null)[] = [modeId];
    if (dateFrom) {
        filters.push('d.decision_date >= ?');
        args.push(dateFrom);
    }
    if (dateTo) {
        filters.push('d.decision_date <= ?');
        args.push(dateTo);
    }
    if (symbol) {
        filters.push('d.symbol = ?');
        args.push(symbol);
    }
    filters.push('EXISTS (SELECT 1 FROM user_watchlist w WHERE w.user_id = ? AND w.symbol = d.symbol)');
    args.push(userId);
    const whereSql = filters.join(' AND ');

    const countRow = await queryOne<{ count?: number }>(
        db,
        `SELECT COUNT(*) as count FROM mode_decision_log d WHERE ${whereSql}`,
        args
    );
    const total = Number(countRow?.count || 0);

    const offset = Math.max(0, (page - 1) * pageSize);
    const rows = await queryRows<Record<string, unknown>>(
        db,
        `
        SELECT d.id, d.symbol, d.decision_date, d.decision_semantic, d.strategy_version,
               d.layer1_status, d.confidence, d.trigger_flags, d.reasoning_snapshot
        FROM mode_decision_log d
        WHERE ${whereSql}
        ORDER BY d.decision_date DESC
        LIMIT ? OFFSET ?
        `,
        [...args, pageSize, offset]
    );

    return {
        total,
        items: rows.map((r) => ({
            id: String(r.id),
            symbol: String(r.symbol),
            decision_date: String(r.decision_date),
            decision_semantic: normalizeDecisionSemantic(r.decision_semantic),
            strategy_version: String(r.strategy_version || ''),
            layer1_status: r.layer1_status ? normalizeLayer1Status(r.layer1_status) : null,
            confidence: toNumber(r.confidence),
            trigger_flags: r.trigger_flags ? String(r.trigger_flags) : null,
            reasoning_snapshot: r.reasoning_snapshot ? String(r.reasoning_snapshot) : null,
        })),
    };
}
