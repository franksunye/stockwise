import { createClient, Client } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';

// Turso/libSQL transient error patterns
const TRANSIENT_ERROR_PATTERNS = [
    'stream not found',
    'locked',
    '404',
    'tls handshake',
    'eof',
    'connection reset',
    'hrana',
    'timeout',
    'connection refused',
    'network',
    'fetch failed',
    'econnreset',
];

function isTransientError(error: unknown): boolean {
    const errorMsg = String(error).toLowerCase();
    return TRANSIENT_ERROR_PATTERNS.some(pattern => errorMsg.includes(pattern));
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export type DbClient = (Client | Database.Database) & { $type: 'cloud' | 'local' };

let _cloudSingleton: (Client & { $type: 'cloud' }) | null = null;

export function getDbClient(): DbClient {
    const url = process.env.TURSO_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    const strategy = process.env.DB_STRATEGY || process.env.DB_SOURCE; // Support both

    const forceLocal = strategy === 'local';
    const canUseCloud = url && authToken && url.startsWith('libsql://');

    if (!forceLocal && canUseCloud) {
        if (!_cloudSingleton) {
            const client = createClient({ url: url!, authToken: authToken! });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (client as any).$type = 'cloud';
            client.close = () => {};
            _cloudSingleton = client as Client & { $type: 'cloud' };
        }
        return _cloudSingleton as DbClient;
    } else {
        const localPath = process.env.LOCAL_DB_PATH || path.join(process.cwd(), '..', 'data', 'stockwise.db');
        const db = new Database(localPath);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).$type = 'local';
        return db as DbClient;
    }
}

/**
 * Execute a Turso query with retry logic for transient errors
 */
/** Force-reset the cloud singleton so the next getDbClient() creates a fresh connection. */
export function resetCloudClient(): void {
    _cloudSingleton = null;
}

export async function executeWithRetry<T>(
    fn: (client: Client) => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) resetCloudClient();
        const client = getDbClient() as Client;
        try {
            const result = await fn(client);
            return result;
        } catch (error) {
            lastError = error;
            if (isTransientError(error)) {
                const waitTime = 1000 * (attempt + 1);
                console.warn(`🔄 DB Error (Attempt ${attempt + 1}/${maxRetries}): ${error} - Retrying in ${waitTime}ms...`);
                await sleep(waitTime);
            } else {
                throw error;
            }
        }
    }

    console.error(`❌ Failed after ${maxRetries} attempts. Last error:`, lastError);
    throw lastError;
}

/**
 * 获取市场黄历数据 (共享)
 */
export async function getMarketAlmanacs(limit: number = 5) {
    const client = getDbClient();
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rows: any[] = [];
        if ('execute' in client) {
            const rs = await client.execute({
                sql: 'SELECT * FROM market_almanacs ORDER BY target_date DESC LIMIT ?',
                args: [limit]
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rows = rs.rows as any[];
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rows = client.prepare('SELECT * FROM market_almanacs ORDER BY target_date DESC LIMIT ?').all(limit) as any[];
        }

        return rows.map(a => {
            try {
                if (typeof a.market_entropy === 'string') a.market_entropy = JSON.parse(a.market_entropy);
                if (typeof a.sector_currents === 'string') a.sector_currents = JSON.parse(a.sector_currents);
                if (typeof a.generation_trace === 'string') a.generation_trace = JSON.parse(a.generation_trace);
                a.degraded = Boolean(
                    a?.generation_trace?.logic?.degraded ||
                    (a?.generation_trace?.data_quality?.facts_gate_pass === false)
                );
            } catch (e) {
                console.warn('[DB] Failed to parse almanac JSON:', e);
            }
            return a;
        });
    } finally {
        if (client && typeof client.close === 'function') {
            client.close();
        }
    }
}
