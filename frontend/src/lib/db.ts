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

export function getDbClient(): DbClient {
    const url = process.env.TURSO_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    const strategy = process.env.DB_STRATEGY || process.env.DB_SOURCE; // Support both

    // 优先使用云端数据库：
    // 1. 除非明确指定 DB_STRATEGY/DB_SOURCE='local'
    // 2. 并且存在云端配置 (URL + Token)
    const forceLocal = strategy === 'local';
    const canUseCloud = url && authToken && url.startsWith('libsql://');

    if (!forceLocal && canUseCloud) {
        // 显式连接云端 Turso
        const client = createClient({ url: url!, authToken: authToken! });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as any).$type = 'cloud';
        return client as DbClient;
    } else {
        // 连接本地 SQLite
        // 优先使用环境变量 LOCAL_DB_PATH，如果没有则 fallback 
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
export async function executeWithRetry<T>(
    fn: (client: Client) => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const client = getDbClient() as Client;
        try {
            const result = await fn(client);
            return result;
        } catch (error) {
            lastError = error;
            if (isTransientError(error)) {
                const waitTime = 1000 * (attempt + 1); // 1s, 2s, 3s
                console.warn(`🔄 DB Error (Attempt ${attempt + 1}/${maxRetries}): ${error} - Retrying in ${waitTime}ms...`);
                await sleep(waitTime);
            } else {
                throw error; // Non-transient error, throw immediately
            }
        }
    }

    console.error(`❌ Failed after ${maxRetries} attempts. Last error:`, lastError);
    throw lastError;
}
