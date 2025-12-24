import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';

export function getDbClient() {
    const url = process.env.TURSO_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (url && authToken) {
        return createClient({ url, authToken });
    } else {
        const dbPath = path.join(process.cwd(), '..', 'data', 'stockwise.db');
        return new Database(dbPath);
    }
}
