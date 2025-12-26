import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';

export function getDbClient() {
    const url = process.env.TURSO_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    const strategy = process.env.DB_STRATEGY || 'local';

    if (strategy === 'cloud' && url && authToken) {
        // 显式连接云端 Turso
        return createClient({ url, authToken });
    } else {
        // 显式连接本地 SQLite
        // 优先使用环境变量 LOCAL_DB_PATH，如果没有则 fallback 
        const localPath = process.env.LOCAL_DB_PATH || path.join(process.cwd(), '..', 'data', 'stockwise.db');
        return new Database(localPath);
    }
}
