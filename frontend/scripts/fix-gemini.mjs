import { createClient } from "@libsql/client";
import 'dotenv/config';

const client = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const geminiConfig = JSON.stringify({
  model: "gpt-3.5-turbo",
  api_key_env: "LLM_API_KEY",
  base_url_env: "LLM_BASE_URL",
  max_tokens: 8192
});

console.log("📝 Updating gemini-3-flash config:", geminiConfig);

await client.execute({
  sql: "UPDATE prediction_models SET config_json = ? WHERE model_id = ?",
  args: [geminiConfig, "gemini-3-flash"]
});

console.log("✅ Done!");
