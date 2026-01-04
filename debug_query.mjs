import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'backend/.env' });

async function main() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const result = await client.execute({
        sql: "SELECT ai_reasoning FROM ai_predictions_v2 WHERE symbol = '02171' ORDER BY id DESC LIMIT 1",
        args: []
    });

    if (result.rows.length > 0) {
        console.log(JSON.stringify(result.rows[0].ai_reasoning, null, 2));
    } else {
        console.log("No data found");
    }
}

main().catch(console.error);
