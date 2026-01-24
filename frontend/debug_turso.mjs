import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function debug() {
    const url = process.env.TURSO_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    
    console.log("Connecting to:", url);

    const client = createClient({
        url,
        authToken,
    });

    const date = '2026-01-24';
    
    try {
        const rs = await client.execute({
            sql: "SELECT * FROM task_logs WHERE date = ?",
            args: [date]
        });
        
        console.log(`Found ${rs.rows.length} rows for ${date}`);
        console.table(rs.rows);
        
    } catch (e) {
        console.error(e);
    }
}

debug();
