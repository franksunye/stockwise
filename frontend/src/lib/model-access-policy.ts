import type { DbClient } from '@/lib/db';
import type { AppTier } from '@/lib/user-server';

type ModelRow = {
    model_id: string;
    config_json?: string | null;
};

const VALID_TIERS = new Set<AppTier>(['free', 'go', 'plus', 'pro', 'alpha']);
const _cache = new Map<string, { ids: string[]; ts: number }>();
const CACHE_TTL_MS = 120_000;

function normalizeTier(tier: string): AppTier {
    const normalized = String(tier || 'free').toLowerCase() as AppTier;
    return VALID_TIERS.has(normalized) ? normalized : 'free';
}

function parsePredictionTiers(configJsonRaw: string | null | undefined): AppTier[] {
    try {
        const parsed = JSON.parse(configJsonRaw || '{}') as {
            access?: { prediction_tiers?: string[] };
        };
        const list = parsed?.access?.prediction_tiers;
        if (!Array.isArray(list)) return [];
        const out: AppTier[] = [];
        for (const value of list) {
            const tier = normalizeTier(value);
            if (!out.includes(tier)) out.push(tier);
        }
        return out;
    } catch {
        return [];
    }
}

export async function getAllowedPredictionModelIdsForTier(
    db: DbClient,
    tier: AppTier
): Promise<string[]> {
    const normalizedTier = normalizeTier(tier);
    const cacheKey = `prediction:${normalizedTier}`;
    const cached = _cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.ids;
    }

    const sql = `
        SELECT model_id, config_json
        FROM prediction_models
        WHERE is_active = 1
          AND (roles LIKE '%"prediction"%' OR roles IS NULL)
        ORDER BY priority DESC
    `;

    let rows: ModelRow[] = [];
    if ('execute' in db) {
        const rs = await db.execute({ sql, args: [] });
        rows = rs.rows as unknown as ModelRow[];
    } else {
        rows = db.prepare(sql).all() as ModelRow[];
    }

    const allowed = rows
        .filter((row) => parsePredictionTiers(row.config_json).includes(normalizedTier))
        .map((row) => row.model_id);

    _cache.set(cacheKey, { ids: allowed, ts: Date.now() });
    return allowed;
}
